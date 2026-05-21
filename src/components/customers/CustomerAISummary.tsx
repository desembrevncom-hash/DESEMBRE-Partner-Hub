import React, { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Loader2, 
  Copy, 
  Check, 
  AlertTriangle, 
  Lightbulb, 
  ShieldAlert, 
  ArrowRight,
  Brain,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

interface AISummaryResult {
  summary: string;
  current_status: string;
  key_insights: string[];
  risks: string[];
  suggested_next_actions: string[];
}

interface CustomerAISummaryProps {
  customerId: string;
  customerName?: string;
}

export const CustomerAISummary: React.FC<CustomerAISummaryProps> = ({
  customerId,
  customerName,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AISummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSummarize = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "ai-sales-assistant",
        {
          body: {
            customerId,
            mode: "summary",
          },
        }
      );

      if (fnError) {
        // Edge function invocation error
        setError(fnError.message || "Không thể kết nối AI. Vui lòng thử lại.");
        return;
      }

      if (data?.error) {
        // Application-level error from function
        setError(data.error);
        return;
      }

      setResult({
        summary: data.summary || "",
        current_status: data.current_status || "",
        key_insights: data.key_insights || [],
        risks: data.risks || [],
        suggested_next_actions: data.suggested_next_actions || [],
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

  // Status badge color
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("hoạt động") || s.includes("tốt") || s.includes("tích cực")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s.includes("nguy cơ") || s.includes("mất") || s.includes("rời")) return "bg-rose-50 text-rose-700 border-rose-200";
    if (s.includes("cần") || s.includes("chăm sóc") || s.includes("chú ý")) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  return (
    <div className="space-y-3">
      {/* Header & CTA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-600 font-black text-sm uppercase tracking-widest">
          <Brain className="w-4 h-4" /> AI tư vấn
        </div>
        {result && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-md hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
              title="Copy kết quả"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {copied ? "Đã copy" : "Copy"}
            </button>
            <button
              onClick={handleSummarize}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-md hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
              title="Phân tích lại"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </button>
          </div>
        )}
      </div>

      {/* Initial State - Show Button */}
      {!result && !loading && !error && (
        <button
          onClick={handleSummarize}
          className="w-full group relative overflow-hidden rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50 p-5 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-100/50"
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

      {/* Loading State */}
      {loading && (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-violet-50/30 p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-indigo-200 animate-ping opacity-20" />
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-indigo-700 mb-1">Đang phân tích...</div>
              <div className="text-[10px] text-indigo-500/80 font-medium">AI đang tổng hợp dữ liệu khách hàng</div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-rose-800 mb-1">Không thể phân tích</div>
              <div className="text-[11px] text-rose-600 leading-relaxed">{error}</div>
            </div>
          </div>
          <Button
            onClick={handleSummarize}
            variant="outline"
            size="sm"
            className="w-full text-xs font-bold border-rose-200 text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" /> Thử lại
          </Button>
        </div>
      )}

      {/* Result Display */}
      {result && !loading && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-indigo-100/70 p-3.5 space-y-2">
            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
              <Brain className="w-3 h-3" /> Tóm tắt
            </div>
            <div className="text-xs text-slate-700 leading-relaxed font-medium">
              {result.summary || "Không có dữ liệu để tóm tắt."}
            </div>
          </div>

          {/* Current Status */}
          {result.current_status && (
            <div className={`rounded-xl border p-3 flex items-center gap-2.5 ${getStatusColor(result.current_status)}`}>
              <div className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Tình trạng hiện tại</div>
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
              <div className="space-y-1.5">
                {result.key_insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-[11px] text-amber-800 font-medium leading-relaxed"
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
              <div className="space-y-1.5">
                {result.risks.map((risk, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-[11px] text-rose-800 font-medium leading-relaxed"
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
              <div className="space-y-1.5">
                {result.suggested_next_actions.map((action, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-[11px] text-emerald-800 font-medium leading-relaxed"
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

          {/* Disclaimer */}
          <div className="text-[9px] text-slate-400 text-center font-medium italic pt-1">
            Kết quả chỉ mang tính tham khảo, dựa trên dữ liệu hiện có trong hệ thống.
          </div>
        </div>
      )}
    </div>
  );
};
