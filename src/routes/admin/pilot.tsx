import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, RefreshCw, Save, Users, Settings2, ToggleRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getPilotSettings, savePilotSettings, PilotSettings } from "@/lib/pilotMode";

export const Route = createFileRoute("/admin/pilot")({
  component: PilotModePage,
});

function PilotModePage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<PilotSettings | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    async function load() {
      if (!isAdmin && !isSubAdmin) return;
      try {
        const [profilesRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("id, display_name, email"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
        if (profilesRes.error) throw profilesRes.error;
        // Build a map of user_id -> primary role for display
        const rolesMap = new Map<string, string>();
        (rolesRes.data || []).forEach((r: any) => {
          // Prioritize: admin > sub_admin > tele_lead > sale > telesale
          const priority: Record<string, number> = { admin: 5, sub_admin: 4, tele_lead: 3, sale: 2, telesale: 1 };
          const existing = rolesMap.get(r.user_id);
          if (!existing || (priority[r.role] || 0) > (priority[existing] || 0)) {
            rolesMap.set(r.user_id, r.role);
          }
        });
        const enriched = (profilesRes.data || []).map((p: any) => ({
          ...p,
          role: rolesMap.get(p.id) || "staff",
        }));
        setUsersList(enriched);
        setSettings(getPilotSettings());
      } catch (e: any) {
        toast.error("Lỗi tải danh sách user: " + e.message);
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

  if (!user || !isAuthorized || !settings) {
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

  const handleTogglePilot = (checked: boolean) => {
    setSettings(prev => prev ? { ...prev, pilot_mode: checked } : null);
    setHasChanges(true);
  };

  const handleToggleFeature = (feature: keyof PilotSettings['enabled_features']) => {
    setSettings(prev => {
      if (!prev) return null;
      return {
        ...prev,
        enabled_features: {
          ...prev.enabled_features,
          [feature]: !prev.enabled_features[feature]
        }
      };
    });
    setHasChanges(true);
  };

  const handleToggleUser = (userId: string) => {
    setSettings(prev => {
      if (!prev) return null;
      const isSelected = prev.pilot_user_ids.includes(userId);
      return {
        ...prev,
        pilot_user_ids: isSelected 
          ? prev.pilot_user_ids.filter(id => id !== userId)
          : [...prev.pilot_user_ids, userId]
      };
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (settings) {
      savePilotSettings(settings);
      setHasChanges(false);
      toast.success("Đã lưu cấu hình Pilot Mode");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings2 className="w-7 h-7 text-indigo-600" />
            Internal Pilot Mode
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Quản lý rollout các tính năng mới (AI, RAG, Automation) cho một nhóm user nhỏ trước khi public toàn công ty.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 relative">
            <Save className="w-4 h-4 mr-2" /> Lưu Cấu Hình
            {hasChanges && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />}
          </Button>
        </div>
      </div>

      <Card className="mb-8 border-indigo-100 shadow-indigo-100/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Kích hoạt Pilot Mode</h3>
              <p className="text-sm text-slate-500 mt-1">
                Khi bật, các tính năng được chọn bên dưới sẽ <strong>chỉ hiển thị</strong> với những user nằm trong danh sách Pilot. Các user khác sẽ sử dụng hệ thống như bình thường (không có tính năng mới).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold ${settings.pilot_mode ? 'text-indigo-600' : 'text-slate-400'}`}>
                {settings.pilot_mode ? 'ON' : 'OFF'}
              </span>
              <Switch checked={settings.pilot_mode} onCheckedChange={handleTogglePilot} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={`transition-all duration-300 ${!settings.pilot_mode ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Danh sách Pilot Users
              </CardTitle>
              <CardDescription>Chọn những nhân viên được phép dùng thử tính năng mới.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                {usersList.map(u => {
                  const isSelected = settings.pilot_user_ids.includes(u.id);
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

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ToggleRight className="w-4 h-4 text-indigo-500" />
                Tính năng áp dụng Pilot
              </CardTitle>
              <CardDescription>Giới hạn các tính năng này chỉ cho Pilot Users.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-4">
              {[
                { id: 'ai_summary', name: 'AI Summary (Tóm tắt KH)' },
                { id: 'ai_suggestion', name: 'AI Suggestion (Gợi ý KH)' },
                { id: 'ai_rewrite', name: 'AI Rewrite (Soạn thảo văn bản)' },
                { id: 'ai_rag', name: 'AI RAG (Tra cứu tri thức)' },
                { id: 'product_knowledge_qa', name: 'Product Knowledge QA' },
                { id: 'automation_advanced', name: 'Advanced Automation Rules' }
              ].map(feat => {
                const isChecked = settings.enabled_features[feat.id as keyof PilotSettings['enabled_features']];
                return (
                  <div key={feat.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-sm font-bold text-slate-700">{feat.name}</span>
                    <Switch 
                      checked={isChecked} 
                      onCheckedChange={() => handleToggleFeature(feat.id as keyof PilotSettings['enabled_features'])} 
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
