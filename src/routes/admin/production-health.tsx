import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ShieldAlert, Activity, AlertTriangle, RefreshCw, Server, Search, CheckCircle2, Play, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { getFriendlyErrorMessage } from "@/lib/errorMessages";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/production-health")({
  component: ProductionHealthPage,
});

function ProductionHealthPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [retries, setRetries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({ ai_enabled: true, automation_enabled: true, pilot_mode: true });
  const [testingEdge, setTestingEdge] = useState(false);

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      const [errorRes, retryRes, sysRes] = await Promise.all([
        supabase.from('app_error_logs' as any).select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('client_retry_queue' as any).select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('system_settings').select('*').maybeSingle()
      ]);

      if (errorRes.data) setLogs(errorRes.data);
      if (retryRes.data) setRetries(retryRes.data);
      if (sysRes.data) setSettings(sysRes.data);
    } catch (e) {
      console.error(e);
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const handleTestEdge = async (funcName: string) => {
    setTestingEdge(true);
    toast.info(`Ping ${funcName}...`);
    try {
      // Simulate edge function call for manual test
      const res = await supabase.functions.invoke(funcName, {
        body: { test: true }
      });
      if (res.error) throw res.error;
      toast.success(`${funcName} hoạt động bình thường!`);
    } catch (e: any) {
      // If the function throws 400 or 403, it means the function is actually alive and reachable.
      const errorMsg = e.message || '';
      if (errorMsg.includes('non-2xx status code') || errorMsg.includes('400') || errorMsg.includes('403')) {
        toast.success(`${funcName} phản hồi bình thường (Alive)!`);
      } else {
        toast.error(`Lỗi kết nối ${funcName}: ${getFriendlyErrorMessage(e)}`);
      }
    } finally {
      setTestingEdge(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
            Production Health
          </h1>
          <p className="text-slate-500 font-medium mt-1">Giám sát tính ổn định hệ thống, lỗi Runtime và hàng chờ khôi phục.</p>
        </div>
        <Button onClick={fetchHealthData} disabled={loading} className="gap-2 bg-slate-900 text-white rounded-xl">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới dữ liệu
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SAFE MODE CHECKLIST */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-emerald-500" />
              Safe Mode Checklist
            </h3>
            <div className="space-y-3 text-sm font-medium">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">AI Modules</span>
                {settings.ai_enabled !== false ? <Badge className="bg-emerald-100 text-emerald-700">Enabled</Badge> : <Badge className="bg-slate-100 text-slate-500">Disabled</Badge>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Automation Engine</span>
                {settings.automation_enabled !== false ? <Badge className="bg-emerald-100 text-emerald-700">Enabled</Badge> : <Badge className="bg-slate-100 text-slate-500">Disabled</Badge>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Pilot Mode UX</span>
                {settings.pilot_mode !== false ? <Badge className="bg-blue-100 text-blue-700">Active</Badge> : <Badge className="bg-slate-100 text-slate-500">Off</Badge>}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Server className="w-4 h-4 text-indigo-500" />
              Edge Functions
            </h3>
            <div className="space-y-2">
              <Button onClick={() => handleTestEdge('test-ai-connection')} disabled={testingEdge} variant="outline" className="w-full justify-start text-xs font-bold gap-2">
                <Terminal className="w-3 h-3 text-slate-400" /> Ping test-ai-connection
              </Button>
              <Button onClick={() => handleTestEdge('ai-customer-suggestions')} disabled={testingEdge} variant="outline" className="w-full justify-start text-xs font-bold gap-2">
                <Terminal className="w-3 h-3 text-slate-400" /> Ping ai-customer-suggestions
              </Button>
              <Button onClick={() => handleTestEdge('resolve-contact-channel')} disabled={testingEdge} variant="outline" className="w-full justify-start text-xs font-bold gap-2">
                <Terminal className="w-3 h-3 text-slate-400" /> Ping resolve-contact-channel
              </Button>
            </div>
          </div>
        </div>

        {/* LOGS */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-rose-500" />
              Recent Runtime Errors
            </h3>
            {logs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-medium flex flex-col items-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                Không có lỗi Runtime nào gần đây
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log: any) => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-slate-800 text-sm">{log.error_type}</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {format(new Date(log.created_at), "HH:mm dd/MM/yyyy", { locale: vi })}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 break-words font-medium">{log.error_message}</div>
                    <div className="flex gap-2 items-center text-[10px] text-slate-400 mt-1">
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Page: {log.page_key}</span>
                      {log.user_id && <span className="bg-white px-2 py-0.5 rounded border border-slate-200">User: {log.user_id.slice(0,8)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Client Retry Queue (Pending / Failed)
            </h3>
            {retries.length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-medium">
                Hàng chờ đang trống
              </div>
            ) : (
              <div className="space-y-3">
                {retries.map((r: any) => (
                  <div key={r.id} className="p-3 bg-amber-50/30 rounded-xl border border-amber-100 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        {r.action_type}
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${r.status === 'failed' ? 'bg-rose-100 text-rose-700 border-none' : 'bg-amber-100 text-amber-700 border-none'}`}>
                          {r.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{r.last_error || 'Đang chờ xử lý lại...'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400 mb-1">{format(new Date(r.created_at), "HH:mm dd/MM")}</div>
                      <Button variant="ghost" size="sm" className="h-6 text-xs bg-white border border-slate-200">Retry Now</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
