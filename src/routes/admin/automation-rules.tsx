import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  ShieldAlert, 
  RefreshCw, 
  Play, 
  Activity, 
  Zap,
  CheckCircle2,
  XCircle,
  FileText,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export const Route = createFileRoute("/admin/automation-rules")({
  component: AutomationRulesMVPPage,
});

function AutomationRulesMVPPage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const isAuthorized = isAdmin || isSubAdmin;

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase.rpc("get_automation_rules_summary");
      if (error) throw error;
      setRules(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải danh sách Rules: " + err.message);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("automation_run_logs")
        .select(`*, rule:automation_rules(name)`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchRules(), fetchLogs()]);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (user && isAuthorized) {
      loadData();
    }
  }, [user, isAuthorized, authLoading]);

  const toggleRuleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("automation_rules")
        .update({ is_active: !currentStatus })
        .eq("id", ruleId);

      if (error) throw error;
      
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !currentStatus } : r));
      toast.success("Đã cập nhật trạng thái Rule.");
    } catch (err: any) {
      toast.error("Lỗi cập nhật: " + err.message);
    }
  };

  const runRule = async (ruleId: string) => {
    try {
      setRunningRuleId(ruleId);
      const { data, error } = await supabase.rpc("run_automation_rule", { p_rule_id: ruleId });
      if (error) throw error;

      if (data?.success) {
        toast.success(`Chạy thành công! Đã tạo ${data.action_count} actions trên ${data.matched_count} bản ghi.`);
      } else {
        toast.error("Không thể chạy: " + data?.error_message);
      }
    } catch (err: any) {
      toast.error("System Error: " + err.message);
    } finally {
      setRunningRuleId(null);
      loadData(); // refresh rules summary and logs
    }
  };

  const runAllActiveRules = async () => {
    try {
      setRunningAll(true);
      const { data, error } = await supabase.rpc("run_active_automation_rules");
      if (error) throw error;

      toast.success(`Đã chạy thành công ${data?.rules_run || 0} active rules!`);
    } catch (err: any) {
      toast.error("System Error: " + err.message);
    } finally {
      setRunningAll(false);
      loadData();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Permission Denied</h2>
        <p className="text-slate-500 text-sm mt-2">Bạn không có quyền truy cập Automation Rules MVP.</p>
        <Link to="/workspace" className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold">
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-indigo-400" />
                <h1 className="text-xl font-black uppercase tracking-widest text-slate-100">Automation Rules</h1>
                <Badge className="bg-amber-500 text-white border-none ml-2 text-[9px] uppercase">MVP</Badge>
              </div>
              <p className="text-slate-400 text-sm font-medium max-w-xl leading-relaxed">
                Nền tảng Tự động hóa CRM đơn giản. Tự động sinh công việc (Tasks) và Thông báo (Notifications) theo kịch bản.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={loadData}
                disabled={loading}
                className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
              <Button 
                onClick={runAllActiveRules}
                disabled={loading || runningAll}
                className="bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/50"
              >
                {runningAll ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Run All Active
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rules List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Danh sách Rules
          </h2>
          
          {loading && rules.length === 0 ? (
            <div className="py-20 flex justify-center"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
          ) : rules.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center shadow-sm">
              <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Chưa có Rule nào được khởi tạo.</p>
            </div>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} className="border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                <CardHeader className="bg-white pb-4 border-b border-slate-50 flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-3">
                      {rule.name}
                      {!rule.is_active && <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] uppercase">Inactive</Badge>}
                    </CardTitle>
                    <CardDescription className="text-xs font-medium text-slate-500 line-clamp-2 max-w-lg">
                      {rule.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 pl-4">
                    <Switch 
                      checked={rule.is_active} 
                      onCheckedChange={() => toggleRuleActive(rule.id, rule.is_active)} 
                    />
                    <Button 
                      size="sm" 
                      onClick={() => runRule(rule.id)}
                      disabled={runningRuleId === rule.id || !rule.is_active}
                      className="bg-slate-900 text-white hover:bg-slate-800 h-8 text-xs font-bold w-[100px]"
                    >
                      {runningRuleId === rule.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                      Run Now
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="bg-slate-50/50 pt-4 flex flex-wrap gap-4 items-center">
                   <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex flex-col gap-1 shadow-sm">
                     <span className="text-[9px] font-black uppercase text-slate-400">Trigger</span>
                     <span className="text-xs font-bold text-slate-700">{rule.trigger_type}</span>
                   </div>
                   <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex flex-col gap-1 shadow-sm">
                     <span className="text-[9px] font-black uppercase text-slate-400">Action</span>
                     <span className="text-xs font-bold text-indigo-600">{rule.action_type}</span>
                   </div>
                   <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex flex-col gap-1 shadow-sm flex-1 min-w-[200px]">
                     <span className="text-[9px] font-black uppercase text-slate-400">Lần chạy gần nhất</span>
                     <div className="flex items-center justify-between">
                       <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                          {rule.last_run_at ? (
                            <>
                              <Clock className="w-3 h-3 text-slate-400" />
                              {formatDistanceToNow(new Date(rule.last_run_at), { addSuffix: true, locale: vi })}
                            </>
                          ) : "Chưa từng chạy"}
                       </span>
                       {rule.last_status && (
                         <span className="flex items-center gap-1">
                           {rule.last_status === 'success' ? (
                             <Badge className="bg-emerald-50 text-emerald-600 border-none px-1.5 py-0 rounded text-[9px]"><CheckCircle2 className="w-3 h-3 mr-1"/> Success</Badge>
                           ) : (
                             <Badge className="bg-rose-50 text-rose-600 border-none px-1.5 py-0 rounded text-[9px]"><XCircle className="w-3 h-3 mr-1"/> Failed</Badge>
                           )}
                           {rule.last_status === 'success' && (
                             <span className="text-[10px] font-bold text-slate-400 ml-2">({rule.last_matched} match / {rule.last_action} act)</span>
                           )}
                         </span>
                       )}
                     </div>
                   </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Run Logs */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm sticky top-32">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" /> Lịch sử chạy (Logs)
              </h2>
            </div>
            <div className="p-0 overflow-y-auto max-h-[600px] no-scrollbar">
              {logs.length === 0 ? (
                 <div className="p-8 text-center text-slate-400 text-xs">Chưa có lịch sử.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {logs.map(log => (
                    <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                         <span className="text-xs font-bold text-slate-800 line-clamp-1 flex-1" title={log.rule?.name || "Unknown Rule"}>
                           {log.rule?.name || log.rule_id}
                         </span>
                         {log.status === 'success' ? (
                           <span className="text-emerald-500 shrink-0"><CheckCircle2 className="w-4 h-4" /></span>
                         ) : (
                           <span className="text-rose-500 shrink-0"><XCircle className="w-4 h-4" /></span>
                         )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                         <span>
                           Matched: <strong className="text-slate-800">{log.matched_count}</strong> &bull; Act: <strong className="text-indigo-600">{log.action_count}</strong>
                         </span>
                         <span>{new Date(log.created_at).toLocaleTimeString('vi-VN')}</span>
                      </div>
                      {log.error_message && (
                        <div className="mt-2 text-[10px] bg-rose-50 text-rose-600 p-2 rounded border border-rose-100">
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
