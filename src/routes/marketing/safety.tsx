import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ShieldAlert, ArrowLeft, Save, Plus, XCircle, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/marketing/safety")({
  component: OpsSafetyPage,
});

function OpsSafetyPage() {
  const [settings, setSettings] = useState<any>(null);
  const [suppressions, setSuppressions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Suppression Form
  const [newSuppression, setNewSuppression] = useState({
    email: "",
    phone: "",
    channel: "all",
    reason: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch settings
      const { data: sData, error: sErr } = await supabase
        .from("marketing_ops_safety_settings")
        .select("*")
        .eq("is_default", true)
        .single();
        
      if (sErr) {
        if (sErr.code === "PGRST116") {
          toast.error("Chưa có cấu hình mặc định (is_default=true) trong DB.");
        } else {
          throw sErr;
        }
      } else {
        setSettings(sData);
      }

      // Fetch suppressions
      const { data: listData, error: listErr } = await supabase
        .from("marketing_suppression_list")
        .select("*")
        .order("created_at", { ascending: false });

      if (listErr) throw listErr;
      setSuppressions(listData || []);

    } catch (err: any) {
      toast.error("Lỗi tải dữ liệu: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings || !settings.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("marketing_ops_safety_settings")
        .update({
          global_kill_switch: settings.global_kill_switch,
          email_enabled: settings.email_enabled,
          zalo_enabled: settings.zalo_enabled,
          require_admin_approval: settings.require_admin_approval,
          daily_send_quota: parseInt(settings.daily_send_quota),
          per_campaign_quota: parseInt(settings.per_campaign_quota),
          cooldown_minutes: parseInt(settings.cooldown_minutes),
          duplicate_prevention_hours: parseInt(settings.duplicate_prevention_hours),
          updated_at: new Date().toISOString()
        })
        .eq("id", settings.id);

      if (error) throw error;
      toast.success("Đã lưu cấu hình an toàn!");
    } catch (err: any) {
      toast.error("Lỗi khi lưu cấu hình: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppression.email && !newSuppression.phone) {
      toast.error("Cần nhập Email hoặc Phone");
      return;
    }
    
    try {
      const { error } = await supabase
        .from("marketing_suppression_list")
        .insert({
          email: newSuppression.email || null,
          phone: newSuppression.phone || null,
          channel: newSuppression.channel,
          reason: newSuppression.reason || null,
          source: 'admin',
          active: true
        });

      if (error) throw error;
      toast.success("Đã thêm vào Blacklist!");
      setNewSuppression({ email: "", phone: "", channel: "all", reason: "" });
      fetchData(); // reload
    } catch (err: any) {
      toast.error("Lỗi khi thêm Suppression: " + err.message);
    }
  };

  const toggleSuppressionActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("marketing_suppression_list")
        .update({ active: !currentActive, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      toast.error("Lỗi cập nhật: " + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-red-500 selection:text-white">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/marketing"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                <Shield className="w-6 h-6 text-red-500" />
                Marketing Ops Safety
              </h1>
              <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Fail-closed safety mode</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="h-10 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-lg shadow-red-500/20"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Lưu Cấu Hình
            </Button>
          </div>
        </div>
      </header>

      {/* WARNING BANNER */}
      <div className="bg-red-500/10 border-b border-red-500/20 p-4 flex justify-center items-center">
        <div className="flex items-center gap-2 text-red-500 text-sm font-bold uppercase tracking-wider text-center">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          Real send remains disabled until safety gates are explicitly configured. This module does not send messages.
        </div>
      </div>

      <main className="container mx-auto px-4 md:px-6 mt-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT: Safety Settings */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6 pb-4 border-b border-slate-800">
                <Shield className="w-5 h-5 text-red-400" /> Global Kill Switch
              </h2>
              
              {settings && (
                <div className="space-y-8">
                  {/* Master Switch */}
                  <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
                    <div>
                      <div className="font-bold text-red-400 text-lg flex items-center gap-2">
                        GLOBAL KILL SWITCH
                        {settings.global_kill_switch && <AlertTriangle className="w-4 h-4" />}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        Khi BẬT (ON), mọi luồng gửi tin sẽ bị chặn hoàn toàn. Đây là chốt chặn an toàn cuối cùng.
                      </div>
                    </div>
                    <Switch 
                      checked={settings.global_kill_switch}
                      onCheckedChange={(c) => setSettings({...settings, global_kill_switch: c})}
                      className="data-[state=checked]:bg-red-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Channel Toggles */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Channels</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300 font-medium">Email Enabled</span>
                        <Switch 
                          checked={settings.email_enabled}
                          onCheckedChange={(c) => setSettings({...settings, email_enabled: c})}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300 font-medium">Zalo Enabled</span>
                        <Switch 
                          checked={settings.zalo_enabled}
                          onCheckedChange={(c) => setSettings({...settings, zalo_enabled: c})}
                        />
                      </div>
                    </div>

                    {/* Security rules */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Security</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300 font-medium">Require Admin Approval</span>
                        <Switch 
                          checked={settings.require_admin_approval}
                          onCheckedChange={(c) => setSettings({...settings, require_admin_approval: c})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quotas & Limits */}
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Quotas & Limits</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Daily Send Quota (0 = blocked)</label>
                        <Input 
                          type="number" 
                          min="0"
                          value={settings.daily_send_quota}
                          onChange={(e) => setSettings({...settings, daily_send_quota: e.target.value})}
                          className="bg-slate-950 border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Per-Campaign Quota</label>
                        <Input 
                          type="number" 
                          min="0"
                          value={settings.per_campaign_quota}
                          onChange={(e) => setSettings({...settings, per_campaign_quota: e.target.value})}
                          className="bg-slate-950 border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Cooldown (minutes)</label>
                        <Input 
                          type="number" 
                          min="0"
                          value={settings.cooldown_minutes}
                          onChange={(e) => setSettings({...settings, cooldown_minutes: e.target.value})}
                          className="bg-slate-950 border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Duplicate Prevention (hrs)</label>
                        <Input 
                          type="number" 
                          min="0"
                          value={settings.duplicate_prevention_hours}
                          onChange={(e) => setSettings({...settings, duplicate_prevention_hours: e.target.value})}
                          className="bg-slate-950 border-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Suppression List */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6 pb-4 border-b border-slate-800">
                <XCircle className="w-5 h-5 text-red-400" /> Suppression List (Blacklist)
              </h2>

              <form onSubmit={handleAddSuppression} className="space-y-4 mb-8 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thêm mới</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    placeholder="Email" 
                    value={newSuppression.email}
                    onChange={e => setNewSuppression({...newSuppression, email: e.target.value})}
                    className="bg-slate-900 border-slate-700"
                  />
                  <Input 
                    placeholder="Phone" 
                    value={newSuppression.phone}
                    onChange={e => setNewSuppression({...newSuppression, phone: e.target.value})}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select 
                    value={newSuppression.channel}
                    onChange={e => setNewSuppression({...newSuppression, channel: e.target.value})}
                    className="h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-300 focus:outline-none"
                  >
                    <option value="all">Tất cả (all)</option>
                    <option value="email">Email</option>
                    <option value="zalo">Zalo</option>
                  </select>
                  <Input 
                    placeholder="Lý do (tuỳ chọn)" 
                    value={newSuppression.reason}
                    onChange={e => setNewSuppression({...newSuppression, reason: e.target.value})}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
                <Button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Thêm vào Blacklist
                </Button>
              </form>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {suppressions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">Chưa có ai trong Blacklist.</div>
                ) : (
                  suppressions.map(s => (
                    <div key={s.id} className={`p-3 rounded-xl border flex items-center justify-between ${s.active ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-800/20 border-slate-800'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          {s.active ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          )}
                          <span className={`font-bold text-sm ${s.active ? 'text-red-400' : 'text-slate-400'}`}>
                            {s.email || s.phone || s.customer_id}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span className="uppercase font-mono bg-slate-800 px-1 py-0.5 rounded">{s.channel}</span>
                          <span>{s.reason || "Không rõ lý do"}</span>
                        </div>
                      </div>
                      <Switch 
                        checked={s.active}
                        onCheckedChange={() => toggleSuppressionActive(s.id, s.active)}
                        className="data-[state=checked]:bg-red-500"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
