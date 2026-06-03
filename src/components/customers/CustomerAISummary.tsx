import React, { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  ArrowRight,
  Brain,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface AISummaryResult {
  summary: string;
  current_status: string;
  key_insights: string[];
  risks: string[];
  suggested_next_actions: string[];
  conversation_id?: string;
}

interface CustomerAISummaryProps {
  customerId: string;
  customerName?: string;
}

/* ─── Skeleton Loader ──────────────────────────────────────── */
function SkeletonLine({ w = "w-full", h = "h-3" }: { w?: string; h?: string }) {
  return (
    <div
      className={`${w} ${h} rounded-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-pulse`}
      style={{ backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }}
    />
  );
}

function AISkeleton() {
  return (
    <div className="space-y-3">
      {/* Summary card skeleton */}
      <div className="rounded-xl border border-indigo-100/70 bg-gradient-to-br from-slate-50 to-indigo-50/20 p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-indigo-200 animate-pulse" />
          <SkeletonLine w="w-12" h="h-2.5" />
        </div>
        <SkeletonLine />
        <SkeletonLine w="w-4/5" />
        <SkeletonLine w="w-3/5" />
      </div>
      {/* Status card skeleton */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-slate-200 animate-pulse shrink-0" />
        <div className="space-y-1.5 flex-1">
          <SkeletonLine w="w-24" h="h-2" />
          <SkeletonLine w="w-36" h="h-3" />
        </div>
      </div>
      {/* Insights skeleton */}
      <div className="rounded-xl border border-amber-100/70 bg-amber-50/20 p-3.5 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-200 animate-pulse" />
          <SkeletonLine w="w-16" h="h-2.5" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-md bg-amber-100 shrink-0 mt-0.5" />
            <SkeletonLine w={i === 2 ? "w-3/4" : "w-full"} />
          </div>
        ))}
      </div>
      {/* Actions skeleton */}
      <div className="rounded-xl border border-emerald-100/70 bg-emerald-50/20 p-3.5 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-200 animate-pulse" />
          <SkeletonLine w="w-20" h="h-2.5" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-md bg-emerald-100 shrink-0 mt-0.5" />
            <SkeletonLine w={i === 2 ? "w-4/5" : "w-full"} />
          </div>
        ))}
      </div>
      <div className="text-center pt-1">
        <div className="inline-flex items-center gap-1.5 text-[10px] text-indigo-500/80 font-medium animate-pulse">
          <div className="w-3 h-3 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
          AI đang tổng hợp dữ liệu khách hàng...
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */
export const CustomerAISummary: React.FC<CustomerAISummaryProps> = ({
  customerId,
  customerName,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AISummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Feedback state
  const [feedbackType, setFeedbackType] = useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleSummarize = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFeedbackType(null);
    setFeedbackNote("");
    setFeedbackSubmitted(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-sales-assistant", {
        body: {
          customerId,
          mode: "summary",
        },
      });

      if (fnError) {
        setError(fnError.message || "Không thể kết nối AI. Vui lòng thử lại.");
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setResult({
        summary: data.summary || "",
        current_status: data.current_status || "",
        key_insights: data.key_insights || [],
        risks: data.risks || [],
        suggested_next_actions: data.suggested_next_actions || [],
        conversation_id: data.conversation_id || null,
      });
    } catch (err: any) {
      setError(err?.message || "Lỗi không xác định khi gọi AI.");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const handleCopy = useCallback(() => {
    if (!result) return;

    const text = [
      `📋 TÓM TẮT KHÁCH HÀNG${customerName ? `: ${customerName}` : ""}`,
      "",
      `📝 Tóm tắt: ${result.summary}`,
      "",
      `🔄 Tình trạng: ${result.current_status}`,
      "",
      "💡 Điểm đáng chú ý:",
      ...result.key_insights.map((k, i) => `  ${i + 1}. ${k}`),
      "",
      "⚠️ Rủi ro:",
      ...(result.risks.length > 0
        ? result.risks.map((r, i) => `  ${i + 1}. ${r}`)
        : ["  Không có rủi ro đáng chú ý."]),
      "",
      "➡️ Hành động đề xuất:",
      ...result.suggested_next_actions.map((a, i) => `  ${i + 1}. ${a}`),
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Đã copy kết quả AI");
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result, customerName]);

  const handleFeedback = useCallback(
    async (type: "thumbs_up" | "thumbs_down") => {
      if (feedbackSubmitted) return;
      setFeedbackType(type);
      if (type === "thumbs_up") {
        // Submit immediately on thumbs_up
        await submitFeedback(type, "");
      }
      // thumbs_down shows textarea first
    },
    [feedbackSubmitted, result],
  );

  const submitFeedback = async (type: "thumbs_up" | "thumbs_down", note: string) => {
    setFeedbackSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Không xác định người dùng.");

      const payload: Record<string, any> = {
        user_id: user.id,
        customer_id: customerId,
        feedback_type: type,
        mode: "summary",
        content_shown: result?.summary ?? null,
      };
      if (note.trim()) payload.feedback_note = note.trim();
      if (result?.conversation_id) payload.conversation_id = result.conversation_id;

      const { error: dbErr } = await supabase.from("ai_feedback").insert(payload);
      if (dbErr) throw dbErr;

      setFeedbackSubmitted(true);
      toast.success(
        type === "thumbs_up"
          ? "Cảm ơn phản hồi tích cực! 🎉"
          : "Đã ghi nhận phản hồi. Sẽ cải thiện sớm!",
      );
    } catch (err: any) {
      toast.error("Không thể gửi phản hồi: " + (err.message || "Lỗi không xác định."));
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Status badge color
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("hoạt động") || s.includes("tốt") || s.includes("tích cực"))
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s.includes("nguy cơ") || s.includes("mất") || s.includes("rời"))
      return "bg-rose-50 text-rose-700 border-rose-200";
    if (s.includes("cần") || s.includes("chăm sóc") || s.includes("chú ý"))
      return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  return (
    <div className="space-y-3">
      {/* ── Header & controls ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-600 font-black text-sm uppercase tracking-widest">
          <Brain className="w-4 h-4" /> AI tư vấn
        </div>
        {result && !loading && (
          <div className="flex items-center gap-1.5">
            <button
              id="ai-summary-copy-btn"
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-md hover:bg-indigo-50 border border-transparent hover:border-indigo-100 active:scale-95"
              title="Copy kết quả"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">{copied ? "Đã copy" : "Copy"}</span>
            </button>
            <button
              id="ai-summary-refresh-btn"
              onClick={handleSummarize}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-md hover:bg-indigo-50 border border-transparent hover:border-indigo-100 active:scale-95"
              title="Phân tích lại"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Initial (empty) state ── */}
      {!result && !loading && !error && (
        <button
          id="ai-summary-start-btn"
          onClick={handleSummarize}
          className="w-full group relative overflow-hidden rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50 p-5 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-100/50 active:scale-[0.98]"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200/50 group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
            </div>
            <div className="text-center">
              <div className="text-sm font-black text-slate-800 mb-1">AI tóm tắt khách</div>
              <div className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[240px]">
                Phân tích hồ sơ, đơn hàng, lịch sử chăm sóc và đề xuất hành động tiếp theo
              </div>
            </div>
          </div>
        </button>
      )}

      {/* ── Skeleton loading state ── */}
      {loading && <AISkeleton />}

      {/* ── Error state ── */}
      {error && !loading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-rose-800 mb-1">Không thể phân tích</div>
              <div className="text-[11px] text-rose-600 leading-relaxed">{error}</div>
            </div>
          </div>
          <Button
            id="ai-summary-retry-btn"
            onClick={handleSummarize}
            variant="outline"
            size="sm"
            className="w-full text-xs font-bold border-rose-200 text-rose-700 hover:bg-rose-100 gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Thử lại
          </Button>
        </div>
      )}

      {/* ── Result display ── */}
      {result && !loading && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-400">
          {/* Summary */}
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-indigo-100/70 p-3.5 space-y-2">
            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
              <Brain className="w-3 h-3" /> Tóm tắt
            </div>
            <p className="text-xs text-slate-700 leading-[1.7] font-medium">
              {result.summary || "Không có dữ liệu để tóm tắt."}
            </p>
          </div>

          {/* Current Status */}
          {result.current_status && (
            <div
              className={`rounded-xl border p-3 flex items-center gap-2.5 ${getStatusColor(
                result.current_status,
              )}`}
            >
              <div className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                  Tình trạng hiện tại
                </div>
                <div className="text-xs font-bold mt-0.5">{result.current_status}</div>
              </div>
            </div>
          )}

          {/* Key Insights */}
          {result.key_insights.length > 0 && (
            <div className="rounded-xl border border-amber-100/70 bg-amber-50/30 p-3.5 space-y-2">
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3" /> Điểm đáng chú ý
              </div>
              <div className="space-y-2">
                {result.key_insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-[11px] text-amber-900 font-medium leading-[1.6]"
                  >
                    <span className="w-4 h-4 rounded-md bg-amber-200/60 flex items-center justify-center text-[9px] font-black text-amber-700 shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {result.risks.length > 0 && (
            <div className="rounded-xl border border-rose-100/70 bg-rose-50/30 p-3.5 space-y-2">
              <div className="text-[10px] font-bold text-rose-600 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3" /> Rủi ro
              </div>
              <div className="space-y-2">
                {result.risks.map((risk, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-[11px] text-rose-800 font-medium leading-[1.6]"
                  >
                    <span className="w-4 h-4 rounded-md bg-rose-200/60 flex items-center justify-center text-[9px] font-black text-rose-700 shrink-0 mt-0.5">
                      !
                    </span>
                    {risk}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Next Actions */}
          {result.suggested_next_actions.length > 0 && (
            <div className="rounded-xl border border-emerald-100/70 bg-emerald-50/30 p-3.5 space-y-2">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3" /> Hành động đề xuất
              </div>
              <div className="space-y-2">
                {result.suggested_next_actions.map((action, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-[11px] text-emerald-800 font-medium leading-[1.6]"
                  >
                    <span className="w-4 h-4 rounded-md bg-emerald-200/60 flex items-center justify-center text-[9px] font-black text-emerald-700 shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Sale Feedback Section ── */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2.5">
            {!feedbackSubmitted ? (
              <>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                  Kết quả có hữu ích không?
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    id="ai-feedback-thumbsup-btn"
                    onClick={() => handleFeedback("thumbs_up")}
                    disabled={feedbackSubmitting || feedbackType === "thumbs_up"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border active:scale-95 ${
                      feedbackType === "thumbs_up"
                        ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Hữu ích
                  </button>
                  <button
                    id="ai-feedback-thumbsdown-btn"
                    onClick={() => handleFeedback("thumbs_down")}
                    disabled={feedbackSubmitting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border active:scale-95 ${
                      feedbackType === "thumbs_down"
                        ? "bg-rose-100 border-rose-300 text-rose-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Chưa đúng
                  </button>
                </div>

                {/* Thumbs-down note input */}
                {feedbackType === "thumbs_down" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <textarea
                      id="ai-feedback-note-input"
                      value={feedbackNote}
                      onChange={(e) => setFeedbackNote(e.target.value)}
                      placeholder="Vấn đề bạn gặp phải? VD: thông tin sai, thiếu sản phẩm, không phù hợp..."
                      rows={2}
                      className="w-full text-[11px] rounded-lg border border-slate-200 px-2.5 py-2 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 resize-none leading-relaxed"
                    />
                    <div className="flex gap-2">
                      <button
                        id="ai-feedback-cancel-btn"
                        onClick={() => setFeedbackType(null)}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded transition-colors"
                      >
                        <X className="w-3 h-3" /> Huỷ
                      </button>
                      <button
                        id="ai-feedback-submit-btn"
                        onClick={() => submitFeedback("thumbs_down", feedbackNote)}
                        disabled={feedbackSubmitting}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg transition-colors active:scale-95 disabled:opacity-60"
                      >
                        {feedbackSubmitting ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        Gửi phản hồi
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 py-1 text-xs font-semibold text-slate-500 animate-in fade-in duration-300">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Cảm ơn! Phản hồi đã được ghi nhận.
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="text-[9px] text-slate-400 text-center font-medium italic pt-0.5">
            Kết quả chỉ mang tính tham khảo, dựa trên dữ liệu hiện có trong hệ thống.
          </div>
        </div>
      )}
    </div>
  );
};
