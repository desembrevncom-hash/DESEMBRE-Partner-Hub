import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RawSuggestion } from "@/lib/aiSuggestionEngine";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Copy, 
  Check, 
  TrendingUp, 
  AlertTriangle, 
  MessageCircle, 
  RefreshCw,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AISuggestionCardProps {
  suggestions: RawSuggestion[];
  customerId: string;
}

export const AISuggestionCard: React.FC<AISuggestionCardProps> = ({ suggestions, customerId }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rewrittenSuggestions, setRewrittenSuggestions] = useState<RawSuggestion[]>(suggestions);
  const [hasRewritten, setHasRewritten] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Track 'shown' event on mount
  useEffect(() => {
    if (!user || suggestions.length === 0) return;

    const trackShown = async () => {
      try {
        const logs = suggestions.map(s => ({
          suggestion_type: s.type,
          suggestion_rule: s.rule_id,
          suggested_products: s.suggestedProducts || [],
          customer_id: customerId,
          sale_user_id: user.id,
          status: 'shown'
        }));
        await supabase.from("ai_suggestion_analytics").insert(logs);
      } catch (err) {
        console.error("Failed to track suggestion shown", err);
      }
    };
    trackShown();
  }, [suggestions, customerId, user]);

  const handleRewrite = async () => {
    if (suggestions.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-sales-assistant", {
        body: {
          customerId,
          mode: "rewrite_suggestions",
          suggestions: suggestions
        }
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Failed to rewrite");
      }

      if (data?.rewrites && Array.isArray(data.rewrites)) {
        const rewriteMap = new Map(data.rewrites.map((r: any) => [r.id, r.generatedPrompt]));
        const updated = suggestions.map(s => ({
          ...s,
          generatedPrompt: rewriteMap.get(s.id) || s.generatedPrompt
        }));
        setRewrittenSuggestions(updated);
        setHasRewritten(true);
        toast.success("AI đã tạo xong nội dung!");
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi tạo nội dung AI");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (suggestion: RawSuggestion) => {
    const textToCopy = suggestion.generatedPrompt || suggestion.reason;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(suggestion.id);
      toast.success("Đã copy nội dung");
      setTimeout(() => setCopiedId(null), 2000);

      // Track 'copied'
      if (user) {
        await supabase.from("ai_suggestion_analytics").insert({
          suggestion_type: suggestion.type,
          suggestion_rule: suggestion.rule_id,
          suggested_products: suggestion.suggestedProducts || [],
          customer_id: customerId,
          sale_user_id: user.id,
          status: 'copied'
        });
      }
    } catch (err) {
      toast.error("Lỗi khi copy");
    }
  };

  if (suggestions.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case "upsell": return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case "risk": return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case "retention": return <Clock className="w-4 h-4 text-amber-500" />;
      default: return <MessageCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case "upsell": return "border-emerald-100 bg-emerald-50/30";
      case "risk": return "border-rose-100 bg-rose-50/30";
      case "retention": return "border-amber-100 bg-amber-50/30";
      default: return "border-blue-100 bg-blue-50/30";
    }
  };

  const getTitleColor = (type: string) => {
    switch (type) {
      case "upsell": return "text-emerald-700";
      case "risk": return "text-rose-700";
      case "retention": return "text-amber-700";
      default: return "text-blue-700";
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white border border-indigo-100 p-4 shadow-sm relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 text-indigo-700 font-black text-sm uppercase tracking-widest">
          <Sparkles className="w-4 h-4 text-indigo-500" /> Action Suggestion
        </div>
        {!hasRewritten && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleRewrite}
            disabled={loading}
            className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 h-7"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
            Tạo Prompt Sale
          </Button>
        )}
      </div>

      <div className="space-y-3 relative z-10">
        {rewrittenSuggestions.map((s, idx) => (
          <div key={s.id} className={`p-3 rounded-xl border ${getColorClass(s.type)} space-y-2`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                {getIcon(s.type)}
                <span className={getTitleColor(s.type)}>{s.title}</span>
                {s.priority === "high" && (
                  <span className="ml-2 px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] uppercase font-black">Ưu tiên</span>
                )}
              </div>
            </div>
            
            <div className="text-[11px] text-slate-600 font-medium">
              {s.reason}
            </div>

            {hasRewritten && s.generatedPrompt && (
              <div className="mt-2 p-2.5 bg-white/60 rounded-lg border border-slate-100 relative group">
                <div className="text-[11px] text-slate-800 font-medium italic pr-8">
                  "{s.generatedPrompt}"
                </div>
                <button
                  onClick={() => handleCopy(s)}
                  className="absolute top-2 right-2 p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Copy Prompt"
                >
                  {copiedId === s.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
            
            {!hasRewritten && (
              <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                Nên làm: {s.suggestedAction}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
