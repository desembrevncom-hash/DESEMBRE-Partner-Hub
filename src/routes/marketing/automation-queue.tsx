import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, RefreshCw, Play, ShieldAlert, CheckCircle2, Clock, AlertTriangle, Info, Plus } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute("/marketing/automation-queue")({
  component: AutomationQueuePage,
})

interface RunBatch {
  id: string
  workflow_id: string
  status: string
  execution_mode: string
  created_at: string
  scheduled_for: string | null
  completed_at: string | null
  summary: { total?: number; completed?: number; blocked?: number; failed?: number } | null
}

interface RunRecipient {
  id: string
  batch_id: string
  recipient_email: string | null
  recipient_phone: string | null
  channel: string
  status: string
  safety_result: any
  send_job_id: string | null
  execute_at: string
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'blocked': return 'bg-rose-100 text-rose-700 border-rose-200'
    case 'failed': return 'bg-red-100 text-red-700 border-red-200'
    case 'skipped': return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'approved': return 'bg-violet-100 text-violet-700 border-violet-200'
    case 'pending_approval': return 'bg-amber-100 text-amber-700 border-amber-200'
    default: return 'bg-slate-100 text-slate-700 border-slate-200' // pending, draft
  }
}

function AutomationQueuePage() {
  const [batches, setBatches] = useState<RunBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [recipients, setRecipients] = useState<RunRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

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

      if (selectedBatch) {
        await loadRecipients(selectedBatch)
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
    setSelectedBatch(batchId)
    loadRecipients(batchId)
  }

  const handleApproveBatch = async (batchId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("No active session")

      const { error } = await supabase
        .from('marketing_automation_run_batches')
        .update({
          status: 'approved',
          approved_by: session.user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', batchId)
        .eq('status', 'pending_approval') // Only approve if pending

      if (error) throw error

      toast.success('Batch Approved', { description: 'Batch is now ready for processing.' })
      await fetchData()
    } catch (e: any) {
      console.error(e)
      toast.error('Approval Failed', { description: e.message })
    }
  }

  const handleProcessQueue = async () => {
    setProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke('process-automation-queue', {
        body: { limit_count: 50 }
      })
      
      if (error) {
        throw new Error(error.message || `Edge function error`)
      }

      toast.success('Queue Processed', {
        description: `Successfully processed ${data?.processed || 0} recipients.`,
      })
      
      // Refresh data
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-violet-600" />
              M42.3 Admin QA Console
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manual Staging Execution Runner (Mock Provider Only)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/marketing/automation/new-run">
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                New Run
              </Button>
            </Link>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Batches Panel */}
          <Card className="lg:col-span-1 shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Recent Run Batches
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {batches.length === 0 && !loading && (
                <div className="p-6 text-center text-sm text-slate-500">No batches found.</div>
              )}
              <div className="divide-y divide-slate-100">
                {batches.map((batch) => (
                  <div 
                    key={batch.id}
                    onClick={() => handleSelectBatch(batch.id)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedBatch === batch.id ? 'bg-violet-50/50 relative' : ''}`}
                  >
                    {selectedBatch === batch.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-r" />
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs font-mono text-slate-500">
                        {batch.id.split('-')[0]}...
                      </div>
                      <Badge variant="outline" className={`${getStatusColor(batch.status)} capitalize text-[10px]`}>
                        {batch.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-none">
                        {batch.execution_mode}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {new Date(batch.created_at).toLocaleDateString()} {new Date(batch.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {batch.summary && (
                      <div className="flex gap-2 text-[10px] text-slate-500 font-medium bg-white border border-slate-100 rounded px-2 py-1">
                        <span className="text-slate-700">T: {batch.summary.total || 0}</span>
                        <span className="text-emerald-600">C: {batch.summary.completed || 0}</span>
                        <span className="text-rose-600">B: {batch.summary.blocked || 0}</span>
                        <span className="text-red-600">F: {batch.summary.failed || 0}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recipients Panel */}
          <Card className="lg:col-span-2 shadow-sm border-slate-200 flex flex-col h-[600px] overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400" />
                  Batch Recipients
                </CardTitle>
                <div className="flex items-center gap-2">
                  {selectedBatch && batches.find(b => b.id === selectedBatch)?.status === 'pending_approval' && (
                    <Button 
                      size="sm" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-3"
                      onClick={() => handleApproveBatch(selectedBatch)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve Batch
                    </Button>
                  )}
                  {selectedBatch && (
                    <span className="text-xs font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                      {selectedBatch}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {!selectedBatch ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 p-6">
                  Select a batch from the left to view its queued recipients.
                </div>
              ) : recipients.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No recipients found for this batch.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recipients.map((rec) => (
                    <div key={rec.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${getStatusColor(rec.status)} capitalize text-[10px]`}>
                              {rec.status}
                            </Badge>
                            <span className="font-medium text-sm text-slate-900">
                              {rec.recipient_email || rec.recipient_phone || 'Unknown Contact'}
                            </span>
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                              {rec.channel}
                            </Badge>
                          </div>

                          <div className="text-xs text-slate-500 flex items-center gap-4">
                            <span>Execute at: {new Date(rec.execute_at).toLocaleString()}</span>
                            {rec.send_job_id && (
                              <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                <CheckCircle2 className="w-3 h-3" /> Job ID: {rec.send_job_id.split('-')[0]}...
                              </span>
                            )}
                          </div>

                          {/* Safety Reason Block */}
                          {rec.safety_result && rec.safety_result.allowed === false && (
                            <div className="mt-2 bg-rose-50 border border-rose-100 rounded-md p-2.5 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-rose-800">Safety / Consent Blocked</p>
                                <ul className="text-[11px] text-rose-700 list-disc list-inside">
                                  {rec.safety_result.reasons?.map((r: string, i: number) => (
                                    <li key={i}>{r}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          {/* Mock Job Info */}
                          {rec.safety_result && rec.safety_result.allowed === true && (
                            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-md p-2.5 flex items-start gap-2">
                              <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <p className="text-[11px] text-slate-600 font-mono">
                                  Mode: {rec.safety_result.automation?.mode} | 
                                  Runner: {rec.safety_result.automation?.runner}
                                </p>
                                <p className="text-[10px] text-slate-500 italic">
                                  {rec.safety_result.automation?.reason}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
