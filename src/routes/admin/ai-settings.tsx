import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ProviderConfigCard from "@/components/ai/ProviderConfigCard";
import ModulesControlCard from "@/components/ai/ModulesControlCard";
import AiGovernanceCard from "@/components/ai/AiGovernanceCard";
import BehaviorLimitsCard from "@/components/ai/BehaviorLimitsCard";
import TestConnectionButton from "@/components/ai/TestConnectionButton";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { toast } from "sonner";
import { Lock, BrainCircuit } from "lucide-react";

export const AiSettingsPage: React.FC = () => {
  const { isAdminOrSubAdmin, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_ai_settings_masked");
    if (error) {
      console.error(error);
      toast.error("Failed to load AI settings");
    } else {
      setSettings(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdminOrSubAdmin) {
      fetchSettings();
    }
  }, [authLoading, isAdminOrSubAdmin]);

  const handleRefresh = () => {
    fetchSettings();
  };

  // Update local settings when child components change values
  const handleChange = (updated: Partial<any>) => {
    setSettings((prev: any) => ({ ...prev, ...updated }));
    // Do NOT auto-save. Wait for the user to click Save Settings.
  };

  const handleSaveAll = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.rpc("update_ai_settings", {
      p_provider: settings.provider,
      p_chat_model: settings.chat_model,
      p_embedding_model: settings.embedding_model,
      p_module_product_tutor: settings.module_product_tutor,
      p_module_rewrite: settings.module_rewrite,
      p_module_customer_summary: settings.module_customer_summary,
      p_module_sales_assistant: settings.module_sales_assistant,
      p_max_tokens: settings.max_tokens,
      p_temperature: settings.temperature,
      p_system_tone: settings.system_tone,
      p_daily_token_limit: settings.daily_token_limit,
      p_monthly_cost_limit: settings.monthly_cost_limit,
      p_openai_api_key: settings.openai_api_key,
      p_gemini_api_key: settings.gemini_api_key,
      p_anthropic_api_key: settings.anthropic_api_key,
      p_ai_enabled: settings.ai_enabled,
      p_ai_customer_suggestions_enabled: settings.ai_customer_suggestions_enabled,
      p_ai_sales_assistant_enabled: settings.ai_sales_assistant_enabled,
      p_ai_rag_enabled: settings.ai_rag_enabled,
      p_ai_rewrite_enabled: settings.ai_rewrite_enabled,
      p_ai_daily_limit: settings.ai_daily_limit,
      p_ai_cache_minutes: settings.ai_cache_minutes,
    });
    if (error) {
      console.error(error);
      toast.error("Failed to save AI settings");
    } else {
      toast.success("AI settings saved successfully");
      handleRefresh();
    }
    setSaving(false);
  };

  // Phase P3: Guard — only admin/sub_admin may access this page
  if (!authLoading && !isAdminOrSubAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">
          Trang Cấu hình AI chỉ dành riêng cho Admin hoặc Phó Admin.
        </p>
        <Link
          to="/workspace"
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
        >
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  return (
    <WorkspaceShell
      title="AI Settings & Provider Control Center"
      icon={<BrainCircuit className="w-6 h-6" />}
      loading={loading}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Cấu hình AI</h2>
          <TestConnectionButton settings={settings} onSuccess={handleRefresh} />
        </div>
        <AiGovernanceCard settings={settings} onChange={handleChange} />
        <ProviderConfigCard settings={settings} onChange={handleChange} />
        <ModulesControlCard settings={settings} onChange={handleChange} />
        <BehaviorLimitsCard settings={settings} onChange={handleChange} />
        <div className="flex justify-end space-x-2">
          <button
            onClick={handleSaveAll}
            disabled={saving || loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </WorkspaceShell>
  );
};

export const Route = createFileRoute("/admin/ai-settings")({
  component: AiSettingsPage,
});
