import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Send, ShieldCheck, XCircle, AlertTriangle, Play } from "lucide-react";
import { createSendJob, executeSendJob } from "@/lib/marketing/sendGateway";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/marketing/send-gateway")({
  component: SendGatewayPage,
});

function SendGatewayPage() {
  const [safetySettings, setSafetySettings] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch settings
    const { data: settings } = await supabase
      .from("marketing_ops_safety_settings")
      .select("*")
      .eq("is_default", true)
      .single();
    setSafetySettings(settings);

    // Fetch jobs
    const { data: recentJobs } = await supabase
      .from("marketing_send_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (recentJobs) setJobs(recentJobs);
    
    setLoading(false);
  };

  const handleTestSend = async () => {
    try {
      const { job } = await createSendJob({
        channel: "email",
        provider: "mock",
        recipient_email: "test@desembre.vn",
        payload: { message: "Test execution from gateway UI" },
      });
      
      if (job.status === "queued") {
        await executeSendJob(job.id);
      }
      
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Error triggering test send");
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl font-sans">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="w-8 h-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Send Gateway (M17)</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
            Controlled Provider Execution
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-amber-900">Controlled Gateway</h3>
          </div>
          <p className="text-sm text-amber-800 font-medium">
            Real provider execution is blocked unless all M16 safety gates pass. 
            Do not use for production sending yet.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-xl border border-amber-100 shadow-sm text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Kill Switch</p>
            {safetySettings?.global_kill_switch ? (
              <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none font-bold">ON (BLOCKED)</Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold">OFF (LIVE)</Badge>
            )}
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-amber-100 shadow-sm text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Channels</p>
            <div className="flex gap-1 justify-center">
              <Badge variant="outline" className={safetySettings?.email_enabled ? "text-emerald-600" : "text-rose-500"}>
                Email: {safetySettings?.email_enabled ? "ON" : "OFF"}
              </Badge>
              <Badge variant="outline" className={safetySettings?.zalo_enabled ? "text-emerald-600" : "text-rose-500"}>
                Zalo: {safetySettings?.zalo_enabled ? "ON" : "OFF"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-800">Recent Send Jobs</h2>
          <Button onClick={handleTestSend} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 font-bold h-9">
            <Play className="w-4 h-4 mr-2 fill-current" /> Create Safe Test Job
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-white border-b border-slate-100 text-xs uppercase text-slate-400 font-black tracking-wider">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Channel / Provider</th>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Safety Result</th>
                <th className="px-6 py-4">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    {job.status === "safety_blocked" ? (
                      <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none font-bold">Safety Blocked</Badge>
                    ) : job.status === "queued" ? (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-bold">Queued</Badge>
                    ) : job.status === "sent" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold">Sent</Badge>
                    ) : (
                      <Badge variant="outline" className="font-bold">{job.status}</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    <div className="flex items-center gap-1.5 uppercase text-xs font-bold">
                      {job.channel}
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500">{job.provider}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {job.recipient_email || job.recipient_phone || job.customer_id || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {job.safety_result?.reasons?.length > 0 ? (
                      <div className="text-rose-600 font-medium">
                        {job.safety_result.reasons[0]}
                        {job.safety_result.reasons.length > 1 && ` (+${job.safety_result.reasons.length - 1} more)`}
                      </div>
                    ) : (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Allowed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {new Date(job.created_at).toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-medium">
                    No send jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
