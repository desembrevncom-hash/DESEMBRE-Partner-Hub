import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Plus, ArrowLeft, ShieldAlert, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { 
  simulateAutomationScheduler, 
  SimulatorRecipientInput, 
  AutomationWorkflowConfig 
} from "@/lib/marketing/automationSchedulerSimulator";
import { MarketingSafetySettings } from "@/lib/marketing/safetyRules";
import { applySegmentRulesToQuery } from "@/lib/marketing/segmentRules";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/marketing/automation/new-run")({
  component: NewAutomationRunPage,
});

function NewAutomationRunPage() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [safetySettings, setSafetySettings] = useState<MarketingSafetySettings | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [isCreatingRun, setIsCreatingRun] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [wfRes, safeRes] = await Promise.all([
        supabase.from("marketing_automation_workflows").select("*, marketing_audiences(id, name, rules)").eq("mock_only", true),
        supabase.from("marketing_ops_safety_settings").select("*").eq("is_default", true).single()
      ]);

      if (wfRes.data) setWorkflows(wfRes.data);
      if (safeRes.data) setSafetySettings(safeRes.data as unknown as MarketingSafetySettings);
      
    } catch (e) {
      console.error(e);
      toast.error("Error loading dependencies");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedWorkflowId || !safetySettings) return;
    
    setIsGeneratingPreview(true);
    setPreviewResult(null);
    try {
      const wf = workflows.find(w => w.id === selectedWorkflowId);
      if (!wf) throw new Error("Workflow not found");

      // Build config
      const config: AutomationWorkflowConfig = {
        id: wf.id,
        name: wf.name,
        action_type: wf.action_type,
        channel: wf.action_type.includes("zalo") ? "zalo" : "email",
        delay_amount: wf.delay_amount || 0,
        delay_unit: wf.delay_unit || "minutes"
      };

      let recipients: SimulatorRecipientInput[] = [];
      if (wf.marketing_audiences?.rules) {
        let query = supabase.from("customers").select("id, email, phone");
        query = applySegmentRulesToQuery(query, wf.marketing_audiences.rules);
        
        const { data: customers, error: customerErr } = await query;
        if (customerErr) throw customerErr;

        if (customers && customers.length > 0) {
          const customerIds = customers.map(c => c.id);
          
          const { data: prefs } = await supabase
            .from("customer_marketing_preferences")
            .select("*")
            .in("customer_id", customerIds);
            
          const { data: supps } = await supabase
            .from("marketing_suppression_list")
            .select("*")
            .eq("is_active", true);

          recipients = customers.map(c => {
            const customerPref = prefs?.find(p => p.customer_id === c.id);
            return {
              id: c.id,
              email: c.email,
              phone: c.phone,
              preferences: customerPref || null,
              suppressions: supps || []
            };
          });
        }
      }

      if (recipients.length > 500) {
        toast.error("Audience too large", { description: "Maximum 500 recipients allowed per manual run."});
        return;
      }

      if (recipients.length === 0) {
        setPreviewResult({ empty: true, workflow: wf });
        return;
      }

      const result = simulateAutomationScheduler(config, recipients, safetySettings);
      setPreviewResult({ ...result, originalRecipients: recipients, workflow: wf });

    } catch (e: any) {
      console.error(e);
      toast.error("Error generating preview", { description: e.message });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleCreateRun = async () => {
    if (!previewResult) return;
    
    setIsCreatingRun(true);
    
    try {
      const { workflow, evaluatedRecipients, summary } = previewResult;

      // 1. Create Draft Batch
      const { data: batchData, error: batchError } = await supabase
        .from('marketing_automation_run_batches')
        .insert({
          workflow_id: workflow.id,
          execution_mode: 'mock',
          status: 'draft',
          summary: { 
            total: summary.total, 
            pending: summary.total,
            completed: 0,
            failed: 0,
            blocked: 0
          }
        })
        .select()
        .single();

      if (batchError || !batchData) {
        throw new Error(`Failed to create draft batch: ${batchError?.message}`);
      }

      const batchId = batchData.id;
      const channel = workflow.action_type.includes('zalo') ? 'zalo' : 'email';

      // 2. Prepare Recipients
      const inserts = evaluatedRecipients.map((rec: any) => ({
        batch_id: batchId,
        workflow_id: workflow.id,
        customer_id: rec.id,
        recipient_email: rec.email,
        recipient_phone: rec.phone,
        channel,
        provider: 'mock',
        status: 'pending',
        execute_at: rec.executeAt.toISOString(),
        safety_result: rec.safetyResult
      }));

      // 3. Chunk Inserts at 100 per batch
      const chunkSize = 100;
      let hasError = false;
      let errorMessage = '';

      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
          .from('marketing_automation_run_recipients')
          .insert(chunk);

        if (insertError) {
          hasError = true;
          errorMessage = insertError.message;
          break;
        }
      }

      if (hasError) {
        // Mark batch failed
        await supabase
          .from('marketing_automation_run_batches')
          .update({ 
            status: 'failed',
            summary: { ...batchData.summary, error: errorMessage }
          })
          .eq('id', batchId);
          
        throw new Error(`Failed to insert recipients: ${errorMessage}`);
      }

      // 4. Update Batch to pending_approval
      const { error: updateError } = await supabase
        .from('marketing_automation_run_batches')
        .update({ status: 'pending_approval' })
        .eq('id', batchId);

      if (updateError) {
        throw new Error(`Failed to update batch status: ${updateError.message}`);
      }

      toast.success("Run Batch Created", { description: "Batch is pending approval." });
      
      // Navigate to QA Console
      navigate({ to: '/marketing/automation-queue' });

    } catch (e: any) {
      console.error(e);
      toast.error("Error creating run", { description: e.message });
    } finally {
      setIsCreatingRun(false);
    }
  };

  const selectedWf = workflows.find(w => w.id === selectedWorkflowId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate({ to: '/marketing/automation-queue' })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Plus className="w-6 h-6 text-violet-600" />
            Create Automation Run
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manual Sandbox Execution (Mock Only)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader className="bg-slate-50/50 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Workflow</label>
              <select 
                className="w-full p-2 border border-slate-300 rounded-md bg-white text-sm"
                value={selectedWorkflowId}
                onChange={(e) => {
                  setSelectedWorkflowId(e.target.value);
                  setPreviewResult(null);
                }}
                disabled={isLoading || isCreatingRun}
              >
                <option value="">-- Choose a workflow --</option>
                {workflows.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {selectedWf && (
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Audience</span>
                  <span className="font-semibold text-slate-800">{selectedWf.marketing_audiences?.name || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Action</span>
                  <Badge variant="secondary" className="text-[10px]">{selectedWf.action_type}</Badge>
                </div>
              </div>
            )}

            <Button 
              className="w-full bg-slate-900" 
              onClick={handlePreview}
              disabled={!selectedWorkflowId || isGeneratingPreview || isCreatingRun}
            >
              {isGeneratingPreview ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Generate Audience Preview
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm min-h-[400px]">
          <CardHeader className="bg-slate-50/50 pb-3 border-b border-slate-100">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Preview & Activation
              </CardTitle>
              {previewResult && !previewResult.empty && (
                <Badge variant="outline" className="text-[10px] font-mono text-slate-500">
                  Total: {previewResult.summary.total}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {!previewResult ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Select a workflow and generate a preview to continue.
              </div>
            ) : previewResult.empty ? (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                  <ShieldAlert className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No customers resolved for this workflow audience</p>
                  <p className="text-xs text-slate-500 mt-2 font-mono">
                    workflow_id: {previewResult.workflow.id} <br />
                    audience_id: {previewResult.workflow.audience_id || 'null'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 font-medium">Eligible</p>
                    <p className="text-2xl font-bold text-emerald-600">{previewResult.summary.eligible}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 font-medium">Blocked</p>
                    <p className="text-2xl font-bold text-rose-600">{previewResult.summary.blocked}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-500 font-medium">Delayed</p>
                    <p className="text-2xl font-bold text-amber-600">{previewResult.summary.delayed}</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold">Review before continuing</p>
                    <p className="mt-1">
                      Creating this run will insert {previewResult.summary.total} recipients into the staging database. 
                      The batch will be created as <strong>pending_approval</strong> and will require Admin approval before it can be processed manually.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <Button 
                    className="bg-violet-600 hover:bg-violet-700 text-white min-w-[150px]"
                    onClick={handleCreateRun}
                    disabled={isCreatingRun}
                  >
                    {isCreatingRun ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Create Run Batch</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
