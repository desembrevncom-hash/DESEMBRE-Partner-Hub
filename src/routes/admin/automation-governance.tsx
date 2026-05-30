import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  ShieldAlert, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle,
  Lock,
  ZapOff,
  Bot,
  Bell,
  CalendarClock,
  Activity,
  ArrowRight,
  Database,
  Trash2,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/automation-governance")({
  component: AutomationGovernancePage,
});

function AutomationGovernancePage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState({ auto: 200, notif: 500 });

  const isAuthorized = isAdmin || isSubAdmin;

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("get_automation_governance_summary");
      if (error) throw error;
      setData(result);
      if (result?.settings) {
        setLimits({
          auto: result.settings.automation_daily_limit || 200,
          notif: result.settings.notification_daily_limit || 500
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải dữ liệu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user && isAuthorized) {
      loadData();
    }
  }, [user, isAuthorized, authLoading]);

  const updateSetting = async (key: string, value: any) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("system_settings")
        .update({ [key]: value })
        .eq("id", data.settings.id || (await supabase.from("system_settings").select("id").single()).data?.id); // Hacky single update
        
      if (error) throw error;
      toast.success("Đã cập nhật hệ thống.");
      loadData();
    } catch (err: any) {
      toast.error("Lỗi cập nhật: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveLimits = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("system_settings")
        .update({ 
          automation_daily_limit: limits.auto,
          notification_daily_limit: limits.notif
        })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Update the singleton row safely
        
      if (error) throw error;
      toast.success("Đã lưu giới hạn.");
      loadData();
    } catch (err: any) {
      toast.error("Lỗi cập nhật: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const emergencyStop = async () => {
    if (!window.confirm("CẢNH BÁO: Hành động này sẽ TẮT hoàn toàn mọi tự động hoá và sinh việc tự động. Bạn chắc chắn chứ?")) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("system_settings")
        .update({ 
          automation_enabled: false,
          due_generator_enabled: false
        })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      toast.error("Đã DỪNG KHẨN CẤP toàn bộ Automation!");
      loadData();
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const releaseLock = async (lockKey: string) => {
    try {
      const { error } = await supabase.rpc("release_execution_lock", { p_lock_key: lockKey });
      if (error) throw error;
      toast.success("Đã mở khóa: " + lockKey);
      loadData();
    } catch (err: any) {
      toast.error("Lỗi mở khóa: " + err.message);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Permission Denied</h2>
        <p className="text-slate-500 text-sm mt-2">Bạn không có quyền truy cập Automation Governance.</p>
        <Link to="/workspace" className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold">Quay lại Workspace</Link>
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
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h1 className="text-xl font-black uppercase tracking-widest text-slate-100">Automation Governance</h1>
              </div>
              <p className="text-slate-400 text-sm font-medium max-w-xl leading-relaxed">
                Trung tâm kiểm soát an toàn hệ thống tự động hoá. Quản lý luồng chạy, chống kẹt (locks) và giới hạn spam.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={loadData} disabled={loading} className="bg-slate-800 text-white hover:bg-slate-700">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Làm mới
              </Button>
              <Button onClick={emergencyStop} variant="destructive" className="bg-rose-600 hover:bg-rose-700 font-bold shadow-rose-900/50">
                <ZapOff className="w-4 h-4 mr-2" /> Stop All Automation
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {loading && !data ? (
          <div className="py-20 flex justify-center"><RefreshCw className="w-6 h-6 text-slate-300 animate-spin" /></div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Cột trái: Switches & Limits */}
            <div className="space-y-6">
              
              {/* SYSTEM SAFE MODE CARD */}
              <Card className="border-slate-200 shadow-sm bg-white overflow-hidden relative">
                {data.settings.pilot_mode_enabled && !data.settings.automation_enabled && !data.settings.due_generator_enabled && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                    PRODUCTION SAFE MODE
                  </div>
                )}
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> System Safe Mode & Runtime Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-2">
                    <span className="text-slate-600">SAFE MODE</span>
                    {data.settings.pilot_mode_enabled && !data.settings.automation_enabled && !data.settings.due_generator_enabled ? (
                      <span className="text-emerald-600 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5"/> ACTIVE</span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/> INACTIVE</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-2">
                    <span className="text-slate-600">AUTOMATION</span>
                    {data.settings.automation_enabled ? (
                      <span className="text-emerald-600">ENABLED</span>
                    ) : (
                      <span className="text-rose-600">DISABLED</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-2">
                    <span className="text-slate-600">NOTIFICATIONS</span>
                    {data.settings.notification_enabled ? (
                      <span className="text-emerald-600">ENABLED</span>
                    ) : (
                      <span className="text-rose-600">DISABLED</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">PILOT SCOPE</span>
                    {data.settings.pilot_mode_enabled ? (
                      <span className="text-indigo-600">PILOT USERS ONLY</span>
                    ) : (
                      <span className="text-amber-600">FULL COMPANY ROLLOUT</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" /> System Switches
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500"/> Pilot Mode Safe</Label>
                      <p className="text-xs text-slate-500">Giới hạn các tính năng nguy hiểm.</p>
                    </div>
                    <Switch checked={data.settings.pilot_mode_enabled} onCheckedChange={(v) => updateSetting('pilot_mode_enabled', v)} disabled={saving} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-slate-800 flex items-center gap-2"><Bot className="w-3.5 h-3.5 text-indigo-500"/> Automation Rules</Label>
                      <p className="text-xs text-slate-500">Bật/tắt P4 Automation Engine.</p>
                    </div>
                    <Switch checked={data.settings.automation_enabled} onCheckedChange={(v) => updateSetting('automation_enabled', v)} disabled={saving} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-slate-800 flex items-center gap-2"><CalendarClock className="w-3.5 h-3.5 text-amber-500"/> Due Generator</Label>
                      <p className="text-xs text-slate-500">Bật/tắt quét thông báo quá hạn.</p>
                    </div>
                    <Switch checked={data.settings.due_generator_enabled} onCheckedChange={(v) => updateSetting('due_generator_enabled', v)} disabled={saving} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-slate-800 flex items-center gap-2"><Bell className="w-3.5 h-3.5 text-rose-500"/> Notification Center</Label>
                      <p className="text-xs text-slate-500">Cho phép tạo thông báo mới.</p>
                    </div>
                    <Switch checked={data.settings.notification_enabled} onCheckedChange={(v) => updateSetting('notification_enabled', v)} disabled={saving} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Database className="w-4 h-4 text-slate-500" /> Daily Limits
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Automation Runs/Ngày</Label>
                    <Input type="number" value={limits.auto} onChange={e => setLimits(p => ({...p, auto: parseInt(e.target.value) || 0}))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Notifications Created/Ngày</Label>
                    <Input type="number" value={limits.notif} onChange={e => setLimits(p => ({...p, notif: parseInt(e.target.value) || 0}))} />
                  </div>
                  <Button onClick={saveLimits} disabled={saving} className="w-full bg-slate-900 text-white">Lưu Limits</Button>
                </CardContent>
              </Card>
              
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-widest">Quick Links</h3>
                <div className="space-y-2">
                  <Link to="/admin/automation-rules" className="flex items-center text-sm font-medium text-indigo-700 hover:text-indigo-900"><ArrowRight className="w-4 h-4 mr-2"/> Automation Rules MVP</Link>
                  <Link to="/admin/crm-health" className="flex items-center text-sm font-medium text-indigo-700 hover:text-indigo-900"><ArrowRight className="w-4 h-4 mr-2"/> CRM Health</Link>
                </div>
              </div>
            </div>

            {/* Cột phải: Stats & Locks */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-3xl font-black text-slate-800">{data.stats_today?.automation_runs || 0}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Runs Today</span>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-3xl font-black text-indigo-600">{data.stats_today?.tasks_created || 0}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tasks Created</span>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-3xl font-black text-rose-600">{data.stats_today?.notifications_created || 0}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notifs Created</span>
                  </CardContent>
                </Card>
                <Card className="border-rose-200 shadow-sm bg-rose-50/50">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-3xl font-black text-rose-700">{data.stats_today?.failed_runs || 0}</span>
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Failed Runs</span>
                  </CardContent>
                </Card>
              </div>

              {/* Last Runtime Check */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" /> Last Runtime Check
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Last Automation Run</p>
                    <p className="text-xs font-medium text-slate-800 mt-1">
                      {data.last_runtime?.last_automation_run ? new Date(data.last_runtime.last_automation_run).toLocaleString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Last Due Generator Run</p>
                    <p className="text-xs font-medium text-slate-800 mt-1">
                      {data.last_runtime?.last_due_generator_run ? new Date(data.last_runtime.last_due_generator_run).toLocaleString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Last Notification</p>
                    <p className="text-xs font-medium text-slate-800 mt-1">
                      {data.last_runtime?.last_notification_created ? new Date(data.last_runtime.last_notification_created).toLocaleString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-500" /> Active Execution Locks
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {Object.keys(data.active_locks || {}).length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">Không có tiến trình nào đang bị khóa.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {Object.entries(data.active_locks).map(([key, lock]: [string, any]) => (
                        <div key={key} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-800 font-mono">{key}</p>
                            <p className="text-xs text-slate-500 mt-1">Expires: {new Date(lock.expires_at).toLocaleString('vi-VN')}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => releaseLock(key)} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                            <Trash2 className="w-4 h-4 mr-1" /> Gỡ khóa
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-slate-400" /> Recent Runs (Last 10)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {!data.recent_logs || data.recent_logs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">Chưa có dữ liệu chạy.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {data.recent_logs.map((run: any) => (
                        <div key={run.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                           <div>
                             <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                               {run.rule_name || run.rule_id || "System Generator"}
                               {run.status === 'success' ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-1.5 py-0">Success</Badge> : <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none px-1.5 py-0">Failed</Badge>}
                             </p>
                             <p className="text-xs text-slate-500 mt-1">{new Date(run.created_at).toLocaleString('vi-VN')} &bull; Match: {run.matched_records || run.matched_count} &bull; Act: {run.actions_taken || run.action_count}</p>
                           </div>
                           {run.error_message && (
                             <div className="max-w-[200px] text-[10px] text-rose-600 bg-rose-50 p-2 rounded truncate" title={run.error_message}>
                               {run.error_message}
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
