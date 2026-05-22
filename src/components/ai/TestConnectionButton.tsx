// src/components/ai/TestConnectionButton.tsx
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  settings: {
    provider: string;
    chat_model: string;
    openai_api_key?: string;
  } | null;
  onSuccess?: () => void;
}

export const TestConnectionButton: React.FC<Props> = ({ settings, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    if (!settings) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-ai-connection", {
        body: {
          provider: settings.provider || "openai",
          model: settings.chat_model || "gpt-4o-mini",
          openai_api_key: settings.openai_api_key || ""
        },
      });
      if (error) {
        toast.error(error.message || "Test connection failed");
      } else if (data?.status === "pass") {
        toast.success(data.message || "Test connection successful");
        onSuccess?.();
      } else {
        toast.error(data?.message || "Test connection failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Test connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={testConnection}
      disabled={loading || !settings}
      className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors"
    >
      {loading ? "Testing…" : "🔗 Test Connection"}
    </button>
  );
};

export default TestConnectionButton;
