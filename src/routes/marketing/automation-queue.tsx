import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ArrowRight, RefreshCw, Play, ShieldAlert, CheckCircle2, Clock, AlertTriangle, Info, Search, XCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import { isProductionEnv } from '@/lib/marketing/envGuard'

export const Route = createFileRoute("/marketing/automation-queue")({
  component: AutomationQueuePage,
})

interface RunBatch {
  id: string
  workflow_id: string
  status: string
  execution_mode: string
  created_at: string
  updated_at: string
  approved_by: string | null
  approved_at: string | null
  scheduled_for: string | null
  completed_at: string | null
  summary: { total?: number; completed?: number; blocked?: number; failed?: number; pending?: number; error?: string } | null
}

interface RunRecipient {
  id: string
  batch_id: string
  recipient_email: string | null
  recipient_phone: string | null
  channel: string
  status: string
  provider: string
  safety_result: any
  consent_result: any
  last_error: string | null
  send_job_id: string | null
  execute_at: string
  attempt_count: number
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'blocked': return 'bg-rose-100 text-rose-700 border-rose-200'
    case 'failed': return 'bg-red-100 text-red-700 border-red-200'
    case 'skipped': return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'cancelled': return 'bg-slate-200 text-slate-600 border-slate-300'
    case 'approved': return 'bg-violet-100 text-violet-700 border-violet-200'
    case 'pending_approval': return 'bg-amber-100 text-amber-700 border-amber-200'
    default: return 'bg-slate-100 text-slate-700 border-slate-200' // pending, draft
  }
}

function AutomationQueuePage() {
  const navigate = useNavigate()
  const [batches, setBatches] = useState<RunBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [recipients, setRecipients] = useState<RunRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // M44 States
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [hideTerminal, setHideTerminal] = useState<boolean>(true)
  const [batchSearch, setBatchSearch] = useState<string>('')
  const [recipientSearch, setRecipientSearch] = useState<string>('')
  
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [batchToCancel, setBatchToCancel] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: batchData, error: batchError } = await supabase
        .from('marketing_automation_run_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (batchError) throw batchError
      setBatches(batchData || [])

      if (selectedBatchId) {
        await loadRecipients(selectedBatchId)
      }
    } catch (error: any) {
      console.error(error)
      toast.error('Error fetching data', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const loadRecipients = async (batchId: string) => {
    try {
      const { data, error } = await supabase
        .from('marketing_automation_run_recipients')
        .select('*')
        .eq('batch_id', batchId)
        .order('execute_at', { ascending: true })
      
      if (error) throw error
      setRecipients(data || [])
    } catch (error: any) {
      console.error(error)
      toast.error('Error fetching recipients', { description: error.message })
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSelectBatch = (batchId: string) => {
    setSelectedBatchId(batchId)
    loadRecipients(batchId)
  }

  const handleProcessQueue = async () => {
    setProcessing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("No active session. Please log in.")
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-automation-queue`
      
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const result = await res.json()
      
      if (!res.ok) {
        throw new Error(result.error || `HTTP ${res.status}`)
      }

      toast.success('Queue Processed', {
        description: `Successfully processed ${result.processed || 0} recipients.`,
      })
      
      await fetchData()

    } catch (error: any) {
      console.error(error)
      toast.error('Processing Failed', {
        description: error.message
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleApproveBatch = async (batchId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("No session")
      
      const { error } = await supabase
        .from('marketing_automation_run_batches')
        .update({ 
          status: 'approved',
          approved_by: session.user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', batchId)

      if (error) throw error
      
      toast.success('Batch Approved')
      fetchData()
    } catch (e: any) {
      toast.error('Failed to approve', { description: e.message })
    }
  }

  const promptCancelBatch = (batchId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setBatchToCancel(batchId)
    setIsCancelModalOpen(true)
  }

  const handleCancelBatch = async () => {
    if (!batchToCancel) return;
    try {
      const { error } = await supabase
        .from('marketing_automation_run_batches')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', batchToCancel);
      
      if (error) throw error;
      toast.success("Batch cancelled successfully");
      setIsCancelModalOpen(false);
      setBatchToCancel(null);
      fetchData();
    } catch (e: any) {
      toast.error("Failed to cancel", { description: e.message });
    }
  }

  // Local filtering logic
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (hideTerminal && ['completed', 'failed', 'cancelled', 'blocked'].includes(b.status)) return false;
      if (batchSearch) {
        const term = batchSearch.toLowerCase();
        if (!b.id.toLowerCase().includes(term) && !b.workflow_id.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [batches, statusFilter, hideTerminal, batchSearch]);

  const filteredRecipients = useMemo(() => {
    return recipients.filter(r => {
      if (recipientSearch) {
        const term = recipientSearch.toLowerCase();
        const email = r.recipient_email?.toLowerCase() || '';
        const phone = r.recipient_phone?.toLowerCase() || '';
        if (!email.includes(term) && !phone.includes(term)) return false;
      }
      return true;
    });
  }, [recipients, recipientSearch]);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  if (isProductionEnv()) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto mt-20 bg-white rounded-xl shadow-sm border border-rose-100">
         <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
         <h2 className="text-xl font-bold text-slate-800 mb-2">Production Restricted</h2>
         <p className="text-slate-500">Automation execution tools are disabled in Production.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-violet-600" />
              M44 Automation QA Console
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Audit & Cleanup Console for Marketing Automation
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate({ to: '/marketing/automation/new-run' })}
              className="border-violet-200 text-violet-700 hover:bg-violet-50"
            >
               New Run
            </Button>
            <Button 
              variant="outline" 
              onClick={fetchData} 
              disabled={loading || processing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Button 
              onClick={handleProcessQueue} 
              disabled={processing}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200"
            >
              <Play className={`w-4 h-4 ${processing ? 'animate-pulse' : ''}`} />
              {processing ? 'Processing...' : 'Process Queue'}
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
           <div className="flex flex-wrap items-center gap-4">
             <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input 
                  placeholder="Search Batch or Workflow ID..."
                  className="pl-9 w-72"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                />
             </div>
             <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                   <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Statuses</SelectItem>
                   <SelectItem value="draft">Draft</SelectItem>
                   <SelectItem value="pending_approval">Pending Approval</SelectItem>
                   <SelectItem value="approved">Approved</SelectItem>
                   <SelectItem value="processing">Processing</SelectItem>
                   <SelectItem value="completed">Completed</SelectItem>
                   <SelectItem value="blocked">Blocked</SelectItem>
                   <SelectItem value="failed">Failed</SelectItem>
                   <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
             </Select>
             <div className="flex items-center space-x-2">
                <Switch id="hide-terminal" checked={hideTerminal} onCheckedChange={setHideTerminal} />
                <Label htmlFor="hide-terminal" className="text-sm text-slate-600 cursor-pointer">Hide Terminal Batches</Label>
             </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Batches Panel */}
          <Card className="lg:col-span-4 shadow-sm border-slate-200 flex flex-col h-[750px] overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Run Batches ({filteredBatches.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {filteredBatches.length === 0 && !loading && (
                <div className="p-10 flex flex-col items-center justify-center text-slate-400">
                  <Search className="w-8 h-8 mb-2 opacity-20" />
                  <span className="text-sm">No batches match your filters</span>
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {filteredBatches.map((batch) => {
                  const canCancel = ['draft', 'pending_approval'].includes(batch.status);
                  
                  return (
                  <div 
                    key={batch.id}
                    onClick={() => handleSelectBatch(batch.id)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors group ${selectedBatchId === batch.id ? 'bg-violet-50/50 relative' : ''}`}
                  >
                    {selectedBatchId === batch.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-r" />
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs font-mono text-slate-500 flex flex-col gap-1">
                        <span title={batch.id}>ID: {batch.id.substring(0, 8)}...</span>
                        <span title={batch.workflow_id}>WF: {batch.workflow_id.substring(0, 8)}...</span>
                      </div>
                      <Badge variant="outline" className={`${getStatusColor(batch.status)} capitalize text-[10px]`}>
                        {batch.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600 border-none uppercase">
                          {batch.execution_mode}
                        </Badge>
                        <span className="text-[10px] text-slate-500">
                          {new Date(batch.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {canCancel && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[10px] text-rose-500 hover:bg-rose-50 hover:text-rose-700 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => promptCancelBatch(batch.id, e)}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      )}
                    </div>

                    {batch.status === 'failed' && batch.summary?.error && (
                      <div className="mb-2 bg-red-50 text-red-700 text-[10px] p-2 rounded-md border border-red-100 line-clamp-2" title={batch.summary.error}>
                        {batch.summary.error}
                      </div>
                    )}

                    {batch.summary && (
                      <div className="flex gap-2 text-[10px] text-slate-500 font-medium bg-white border border-slate-100 rounded px-2 py-1">
                        <span className="text-slate-700">T: {batch.summary.total ?? 0}</span>
                        <span className="text-amber-600">P: {batch.summary.pending ?? 0}</span>
                        <span className="text-emerald-600">C: {batch.summary.completed ?? 0}</span>
                        <span className="text-rose-600">B: {batch.summary.blocked ?? 0}</span>
                        <span className="text-red-600">F: {batch.summary.failed ?? 0}</span>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </CardContent>
          </Card>

          {/* Batch Details & Recipients Panel */}
          <Card className="lg:col-span-8 shadow-sm border-slate-200 flex flex-col h-[750px] overflow-hidden">
            {!selectedBatch ? (
               <div className="h-full flex flex-col items-center justify-center text-sm text-slate-400 p-6">
                 <Info className="w-12 h-12 text-slate-200 mb-4" />
                 Select a batch from the left to view its detailed audit logs and recipients.
               </div>
            ) : (
              <>
                {/* Batch Header Drawer / Panel */}
                <CardHeader className="p-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            Batch Details
                            <Badge variant="outline" className={`${getStatusColor(selectedBatch.status)} capitalize text-xs ml-2`}>
                              {selectedBatch.status}
                            </Badge>
                         </h2>
                         <div className="text-xs font-mono text-slate-500 mt-1 space-y-1">
                            <div>Batch ID: <span className="text-slate-700">{selectedBatch.id}</span></div>
                            <div>Workflow ID: <span className="text-slate-700">{selectedBatch.workflow_id}</span></div>
                         </div>
                      </div>
                      
                      {selectedBatch.status === 'pending_approval' && (
                        <Button 
                          size="sm" 
                          onClick={() => handleApproveBatch(selectedBatch.id)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Batch
                        </Button>
                      )}
                   </div>

                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white p-3 rounded-md border border-slate-100 shadow-sm">
                         <div className="text-[10px] uppercase font-bold text-slate-400">Total</div>
                         <div className="text-lg font-bold text-slate-700">{selectedBatch.summary?.total ?? 0}</div>
                      </div>
                      <div className="bg-white p-3 rounded-md border border-slate-100 shadow-sm">
                         <div className="text-[10px] uppercase font-bold text-slate-400">Pending</div>
                         <div className="text-lg font-bold text-amber-600">{selectedBatch.summary?.pending ?? 0}</div>
                      </div>
                      <div className="bg-white p-3 rounded-md border border-slate-100 shadow-sm">
                         <div className="text-[10px] uppercase font-bold text-slate-400">Completed / Blocked</div>
                         <div className="text-lg font-bold text-slate-700">
                           <span className="text-emerald-600">{selectedBatch.summary?.completed ?? 0}</span> / <span className="text-rose-600">{selectedBatch.summary?.blocked ?? 0}</span>
                         </div>
                      </div>
                      <div className="bg-white p-3 rounded-md border border-slate-100 shadow-sm">
                         <div className="text-[10px] uppercase font-bold text-slate-400">Failed</div>
                         <div className="text-lg font-bold text-red-600">{selectedBatch.summary?.failed ?? 0}</div>
                      </div>
                   </div>

                   <div className="bg-white border border-slate-200 rounded-md p-3 text-xs flex flex-wrap gap-x-6 gap-y-2 text-slate-600">
                      <div><span className="font-semibold text-slate-400">Created:</span> {new Date(selectedBatch.created_at).toLocaleString()}</div>
                      <div><span className="font-semibold text-slate-400">Updated:</span> {new Date(selectedBatch.updated_at).toLocaleString()}</div>
                      {selectedBatch.completed_at && (
                        <div><span className="font-semibold text-slate-400">Completed:</span> {new Date(selectedBatch.completed_at).toLocaleString()}</div>
                      )}
                      {selectedBatch.approved_by && (
                        <div className="w-full mt-1 pt-1 border-t border-slate-100 flex flex-wrap gap-x-6">
                          <div><span className="font-semibold text-slate-400">Approved By:</span> <span className="font-mono">{selectedBatch.approved_by}</span></div> 
                          <div><span className="font-semibold text-slate-400">At:</span> {selectedBatch.approved_at ? new Date(selectedBatch.approved_at).toLocaleString() : ''}</div>
                        </div>
                      )}
                   </div>

                   {selectedBatch.status === 'failed' && selectedBatch.summary?.error && (
                     <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2 text-red-800">
                       <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                       <div className="text-xs">
                         <div className="font-bold mb-1">Batch Failure Reason</div>
                         <div className="font-mono bg-white/50 p-1 rounded">{selectedBatch.summary.error}</div>
                       </div>
                     </div>
                   )}
                </CardHeader>
                
                {/* Recipients List */}
                <div className="bg-white px-4 py-2 border-b border-slate-100 flex justify-between items-center shrink-0">
                   <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                     <Users className="w-4 h-4 text-slate-400" /> Recipients List
                   </h3>
                   <div className="relative">
                      <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                      <Input 
                        placeholder="Search email or phone..."
                        className="pl-7 h-7 text-xs w-56"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                      />
                   </div>
                </div>

                <CardContent className="p-0 overflow-y-auto flex-1 bg-slate-50/30">
                  {filteredRecipients.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      {recipientSearch ? "No recipients match your search." : "No recipients found for this batch."}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredRecipients.map((rec) => (
                        <div key={rec.id} className="p-4 hover:bg-white transition-colors bg-white/50">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`${getStatusColor(rec.status)} capitalize text-[10px]`}>
                                  {rec.status}
                                </Badge>
                                <span className="font-semibold text-sm text-slate-900">
                                  {rec.recipient_email || rec.recipient_phone || 'Unknown Contact'}
                                </span>
                                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                                  {rec.channel} | {rec.provider}
                                </Badge>
                                {rec.attempt_count > 0 && (
                                  <Badge variant="outline" className="text-[9px] text-slate-500 bg-slate-50">
                                    Attempts: {rec.attempt_count}
                                  </Badge>
                                )}
                              </div>

                              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span><strong className="text-slate-400">Exec at:</strong> {new Date(rec.execute_at).toLocaleString()}</span>
                                {rec.send_job_id && (
                                  <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    <CheckCircle2 className="w-3 h-3" /> Job ID: {rec.send_job_id.substring(0,8)}...
                                  </span>
                                )}
                              </div>

                              {/* Error Display */}
                              {rec.last_error && (
                                <div className="mt-2 bg-red-50 border border-red-100 rounded-md p-2 flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                  <div className="space-y-1 w-full">
                                    <p className="text-xs font-semibold text-red-800">Delivery / Provider Error</p>
                                    <p className="text-[11px] text-red-700 font-mono bg-white/50 p-1 rounded break-all">{rec.last_error}</p>
                                  </div>
                                </div>
                              )}

                              {/* Safety / Consent Info Block */}
                              <div className="mt-2 grid grid-cols-1 xl:grid-cols-2 gap-2">
                                {rec.safety_result && (
                                  <div className={`border rounded-md p-2.5 flex items-start gap-2 ${rec.safety_result.allowed !== false ? 'bg-slate-50 border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
                                    {rec.safety_result.allowed !== false ? (
                                      <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    ) : (
                                      <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                                    )}
                                    <div className="space-y-1 text-xs">
                                      <p className={`font-semibold ${rec.safety_result.allowed !== false ? 'text-slate-600' : 'text-rose-800'}`}>
                                        Safety Check: {rec.safety_result.allowed !== false ? 'Passed' : 'Blocked'}
                                      </p>
                                      {rec.safety_result.reasons && rec.safety_result.reasons.length > 0 && (
                                        <ul className="text-[11px] list-disc list-inside text-rose-700">
                                          {rec.safety_result.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                                        </ul>
                                      )}
                                      {rec.safety_result.automation && (
                                         <p className="text-[10px] text-slate-500 italic mt-1 border-t border-slate-100 pt-1">
                                            {rec.safety_result.automation.mode} | {rec.safety_result.automation.reason}
                                         </p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {rec.consent_result && (
                                  <div className={`border rounded-md p-2.5 flex items-start gap-2 ${rec.consent_result.allowed !== false ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                    {rec.consent_result.allowed !== false ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                    ) : (
                                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    )}
                                    <div className="space-y-1 text-xs">
                                      <p className={`font-semibold ${rec.consent_result.allowed !== false ? 'text-emerald-700' : 'text-amber-800'}`}>
                                        Consent Gate: {rec.consent_result.allowed !== false ? 'Allowed' : 'Blocked'}
                                      </p>
                                      {rec.consent_result.reason && (
                                         <p className={`text-[10px] ${rec.consent_result.allowed !== false ? 'text-emerald-600' : 'text-amber-700'}`}>
                                            {rec.consent_result.reason}
                                         </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
        
        {/* Cancel Confirmation Modal */}
        <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Batch</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this batch? It will no longer be processed. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>No, Keep it</Button>
              <Button variant="destructive" onClick={handleCancelBatch}>Yes, Cancel Batch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  )
}
