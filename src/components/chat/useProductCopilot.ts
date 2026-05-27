import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCopilotContext } from "./ProductCopilotContext";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export function useProductCopilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { customerContext } = useCopilotContext();

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      supabase.from('pilot_usage_metrics').insert({
        user_id: user.id,
        action_key: 'product_copilot_ask',
        metadata: { hasContext: !!customerContext }
      }).then();
    }

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      if (!token) {
        throw new Error("Vui lòng đăng nhập để sử dụng tính năng này.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sales-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            mode: "rag_audit",
            query: text,
            auditMode: "product_tutor",
            threshold: 0.2,
            customerContext: customerContext || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Có lỗi xảy ra khi gọi AI");
      }

      const result = await response.json();

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.final_answer || "Xin lỗi, tôi chưa hiểu rõ ý bạn.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error: any) {
      console.error("AI Error:", error);
      toast.error(error.message || "Lỗi kết nối AI");
      
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Đã có lỗi xảy ra khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.",
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleChat = useCallback(() => setIsOpen(p => !p), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const clearHistory = useCallback(() => setMessages([]), []);

  return {
    isOpen,
    toggleChat,
    closeChat,
    messages,
    isLoading,
    sendMessage,
    clearHistory,
    customerContext
  };
}
