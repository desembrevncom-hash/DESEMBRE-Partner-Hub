import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, RefreshCw, Save, Users, Settings2, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/admin/pilot")({
  component: PilotModePage,
});

function PilotModePage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  
  const [modules, setModules] = useState<any[]>([]);
  const [pilotUsers, setPilotUsers] = useState<string[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!isAdmin && !isSubAdmin) return;
      try {
        const [profilesRes, rolesRes, modulesRes, pilotUsersRes] = await Promise.all([
          supabase.from("profiles").select("id, display_name, email"),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("pilot_modules").select("*").order("module_category"),
          supabase.from("pilot_users").select("user_id")
        ]);
        
        if (profilesRes.error) throw profilesRes.error;
        if (modulesRes.error) throw modulesRes.error;

        const rolesMap = new Map<string, string>();
        (rolesRes.data || []).forEach((r: any) => {
          const priority: Record<string, number> = { admin: 5, sub_admin: 4, tele_lead: 3, sale: 2, telesale: 1 };
          const existing = rolesMap.get(r.user_id);
          if (!existing || (priority[r.role] || 0) > (priority[existing] || 0)) {
            rolesMap.set(r.user_id, r.role);
          }
        });

        const enriched = (profilesRes.data || []).map((p: any) => ({
          ...p,
          role: rolesMap.get(p.id) || "staff",
        })).sort((a: any, b: any) => a.role === 'admin' ? -1 : 1);
        
        setUsersList(enriched);
        setModules(modulesRes.data || []);
        setPilotUsers((pilotUsersRes.data || []).map((u: any) => u.user_id));
      } catch (e: any) {
        toast.error("Lỗi tải dữ liệu: " + e.message);
      } finally {
        setLoadingData(false);
      }
    }
    if (!authLoading) load();
  }, [isAdmin, isSubAdmin, authLoading]);

  const isAuthorized = isAdmin || isSubAdmin;

  if (authLoading || loadingData) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">Tính năng Pilot Mode chỉ dành cho Administrator.</p>
        <Link to="/workspace" className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  const handleToggleUser = (userId: string) => {
    setPilotUsers(prev => {
      const isSelected = prev.includes(userId);
      return isSelected ? prev.filter(id => id !== userId) : [...prev, userId];
    });
    setHasChanges(true);
  };

  const handleUpdateModuleState = (moduleKey: string, newState: string) => {
    setModules(prev => prev.map(m => m.module_key === moduleKey ? { ...m, rollout_state: newState } : m));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save modules
      for (const m of modules) {
        await supabase.from("pilot_modules").update({ rollout_state: m.rollout_state }).eq('module_key', m.module_key);
      }
      
      // Save users (delete all then insert)
      await supabase.from("pilot_users").delete().neq('user_id', '00000000-0000-0000-0000-000000000000'); // delete all hack
      if (pilotUsers.length > 0) {
        const inserts = pilotUsers.map(uid => ({ user_id: uid }));
        await supabase.from("pilot_users").insert(inserts);
      }
      
      setHasChanges(false);
      toast.success("Đã lưu cấu hình Pilot Mode thành công");
      // Optionally trigger reload for context
      setTimeout(() => window.location.reload(), 1000);
    } catch (e: any) {
      toast.error("Không thể lưu: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const categories = Array.from(new Set(modules.map(m => m.module_category)));

  return (
    <div className="max-w-5xl mx-auto p-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings2 className="w-7 h-7 text-indigo-600" />
            Internal Pilot Mode
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Quản lý rollout các tính năng mới cho từng nhóm user trước khi public toàn công ty.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={!hasChanges || saving} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 relative">
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 
            Lưu Cấu Hình
            {hasChanges && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Modules */}
        <div className="lg:col-span-2 space-y-6">
          {categories.map(category => (
            <Card key={category} className="shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">{category}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {modules.filter(m => m.module_category === category).map(mod => (
                    <div key={mod.module_key} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-slate-800 text-sm">{mod.module_name}</h4>
                        <p className="text-xs text-slate-500 mt-1 font-mono">{mod.module_key}</p>
                      </div>
                      <div className="flex bg-slate-100 rounded-lg p-1 shrink-0">
                        <button 
                          onClick={() => handleUpdateModuleState(mod.module_key, 'off')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mod.rollout_state === 'off' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          OFF
                        </button>
                        <button 
                          onClick={() => handleUpdateModuleState(mod.module_key, 'admin_only')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mod.rollout_state === 'admin_only' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          ADMIN ONLY
                        </button>
                        <button 
                          onClick={() => handleUpdateModuleState(mod.module_key, 'pilot_only')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mod.rollout_state === 'pilot_only' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          PILOT ONLY
                        </button>
                        <button 
                          onClick={() => handleUpdateModuleState(mod.module_key, 'on')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mod.rollout_state === 'on' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          ON
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right Col: Pilot Users */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm border-slate-200 sticky top-6">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Danh sách Pilot Users
              </CardTitle>
              <CardDescription>Chọn nhân sự được tham gia nhóm Pilot.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
                {usersList.map(u => {
                  const isSelected = pilotUsers.includes(u.id);
                  return (
                    <div 
                      key={u.id} 
                      className={`flex items-center justify-between p-3 px-4 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}
                      onClick={() => handleToggleUser(u.id)}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">{u.display_name || u.email?.split('@')[0]}</p>
                        <p className="text-[11px] font-medium text-slate-500">{u.role} • {u.email}</p>
                      </div>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
