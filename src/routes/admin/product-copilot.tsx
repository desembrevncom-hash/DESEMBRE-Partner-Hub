import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, MessageSquare, Database, Activity, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/product-copilot")({
  component: AdminProductCopilot,
});

export function AdminProductCopilot() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    ask: 0, copy: 0, copy_zalo: 0, save_note: 0, create_template: 0
  });
  const [knowledgeCount, setKnowledgeCount] = useState(0);

  const fetchAll = async () => {
    if (!isAdmin && !isSubAdmin) return;
    setLoading(true);
    try {
      // 1. Fetch Settings
      const { data: aiSettings } = await supabase.rpc('get_ai_settings_masked');
      setSettings(aiSettings);

      // 2. Fetch Quick Replies
      const { data: qrData } = await supabase
        .from('product_copilot_quick_replies')
        .select('*')
        .order('sort_order', { ascending: true });
      if (qrData) setQuickReplies(qrData);

      // 3. Fetch Knowledge Chunks Count
      const { count } = await supabase
        .from('product_knowledge_chunks')
        .select('*', { count: 'exact', head: true });
      setKnowledgeCount(count || 0);

      // 4. Fetch Usage (Today)
      const today = new Date();
      today.setHours(0,0,0,0);
      const { data: metrics } = await supabase
        .from('pilot_usage_metrics')
        .select('action_key')
        .gte('created_at', today.toISOString());
        
      if (metrics) {
        const s = { ask: 0, copy: 0, copy_zalo: 0, save_note: 0, create_template: 0 };
        metrics.forEach(m => {
          if (m.action_key === 'product_copilot_ask') s.ask++;
          if (m.action_key === 'product_copilot_copy') s.copy++;
          if (m.action_key === 'product_copilot_copy_zalo') s.copy_zalo++;
          if (m.action_key === 'product_copilot_save_note') s.save_note++;
          if (m.action_key === 'product_copilot_create_template') s.create_template++;
        });
        setStats(s);
      }
    } catch (err) {
      toast.error("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [isAdmin, isSubAdmin]);

  const updateSetting = async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from('ai_settings')
        .update({ [key]: value })
        .eq('id', 'default');
      if (error) throw error;
      setSettings((prev: any) => ({ ...prev, [key]: value }));
      toast.success("Đã cập nhật cài đặt");
    } catch (err) {
      toast.error("Cập nhật thất bại");
    }
  };

  const toggleQuickReply = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('product_copilot_quick_replies')
        .update({ is_active: !current })
        .eq('id', id);
      if (error) throw error;
      setQuickReplies(prev => prev.map(q => q.id === id ? { ...q, is_active: !current } : q));
      toast.success("Đã cập nhật Quick Reply");
    } catch (err) {
      toast.error("Cập nhật thất bại");
    }
  };

  if (!isAdmin && !isSubAdmin) return <div className="p-8">Access Denied</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-600" />
            Product Copilot Control
          </h1>
          <p className="text-slate-500 mt-1">Quản lý trợ lý AI, nguồn kiến thức và phân quyền truy cập</p>
        </div>
        <Button variant="outline" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Usage Stats Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Hỏi đáp hôm nay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">{stats.ask}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Copy (Text/Zalo)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">{stats.copy + stats.copy_zalo}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Lưu Ghi chú</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">{stats.save_note}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Lưu Template</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">{stats.create_template}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-indigo-500" />
                Cài đặt Governance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label className="flex flex-col gap-1 cursor-pointer">
                  <span className="font-semibold">Bật Product Copilot</span>
                  <span className="text-xs text-slate-500">Master switch cho toàn hệ thống</span>
                </Label>
                <Switch 
                  checked={settings?.product_copilot_enabled ?? true} 
                  onCheckedChange={(v) => updateSetting('product_copilot_enabled', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex flex-col gap-1 cursor-pointer">
                  <span className="font-semibold">Bật cho Sale</span>
                  <span className="text-xs text-slate-500">Cho phép Sale/Tele sử dụng</span>
                </Label>
                <Switch 
                  checked={settings?.product_copilot_sale_enabled ?? true} 
                  onCheckedChange={(v) => updateSetting('product_copilot_sale_enabled', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex flex-col gap-1 cursor-pointer">
                  <span className="font-semibold">Bật cho Admin</span>
                  <span className="text-xs text-slate-500">Cho phép Admin/SubAdmin sử dụng</span>
                </Label>
                <Switch 
                  checked={settings?.product_copilot_admin_enabled ?? true} 
                  onCheckedChange={(v) => updateSetting('product_copilot_admin_enabled', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex flex-col gap-1 cursor-pointer">
                  <span className="font-semibold">Bắt buộc có Context</span>
                  <span className="text-xs text-slate-500">Chỉ hiện Copilot trong trang khách hàng</span>
                </Label>
                <Switch 
                  checked={settings?.product_copilot_require_context ?? false} 
                  onCheckedChange={(v) => updateSetting('product_copilot_require_context', v)}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Giới hạn câu hỏi hàng ngày / user</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={settings?.product_copilot_daily_limit ?? 50} 
                    onChange={(e) => setSettings({...settings, product_copilot_daily_limit: parseInt(e.target.value)})}
                  />
                  <Button onClick={() => updateSetting('product_copilot_daily_limit', settings?.product_copilot_daily_limit)}>Lưu</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="w-5 h-5 text-indigo-500" />
                Nguồn Kiến Thức (RAG)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium">Trạng thái RAG</span>
                <span className="text-sm font-bold text-emerald-600">Đang hoạt động</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium">Product Chunks</span>
                <span className="text-sm font-bold">{knowledgeCount} đoạn</span>
              </div>
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium">Last Indexed</span>
                <span className="text-sm text-slate-500">Hôm nay</span>
              </div>
              <Button variant="outline" className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                Xem RAG Audit Logs
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-indigo-500" />
                Quản lý Quick Replies
              </CardTitle>
              <CardDescription>Các câu hỏi gợi ý hiển thị mặc định trên Product Copilot</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quickReplies.map((qr) => (
                  <div key={qr.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50/50">
                    <div className="space-y-1">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {qr.title}
                        {qr.requires_context && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-medium">
                            Cần Context
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-sm">{qr.prompt}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-400">Order: {qr.sort_order}</span>
                      <Switch 
                        checked={qr.is_active} 
                        onCheckedChange={() => toggleQuickReply(qr.id, qr.is_active)}
                      />
                    </div>
                  </div>
                ))}
                {quickReplies.length === 0 && !loading && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Chưa có Quick Replies nào
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
