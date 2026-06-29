import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, AlertCircle, Copy, ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AiSuggestionData {
  next_best_action?: {
    action: string;
    reason: string;
    priority: string;
  };
  recommended_channel?: {
    platform: string;
    reason: string;
  };
  message_suggestion?: {
    platform: string;
    text: string;
    template_id: string | null;
  };
  risk_flags?: {
    type: string;
    severity: string;
    message: string;
  }[];
  confidence?: number;
}

interface CustomerAiSuggestionsProps {
  customerId: string;
}

export const CustomerAiSuggestions: React.FC<CustomerAiSuggestionsProps> = ({ customerId }) => {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AiSuggestionData | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  const { hasPilotAccess } = useAuth();
  const hasAccess = hasPilotAccess("ai_customer_suggestions");

  // Auto-fetch if there's a cached valid suggestion within 30 mins
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const ENABLE_AI_CUSTOMER_SUGGESTIONS_DB = false;
        let data = null;

        if (ENABLE_AI_CUSTOMER_SUGGESTIONS_DB) {
          const res = await supabase
            .from("ai_customer_suggestions")
            .select("*")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          data = res.data;
        }

        if (data && data.status === "active") {
          const createdAt = new Date(data.created_at);
          const diffMins = (new Date().getTime() - createdAt.getTime()) / (1000 * 60);

          if (diffMins < 60) {
            setSuggestion(data.suggestion_json as AiSuggestionData);
            setSuggestionId(data.id);
            setLastGeneratedAt(createdAt);
          }
        }
      } catch (err) {
        console.error("Error fetching cached suggestion:", err);
      }
    };
    if (customerId) {
      fetchExisting();
    }
  }, [customerId]);

  const generateSuggestion = async () => {
    setLoading(true);
    setSuggestion(null);
    setShowMessage(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-customer-suggestions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ customerId }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate");
      }

      const result = await response.json();
      setSuggestion(result.suggestion_json);
      setSuggestionId(result.id);
      setLastGeneratedAt(new Date());
      toast.success("Đã tạo gợi ý mới từ AI");
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      toast.error(`Không thể tạo gợi ý: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: "accepted" | "dismissed") => {
    if (!suggestionId) return;
    try {
      const updateData: any = { status };
      if (status === "accepted") updateData.accepted_at = new Date().toISOString();
      if (status === "dismissed") updateData.dismissed_at = new Date().toISOString();

      await supabase.from("ai_customer_suggestions").update(updateData).eq("id", suggestionId);

      if (status === "dismissed") {
        setSuggestion(null);
        toast.info("Đã bỏ qua gợi ý này");
      } else {
        toast.success("Đã lưu lịch sử sử dụng gợi ý");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyMessage = () => {
    if (suggestion?.message_suggestion?.text) {
      navigator.clipboard.writeText(suggestion.message_suggestion.text);
      toast.success("Đã copy mẫu tin nhắn");
    }
  };

  if (!hasAccess) return null;

  if (!suggestion && !loading && !lastGeneratedAt) {
    return (
      <Card className="bg-slate-50 dark:bg-slate-900 border-dashed border-2 shadow-sm mb-4">
        <CardContent className="pt-6 text-center">
          <Sparkles className="h-8 w-8 mx-auto text-blue-500 mb-2 opacity-50" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
            AI Trợ lý bán hàng
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Nhận gợi ý hành động tiếp theo dựa trên lịch sử tương tác
          </p>
          <Button
            onClick={generateSuggestion}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" /> Tạo gợi ý thông minh
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border border-blue-100 dark:border-slate-700 shadow-sm mb-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles className="h-24 w-24" />
      </div>

      <CardHeader className="pb-3 flex flex-row items-center justify-between z-10 relative">
        <CardTitle className="text-base font-semibold flex items-center text-blue-800 dark:text-blue-400">
          <Sparkles className="h-5 w-5 mr-2" />
          AI Gợi ý bước tiếp theo
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500 hover:text-blue-600"
          onClick={generateSuggestion}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-6 text-blue-600">
            <RefreshCw className="h-8 w-8 animate-spin mb-3 opacity-80" />
            <p className="text-sm font-medium animate-pulse">AI đang phân tích dữ liệu...</p>
          </div>
        ) : suggestion ? (
          <>
            {/* Risk Flags */}
            {suggestion.risk_flags && suggestion.risk_flags.length > 0 && (
              <div className="flex flex-col gap-2">
                {suggestion.risk_flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start p-2 rounded-md text-sm ${flag.severity === "high" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"}`}
                  >
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                    <span>{flag.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Next Best Action */}
            {suggestion.next_best_action && (
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-blue-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    Hành động ưu tiên
                  </span>
                  {suggestion.next_best_action.priority === "high" && (
                    <Badge variant="destructive" className="h-5 text-[10px]">
                      Ưu tiên cao
                    </Badge>
                  )}
                </div>
                <div className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                  {suggestion.next_best_action.action === "call" && "📞 Cần gọi điện"}
                  {suggestion.next_best_action.action === "zalo" && "💬 Gửi Zalo"}
                  {suggestion.next_best_action.action === "facebook" && "📘 Gửi Facebook"}
                  {suggestion.next_best_action.action === "schedule" && "📅 Lên lịch hẹn"}
                  {!["call", "zalo", "facebook", "schedule"].includes(
                    suggestion.next_best_action.action,
                  ) && `💡 ${suggestion.next_best_action.action}`}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {suggestion.next_best_action.reason}
                </p>

                {suggestion.recommended_channel && (
                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-700 p-1.5 rounded inline-block">
                    Đề xuất kênh:{" "}
                    <span className="font-semibold uppercase">
                      {suggestion.recommended_channel.platform}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Message Suggestion (Collapsed) */}
            {suggestion.message_suggestion && suggestion.message_suggestion.text && (
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowMessage(!showMessage)}
                >
                  <div>
                    <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                      Gợi ý tin nhắn ({suggestion.message_suggestion.platform})
                    </span>
                    {!showMessage && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate mt-1 pr-4 max-w-[250px]">
                        "{suggestion.message_suggestion.text}"
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600">
                    {showMessage ? "Thu gọn" : "Xem & Dùng mẫu"}
                  </Button>
                </div>

                {showMessage && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap italic">
                      "{suggestion.message_suggestion.text}"
                    </p>
                    <div className="flex items-center justify-end mt-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyMessage}
                        className="h-8 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1.5" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-blue-600"
                        onClick={() => handleUpdateStatus("accepted")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1.5" /> Dùng hành động này
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-400">
                AI có thể sai sót. Vui lòng kiểm tra kỹ trước khi dùng.
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-slate-500 hover:text-red-600"
                onClick={() => handleUpdateStatus("dismissed")}
              >
                Bỏ qua
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};
