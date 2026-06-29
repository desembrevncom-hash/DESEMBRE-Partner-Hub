import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Send, ShieldCheck, AlertTriangle, Play, X, Search, CheckCircle, Activity, Mail, XCircle, Clock } from "lucide-react";
import { createSendJob, executeSendJob, markJobApproved, reevaluateJobSafety } from "@/lib/marketing/sendGateway";
import { Badge } from "@/components/ui/badge";
import { buildDeliveryTimeline, TimelineNode } from "@/lib/marketing/timelineBuilder";

export const Route = createFileRoute("/marketing/send-gateway")({
  component: SendGatewayPage,
});

function SendGatewayPage() {
  const [safetySettings, setSafetySettings] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [userRole, setUserRole] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [testIdempotencyKey, setTestIdempotencyKey] = useState("");
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedJobEvents, setSelectedJobEvents] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    checkRole();
  }, []);

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      setUserRole(data?.role || null);
    }
  };

  const isAdminOrSubAdmin = userRole === "admin" || userRole === "sub_admin";

  const fetchData = async () => {
    setLoading(true);
    const { data: settings } = await supabase.from("marketing_ops_safety_settings").select("*").eq("is_default", true).single();
    setSafetySettings(settings);

    let query = supabase.from("marketing_send_jobs").select("*").order("created_at", { ascending: false }).limit(50);
    const { data: recentJobs } = await query;
    if (recentJobs) setJobs(recentJobs);
    
    setLoading(false);
  };

  const handleTestSend = async () => {
    try {
      const params: any = {
        channel: "email",
        provider: "mock",
        recipient_email: "test@desembre.vn",
        payload: { message: "Test execution from gateway UI" },
      };
      if (testIdempotencyKey.trim()) {
        params.idempotency_key = testIdempotencyKey.trim();
      }

      const { job } = await createSendJob(params);
      if (job.status === "queued") {
        await executeSendJob(job.id);
      }
      setIsCreateModalOpen(false);
      setTestIdempotencyKey("");
      fetchData();
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  };

  const handleMarkApproved = async (jobId: string) => {
    if (!isAdminOrSubAdmin) return;
    try {
      await markJobApproved(jobId);
      alert("Job marked as approved");
      fetchData();
      setSelectedJob(null);
    } catch (error: any) {
      alert("Error approving: " + error.message);
    }
  };

  const handleRecheckSafety = async (jobId: string) => {
    if (!isAdminOrSubAdmin) return;
    try {
      const { allowed } = await reevaluateJobSafety(jobId);
      alert(allowed ? "Safety Re-check Passed! Job is now queued." : "Safety Re-check Failed. Still blocked.");
      fetchData();
      setSelectedJob(null);
    } catch (error: any) {
      alert("Error re-evaluating: " + error.message);
    }
  };

  const handleExecuteSandbox = async (jobId: string) => {
    if (!isAdminOrSubAdmin) return;
    try {
      const { data, error } = await supabase.functions.invoke("marketing-sandbox-send", {
        body: { job_id: jobId }
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.message || data.code || "Unknown sandbox error");
      }
      alert("Sandbox execution finished successfully: " + JSON.stringify(data));
      fetchData();
      if (selectedJob && selectedJob.id === jobId) {
        handleJobSelect(selectedJob); // Refresh the current job
      }
    } catch (error: any) {
      alert("Sandbox execution failed: " + error.message);
    }
  };

  const handleJobSelect = async (job: any) => {
    if (!job) {
      setSelectedJob(null);
      setSelectedJobEvents([]);
      return;
    }
    setSelectedJob(job);
    setSelectedJobEvents([]);
    const { data } = await supabase.from("marketing_send_job_events")
      .select("*")
      .eq("job_id", job.id)
      .order("occurred_at", { ascending: true });
    
    // In case the user clicked a different job while loading
    setSelectedJobEvents(data || []);
  };

  const filteredJobs = jobs.filter(job => {
    if (filterStatus !== "all" && job.status !== filterStatus) return false;
    if (filterChannel !== "all" && job.channel !== filterChannel) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!job.recipient_email?.toLowerCase().includes(q) &&
          !job.recipient_phone?.toLowerCase().includes(q) &&
          !job.idempotency_key?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  if (loading && jobs.length === 0) return <div className="p-8">Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl font-sans relative">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="w-8 h-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Send Gateway QA (M18)</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
            Hardening & Approval Console
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-amber-900">QA Hardening Active</h3>
          </div>
          <p className="text-sm text-amber-800 font-medium max-w-xl">
            Real provider execution is blocked. All jobs default to mock provider.
            Use this console to test idempotency, safety evaluations, and approval workflows safely.
          </p>
        </div>
        <div className="flex gap-4 shrink-0">
          <div className="bg-white px-4 py-2 rounded-xl border border-amber-100 shadow-sm text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Kill Switch</p>
            {safetySettings?.global_kill_switch ? (
              <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none font-bold">ON (BLOCKED)</Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold">OFF (LIVE)</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-blue-900">Staging Sandbox Only</h3>
          </div>
          <p className="text-sm text-blue-800 font-medium max-w-xl">
            Controlled Sandbox Provider Execution Phase 2. Sandbox sends are strictly isolated and routed through Edge Functions. No Production sends allowed.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-4">
          <div className="flex gap-3 items-center">
            <select 
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="safety_blocked">Safety Blocked</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <select 
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
              value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
            >
              <option value="all">All Channels</option>
              <option value="email">Email</option>
              <option value="zalo">Zalo</option>
            </select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search recipient or key..." 
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-64"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 font-bold h-9">
            <Play className="w-4 h-4 mr-2 fill-current" /> Create Safe Test Job
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-white border-b border-slate-100 text-xs uppercase text-slate-400 font-black tracking-wider">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Idempotency Key</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleJobSelect(job)}>
                  <td className="px-6 py-4">
                    {job.status === "safety_blocked" ? (
                      <Badge className="bg-rose-100 text-rose-700 border-none font-bold">Safety Blocked</Badge>
                    ) : job.status === "queued" ? (
                      <Badge className="bg-amber-100 text-amber-700 border-none font-bold">Queued</Badge>
                    ) : job.status === "sent" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">Sent</Badge>
                    ) : (
                      <Badge variant="outline" className="font-bold">{job.status}</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    {job.recipient_email || job.recipient_phone || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                    {job.idempotency_key?.substring(0, 16)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {new Date(job.created_at).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800">View Details</Button>
                  </td>
                </tr>
              ))}
              {filteredJobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-medium">
                    No send jobs match your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE JOB MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create Test Job</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Custom Idempotency Key (Optional)</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" 
                  placeholder="Leave blank for random"
                  value={testIdempotencyKey}
                  onChange={e => setTestIdempotencyKey(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">Test idempotency by reusing the same key twice.</p>
              </div>
              <Button onClick={handleTestSend} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10">
                Execute Safe Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* JOB DETAIL MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-black">Job Details</h2>
                  <Badge variant="outline">{selectedJob.status}</Badge>
                </div>
                <p className="text-slate-500 text-sm font-mono">{selectedJob.id}</p>
              </div>
              <button onClick={() => handleJobSelect(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Idempotency Key</p>
                <p className="text-sm font-mono text-slate-700 break-all">{selectedJob.idempotency_key}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Recipient</p>
                <p className="text-sm text-slate-700">{selectedJob.recipient_email || selectedJob.recipient_phone || "N/A"}</p>
              </div>
            </div>

            <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Delivery Timeline
                </h3>
              </div>
              <div className="p-6 bg-white relative">
                {/* Vertical line */}
                <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-slate-100 z-0"></div>
                
                <div className="space-y-6 relative z-10">
                  {buildDeliveryTimeline(selectedJob, selectedJobEvents).map((node, index) => (
                    <div key={node.id} className="flex gap-4">
                      <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${
                        node.eventType === "created" ? "bg-slate-100 text-slate-500" :
                        node.eventType === "safety_blocked" ? "bg-rose-100 text-rose-600" :
                        node.eventType === "approved" ? "bg-emerald-100 text-emerald-600" :
                        node.eventType === "sending" ? "bg-blue-100 text-blue-600" :
                        node.eventType === "sent" ? "bg-emerald-100 text-emerald-600" :
                        node.eventType === "failed" || node.eventType === "bounced" || node.eventType === "complained" ? "bg-red-100 text-red-600" :
                        "bg-indigo-100 text-indigo-600"
                      }`}>
                        {node.eventType === "created" && <Clock className="w-4 h-4" />}
                        {node.eventType === "safety_blocked" && <ShieldAlert className="w-4 h-4" />}
                        {node.eventType === "approved" && <CheckCircle className="w-4 h-4" />}
                        {node.eventType === "sending" && <Play className="w-4 h-4" />}
                        {node.eventType === "sent" && <Send className="w-4 h-4" />}
                        {node.eventType === "failed" && <XCircle className="w-4 h-4" />}
                        {(node.eventType === "delivered" || node.eventType === "opened" || node.eventType === "clicked") && <Mail className="w-4 h-4" />}
                        {(node.eventType === "bounced" || node.eventType === "complained") && <AlertTriangle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-slate-800 capitalize flex items-center gap-2">
                            {node.eventType.replace("_", " ")}
                            {node.isSandbox && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none text-[10px] uppercase font-bold py-0 h-4">Sandbox</Badge>}
                          </p>
                          <span className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded">
                            {new Date(node.occurredAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        {node.providerMessageId && (
                          <p className="text-xs text-slate-500 font-mono mt-1">Provider ID: {node.providerMessageId}</p>
                        )}
                        {node.providerErrorMessage && (
                          <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded-lg border border-red-100 break-words font-mono text-xs">
                            {node.providerErrorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {buildDeliveryTimeline(selectedJob, selectedJobEvents).length === 0 && (
                    <div className="text-center text-slate-400 text-sm py-4">No events found.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Safety Result
                </h4>
                <pre className="bg-slate-900 text-slate-50 p-4 rounded-xl text-xs overflow-auto">
                  {JSON.stringify(selectedJob.safety_result, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Send className="w-4 h-4" /> Payload
                </h4>
                <pre className="bg-slate-900 text-slate-50 p-4 rounded-xl text-xs overflow-auto">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex gap-3 justify-end">
              {isAdminOrSubAdmin && selectedJob.status === "safety_blocked" && (
                <Button onClick={() => handleRecheckSafety(selectedJob.id)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold">
                  Re-check Safety
                </Button>
              )}
              {isAdminOrSubAdmin && !selectedJob.approved_at && (
                <Button onClick={() => handleMarkApproved(selectedJob.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  <CheckCircle className="w-4 h-4 mr-2" /> Mark Approved for QA
                </Button>
              )}
              {isAdminOrSubAdmin && selectedJob.approved_at && (selectedJob.status === "queued" || selectedJob.status === "safety_blocked") && (
                <Button onClick={() => handleExecuteSandbox(selectedJob.id)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  <Play className="w-4 h-4 mr-2 fill-current" /> Execute Sandbox
                </Button>
              )}
              {!isAdminOrSubAdmin && (
                <p className="text-xs text-slate-400 italic self-center mr-2">Approval actions restricted to Admins.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
