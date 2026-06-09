import React, { useRef, useEffect } from "react";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Loader2,
  Copy,
  Bot,
  User,
  RefreshCcw,
  Save,
  FileText,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProductCopilot, ChatMessage } from "./useProductCopilot";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCopilotContext } from "./ProductCopilotContext";

export function ProductCopilot() {
  const {
    isOpen,
    toggleChat,
    closeChat,
    messages,
    isLoading,
    sendMessage,
    clearHistory,
    customerContext,
  } = useProductCopilot();

  const { settings, quickReplies } = useCopilotContext();
  const { user, isAdmin, isSubAdmin } = useAuth();

  const currentSuggestions = React.useMemo(() => {
    if (!quickReplies || quickReplies.length === 0) return [];
    if (customerContext) {
      return quickReplies.filter((q) => q.requires_context).map((q) => q.prompt);
    }
    return quickReplies.filter((q) => !q.requires_context).map((q) => q.prompt);
  }, [quickReplies, customerContext]);

  const [inputValue, setInputValue] = React.useState("");
  const [copiedZaloId, setCopiedZaloId] = React.useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handleSuggestionClick = (text: string) => {
    if (isLoading) return;
    sendMessage(text);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã copy nội dung");
    if (user) {
      supabase
        .from("pilot_usage_metrics")
        .insert({
          user_id: user.id,
          action_key: "product_copilot_copy",
          metadata: { text_length: text.length },
        })
        .then();
    }
  };

  const handleCopyZalo = (msgId: string, text: string) => {
    const zaloText = `Chào bạn, mình gửi bạn thông tin nhé:\n\n${text.replace(/\*\*/g, "")}\n\nCần hỗ trợ thêm cứ nhắn mình nhé!`;
    navigator.clipboard.writeText(zaloText);
    setCopiedZaloId(msgId);
    toast.success("Đã copy format Zalo");
    setTimeout(() => setCopiedZaloId(null), 2000);

    if (user) {
      supabase
        .from("pilot_usage_metrics")
        .insert({
          user_id: user.id,
          action_key: "product_copilot_copy_zalo",
          metadata: { msgId },
        })
        .then();
    }
  };

  const handleSaveNote = async (text: string) => {
    if (!customerContext || !user) return;

    try {
      const { error } = await supabase.from("customer_activities").insert({
        customer_id: customerContext.currentCustomerId,
        created_by: user.id,
        activity_type: "note",
        title: "Ghi chú từ AI Copilot",
        content: text,
      });
      if (error) throw error;
      toast.success("Đã lưu vào ghi chú khách hàng");

      supabase
        .from("pilot_usage_metrics")
        .insert({
          user_id: user.id,
          action_key: "product_copilot_save_note",
          metadata: { customer_id: customerContext.currentCustomerId },
        })
        .then();
    } catch (err) {
      toast.error("Không thể lưu ghi chú");
    }
  };

  const handleSaveTemplate = async (text: string) => {
    if (!user) return;
    const isShared = isAdmin || isSubAdmin;
    try {
      const { error } = await supabase.from("message_templates").insert({
        name: "Gợi ý từ AI Copilot",
        key: `copilot_${Date.now()}`,
        body_template: text,
        channel: "zalo",
        purpose: "transactional",
        is_active: true,
      });
      if (error) throw error;
      toast.success(isShared ? "Đã lưu thành mẫu dùng chung" : "Đã lưu thành mẫu cá nhân");

      supabase
        .from("pilot_usage_metrics")
        .insert({
          user_id: user.id,
          action_key: "product_copilot_create_template",
          metadata: { is_shared: isShared },
        })
        .then();
    } catch (err) {
      toast.error("Không thể tạo mẫu tin nhắn");
    }
  };

  // Runtime checks
  if (settings) {
    if (!settings.enabled) return null;
    if ((isAdmin || isSubAdmin) && !settings.admin_enabled) return null;
    if (!(isAdmin || isSubAdmin) && !settings.sale_enabled) return null;
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+76px)] lg:bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center
          ${
            isOpen
              ? "bg-slate-800 text-white shadow-slate-900/20"
              : "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-indigo-500/30"
          }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+148px)] lg:bottom-24 right-6 z-50 w-[380px] h-[600px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide">Product Copilot</h3>
                <p className="text-[11px] text-white/60 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  {customerContext
                    ? `Đang hỗ trợ: ${customerContext.customerName}`
                    : "Cẩm nang sản phẩm"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                onClick={clearHistory}
                title="Xóa đoạn chat"
              >
                <RefreshCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                onClick={closeChat}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-slate-500 fade-in">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-indigo-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-700">Xin chào! 👋</p>
                  <p className="text-xs">Tôi có thể giúp gì cho bạn về sản phẩm hôm nay?</p>
                </div>

                {/* Suggestions */}
                <div className="w-full pt-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Gợi ý câu hỏi
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {currentSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(sug)}
                        className="text-[11px] font-medium bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === "user" ? "bg-slate-200" : "bg-indigo-100"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="w-4 h-4 text-slate-600" />
                      ) : (
                        <Bot className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`flex flex-col gap-1 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                          msg.role === "user"
                            ? "bg-slate-900 text-white rounded-tr-sm"
                            : msg.isError
                              ? "bg-rose-50 text-rose-800 border border-rose-100 rounded-tl-sm"
                              : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm"
                        }`}
                      >
                        {/* Simple markdown parsing for bold text if needed, or just plain text */}
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>

                      {msg.role === "assistant" && !msg.isError && (
                        <div className="mt-1 flex flex-col gap-2 w-full">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => handleCopy(msg.content)}
                              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-200 px-2 py-1 rounded shadow-sm transition-colors"
                            >
                              <Copy className="w-3 h-3" /> Copy tư vấn
                            </button>
                            <button
                              onClick={() => handleCopyZalo(msg.id, msg.content)}
                              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 px-2 py-1 rounded shadow-sm transition-colors"
                            >
                              {copiedZaloId === msg.id ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <MessageSquare className="w-3 h-3" />
                              )}{" "}
                              Copy Zalo
                            </button>
                            <button
                              onClick={() => handleSaveNote(msg.content)}
                              disabled={!customerContext}
                              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-emerald-600 bg-white border border-slate-200 hover:border-emerald-200 px-2 py-1 rounded shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                !customerContext ? "Vui lòng mở một khách hàng để lưu ghi chú" : ""
                              }
                            >
                              <Save className="w-3 h-3" /> Lưu Note
                            </button>
                            <button
                              onClick={() => handleSaveTemplate(msg.content)}
                              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-amber-600 bg-white border border-slate-200 hover:border-amber-200 px-2 py-1 rounded shadow-sm transition-colors"
                            >
                              <FileText className="w-3 h-3" /> Tạo mẫu
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-400 italic">
                            Gợi ý từ cẩm nang sản phẩm. Vui lòng kiểm tra trước khi gửi khách.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                      <span
                        className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></span>
                      <span
                        className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100 shrink-0">
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 relative bg-slate-50 border border-slate-200 rounded-2xl p-1 focus-within:border-indigo-300 focus-within:bg-white transition-colors"
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Hỏi về sản phẩm, phác đồ..."
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[13px] h-10 px-3"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim() || isLoading}
                className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:bg-slate-300"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
