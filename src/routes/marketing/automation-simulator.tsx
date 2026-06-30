import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Play, Users, Clock, ShieldAlert, CheckCircle, XCircle 
} from "lucide-react";
import { 
  simulateAutomationScheduler, 
  SimulatorRecipientInput, 
  AutomationWorkflowConfig 
} from "@/lib/marketing/automationSchedulerSimulator";
import { MarketingSafetySettings } from "@/lib/marketing/safetyRules";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/marketing/automation-simulator")({
  component: AutomationSimulatorPage,
});

function AutomationSimulatorPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [safetySettings, setSafetySettings] = useState<MarketingSafetySettings | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [wfRes, safeRes] = await Promise.all([
        supabase.from("marketing_automation_workflows").select("*, marketing_audiences(name)").eq("mock_only", true),
        supabase.from("marketing_ops_safety_settings").select("*").eq("is_default", true).single()
      ]);

      if (wfRes.data) setWorkflows(wfRes.data);
      if (safeRes.data) setSafetySettings(safeRes.data as unknown as MarketingSafetySettings);
      
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulate = async () => {
    if (!selectedWorkflowId || !safetySettings) return;
    
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const wf = workflows.find(w => w.id === selectedWorkflowId);
      if (!wf) throw new Error("Workflow not found");

      // Build config
      const config: AutomationWorkflowConfig = {
        id: wf.id,
        name: wf.name,
        action_type: wf.action_type,
        channel: wf.action_type.includes("zalo") ? "zalo" : "email", // Naive map for simulation
        delay_amount: wf.delay_amount || 0,
        delay_unit: wf.delay_unit || "minutes"
      };

      // If workflow has audience, fetch members
      let recipients: SimulatorRecipientInput[] = [];
      if (wf.audience_id) {
        // Fetch audience members
        const { data: members } = await supabase
          .from("marketing_audience_members")
          .select("customer_id, customers(email, phone)")
          .eq("audience_id", wf.audience_id);

        if (members && members.length > 0) {
          const customerIds = members.map(m => m.customer_id);
          
          // Fetch preferences
          const { data: prefs } = await supabase
            .from("customer_marketing_preferences")
            .select("*")
            .in("customer_id", customerIds);
            
          // Fetch suppressions
          const { data: supps } = await supabase
            .from("marketing_suppression_list")
            .select("*")
            .eq("is_active", true);

          recipients = members.map(m => {
            const customerPref = prefs?.find(p => p.customer_id === m.customer_id);
            return {
              id: m.customer_id,
              email: m.customers?.email,
              phone: m.customers?.phone,
              preferences: customerPref || null,
              suppressions: supps || []
            };
          });
        }
      } else {
        // Fallback fake recipient for testing if no audience
        recipients = [{
          id: "fake-test-id",
          email: "test@desembre.vn",
          preferences: null // Will block because of missing pref
        }];
      }

      // Run pure simulation
      const result = simulateAutomationScheduler(config, recipients, safetySettings);
      setSimulationResult(result);

    } catch (e) {
      console.error(e);
      alert("Error running simulation");
    } finally {
      setIsSimulating(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading simulator...</div>;
  }

  const selectedWf = workflows.find(w => w.id === selectedWorkflowId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Automation Scheduler Simulator</h1>
            <p className="text-slate-500 mt-1">Dry-run preview of cron state machine and safety evaluations (M41).</p>
          </div>
          <Badge className="bg-amber-100 text-amber-800 border-none font-bold uppercase tracking-wider px-3 py-1">
            SIMULATION ONLY
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-indigo-500" /> Control Panel
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Select Workflow</label>
                  <select 
                    className="w-full mt-1 p-2 border border-slate-300 rounded-lg bg-slate-50"
                    value={selectedWorkflowId}
                    onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  >
                    <option value="">-- Choose a workflow --</option>
                    {workflows.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {selectedWf && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Audience</span>
                      <span className="font-bold">{selectedWf.marketing_audiences?.name || "None"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Delay</span>
                      <span className="font-bold">{selectedWf.delay_amount} {selectedWf.delay_unit}</span>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSimulate} 
                  disabled={!selectedWorkflowId || isSimulating}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  {isSimulating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  Run Dry-Run Simulation
                </Button>
                
                <p className="text-[10px] text-slate-400 text-center uppercase font-bold">No Database Insertions Will Occur</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {simulationResult ? (
              <div className="space-y-6">
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                    <Clock className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                    <div className="text-[10px] uppercase font-bold text-slate-400">Virtual Exec Time</div>
                    <div className="text-sm font-bold mt-1 text-slate-800">
                      {new Date(simulationResult.virtual_execute_at).toLocaleTimeString("vi-VN")}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                    <Users className="w-6 h-6 mx-auto text-indigo-500 mb-2" />
                    <div className="text-[10px] uppercase font-bold text-slate-400">Total Scanned</div>
                    <div className="text-xl font-bold mt-1 text-slate-800">
                      {simulationResult.recipient_preview.length}
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm text-center">
                    <CheckCircle className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
                    <div className="text-[10px] uppercase font-bold text-emerald-600">Eligible</div>
                    <div className="text-xl font-bold mt-1 text-emerald-700">
                      {simulationResult.eligible_count}
                    </div>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 shadow-sm text-center">
                    <XCircle className="w-6 h-6 mx-auto text-rose-500 mb-2" />
                    <div className="text-[10px] uppercase font-bold text-rose-600">Excluded</div>
                    <div className="text-xl font-bold mt-1 text-rose-700">
                      {simulationResult.excluded_count}
                    </div>
                  </div>
                </div>

                {simulationResult.excluded_count > 0 && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500" /> Exclusion Reasons Breakdown
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(simulationResult.exclusion_reasons).map(([reason, count]) => (
                        <div key={reason} className="flex justify-between items-center bg-rose-50 p-3 rounded-lg border border-rose-100 text-sm">
                          <span className="text-rose-800">{reason}</span>
                          <span className="font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                     <h3 className="font-bold text-slate-800">Recipient Preview Log</h3>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                         <tr>
                           <th className="px-6 py-3">Customer ID</th>
                           <th className="px-6 py-3">Contact</th>
                           <th className="px-6 py-3">Consent Gate</th>
                           <th className="px-6 py-3">Would Enqueue</th>
                           <th className="px-6 py-3">Reason</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {simulationResult.recipient_preview.map((rec: any, idx: number) => (
                           <tr key={idx} className="hover:bg-slate-50">
                             <td className="px-6 py-3 font-mono text-xs text-slate-500">
                               {rec.customer_id.substring(0, 8)}...
                             </td>
                             <td className="px-6 py-3">
                               {rec.email || rec.phone || 'N/A'}
                             </td>
                             <td className="px-6 py-3">
                               {rec.consent_gate_result?.allowed ? (
                                 <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Passed</Badge>
                               ) : (
                                 <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none">Blocked</Badge>
                               )}
                             </td>
                             <td className="px-6 py-3">
                               {rec.would_enqueue ? (
                                 <CheckCircle className="w-4 h-4 text-emerald-500" />
                               ) : (
                                 <XCircle className="w-4 h-4 text-rose-500" />
                               )}
                             </td>
                             <td className="px-6 py-3 text-xs text-slate-500">
                               {rec.exclusion_reason || "-"}
                             </td>
                           </tr>
                         ))}
                         {simulationResult.recipient_preview.length === 0 && (
                           <tr>
                             <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                               No recipients found in audience.
                             </td>
                           </tr>
                         )}
                       </tbody>
                     </table>
                   </div>
                </div>

              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center p-20 text-center h-full">
                <ShieldAlert className="w-16 h-16 text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-800">Ready to Simulate</h3>
                <p className="text-slate-500 mt-2 max-w-sm">
                  Select a workflow and click Run to see exactly who would receive the automation and who would be blocked by safety gates.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
