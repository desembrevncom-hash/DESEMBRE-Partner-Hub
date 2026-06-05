import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Key, CheckCircle2, XCircle, BrainCircuit, RefreshCw, AlertTriangle, Save, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/ai-settings")({
  component: AdminAiSettingsPage,
});

function AdminAiSettingsPage() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState({
    isConfigured: false,
    useRpcBrandFilter: false,
    maskedKey: "",
    chatModel: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
    lastTestedAt: "",
    lastTestStatus: "untested",
  });
  
  const [formData, setFormData] = useState({
    provider: "openai",
    api_base_url: "",
    openai_api_key: "",
    chat_model: "gpt-4o-mini",
    embedding_model: "text-embedding-3-small",
  });

  useEffect(() => {
    if (user && !isAdmin && !isSubAdmin) {
      toast.error("Bạn không có quyền truy cập trang này.");
      navigate({ to: "/" });
    }
  }, [user, isAdmin, isSubAdmin, navigate]);

  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      fetchStatus();
    }
  }, [isAdmin, isSubAdmin]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const aiStatus = await supabase.functions.invoke("admin-ai-settings", {
        body: { action: "get_ai_settings_status" },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (aiStatus.error) throw aiStatus.error;

      setStatus({
        isConfigured: aiStatus.data?.key_configured || false,
        useRpcBrandFilter: aiStatus.data?.rag_use_rpc_brand_filter || false,
        maskedKey: aiStatus.data?.key_mask || "",
        chatModel: aiStatus.data?.chat_model || "gpt-4o-mini",
        embeddingModel: aiStatus.data?.embedding_model || "text-embedding-3-small",
        lastTestedAt: aiStatus.data?.last_tested_at || "",
        lastTestStatus: aiStatus.data?.last_test_status || "untested",
      });
      setFormData(prev => ({
        ...prev,
        provider: aiStatus.data?.provider || "openai",
        api_base_url: aiStatus.data?.api_base_url || "",
        chat_model: aiStatus.data?.chat_model || "gpt-4o-mini",
        embedding_model: aiStatus.data?.embedding_model || "text-embedding-3-small",
        openai_api_key: aiStatus.data?.key_mask || "",
      }));
    } catch (e: any) {
      console.error("Fetch status error:", e);
      toast.error("Lỗi khi tải cấu hình AI: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        action: "save_ai_provider_settings",
        provider: formData.provider,
        api_base_url: formData.api_base_url,
        api_key: formData.openai_api_key,
        chat_model: formData.chat_model,
        embedding_model: formData.embedding_model,
      };
      
      const { data, error } = await supabase.functions.invoke("admin-ai-settings", {
        body: payload,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) throw error;

      if (data?.status === "success") {
        toast.success(data.message || "Đã lưu cấu hình thành công!");
        fetchStatus();
      } else {
        toast.error(data?.message || "Lỗi khi lưu cấu hình.");
      }
    } catch (e: any) {
      console.error("Save error:", e);
      toast.error("Lỗi khi lưu cấu hình: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("admin-ai-settings", {
        body: { action: "test_openai_connection" },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) throw error;

      if (data?.status === "success") {
        toast.success(data.message || "Test kết nối OpenAI thành công!");
      } else {
        toast.error(data?.message || "Lỗi kết nối OpenAI.");
      }
    } catch (e: any) {
      console.error("Test error:", e);
      toast.error("Lỗi gọi hàm test: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleReindex = async () => {
    if (!status.isConfigured) {
      toast.error("Chưa cấu hình OPENAI_API_KEY. Vui lòng thêm trong Supabase Secrets.");
      return;
    }

    setTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("admin-ai-settings", {
        body: { action: "trigger_staging_reindex" },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) throw error;
      
      if (data?.status === "success") {
        toast.success(data.message || "Đã kích hoạt Reindex Staging Knowledge!");
      } else {
        toast.error(data?.message || "Lỗi khi kích hoạt Reindex.");
      }
    } catch (e: any) {
      console.error("Reindex error:", e);
      toast.error("Lỗi gọi hàm reindex: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSmokeTest = async () => {
    toast.info("Mô phỏng RAG Smoke Test đang chạy...");
    setTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("admin-ai-settings", {
        body: { action: "test_rag_retrieval" },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) throw error;
      
      if (data?.status === "success") {
        toast.success(data.message || "RAG Smoke Test hoàn tất.");
      } else {
        toast.error(data?.message || "RAG Smoke Test thất bại.");
      }
    } catch (e: any) {
      console.error("Smoke test error:", e);
      toast.error("Lỗi gọi hàm smoke test: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <CRMPageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      </CRMPageContainer>
    );
  }

  return (
    <CRMPageContainer>
      <CRMPageHeader
        title="Cấu hình AI / RAG (Staging)"
        subtitle="Quản lý bảo mật Secret & Cấu hình Retrieval-Augmented Generation"
        icon={Sparkles}
        badgeText="ADMIN ONLY"
      />

      <main className="container mx-auto px-6 py-8 max-w-4xl space-y-6">
        {/* Provider Status */}
        <CRMCard className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black flex items-center gap-2 text-slate-900">
                <Key className="w-5 h-5 text-indigo-500" /> OpenAI API Provider
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Trạng thái cấu hình của Secret <code>OPENAI_API_KEY</code>.
              </p>
            </div>
            <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
              status.isConfigured 
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200" 
                : "bg-rose-50 text-rose-600 border border-rose-200"
            }`}>
              {status.isConfigured ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {status.isConfigured ? "Configured in Supabase Secrets" : "Not configured"}
            </div>
          </div>

          <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Hướng dẫn bảo mật
            </h3>
            <p className="text-sm text-slate-600">
              API Key sẽ được lưu vào Database để sử dụng. Key trả về đã được ẩn để bảo mật.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">AI Provider</Label>
                <select 
                  value={formData.provider}
                  onChange={(e) => setFormData({...formData, provider: e.target.value})}
                  className="w-full mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Gemini</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">API Base URL (Optional)</Label>
                <Input 
                  value={formData.api_base_url}
                  onChange={(e) => setFormData({...formData, api_base_url: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">API_KEY</Label>
              <div className="relative mt-1">
                <Input 
                  type={showKey ? "text" : "password"}
                  value={formData.openai_api_key}
                  onChange={(e) => setFormData({...formData, openai_api_key: e.target.value})}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button 
                  type="button" 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chat Model</Label>
                <Input 
                  value={formData.chat_model}
                  onChange={(e) => setFormData({...formData, chat_model: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Embedding Model</Label>
                <Input 
                  value={formData.embedding_model}
                  onChange={(e) => setFormData({...formData, embedding_model: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-6">
            <Button 
              onClick={handleTestConnection} 
              disabled={testing || !status.isConfigured}
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${testing ? 'animate-spin' : ''}`} /> Test Connection
            </Button>
            <Button 
              onClick={handleSaveSettings} 
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} /> Lưu Cấu Hình
            </Button>
          </div>
        </CRMCard>

        {/* RAG Settings */}
        <CRMCard className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black flex items-center gap-2 text-slate-900">
                <BrainCircuit className="w-5 h-5 text-indigo-500" /> RAG Filter Settings
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Cờ <code>RAG_USE_RPC_BRAND_FILTER</code> điều khiển thuật toán lấy Context.
              </p>
            </div>
            <div className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-2">
              Status: {status.useRpcBrandFilter ? "TRUE" : "FALSE"}
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-600">
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong>False</strong> = Smart Suggestion Guard (Được khuyến nghị).</li>
              <li><strong>True</strong> = Strict Brand Isolation.</li>
            </ul>
          </div>
          
          <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-sm text-slate-600">
              Vui lòng thay đổi cờ <code>RAG_USE_RPC_BRAND_FILTER</code> trong <strong>Supabase Secrets</strong> nếu cần chuyển đổi hành vi.
            </p>
          </div>
        </CRMCard>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CRMCard className="p-6">
            <h3 className="text-md font-black text-slate-900 mb-2">Reindex Staging Knowledge</h3>
            <p className="text-xs text-slate-500 mb-6">Xóa các vector embeddings cũ và sinh lại embeddings mới bằng OpenAI. Chỉ chạy trên môi trường Staging.</p>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  disabled={testing || !status.isConfigured}
                  variant="destructive"
                  className="w-full font-bold"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Trigger Reindex
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Xác nhận Reindex Staging?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Hành động này sẽ sinh lại embeddings (Chunks) cho Knowledge Database. Lệnh này an toàn vì chỉ giới hạn trong môi trường Staging, không làm ảnh hưởng Production.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
                  <AlertDialogAction className="rounded-xl bg-red-600 hover:bg-red-700" onClick={handleReindex}>
                    Đồng ý Reindex
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CRMCard>

          <CRMCard className="p-6">
            <h3 className="text-md font-black text-slate-900 mb-2">Staging Smoke Test</h3>
            <p className="text-xs text-slate-500 mb-6">Chạy kiểm tra AI Retrieval end-to-end trên Staging để xác minh Context Guard.</p>
            
            <Button 
              onClick={handleSmokeTest} 
              disabled={testing || !status.isConfigured}
              variant="outline"
              className="w-full font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Run RAG Smoke Test
            </Button>
          </CRMCard>
        </div>
      </main>
    </CRMPageContainer>
  );
}
