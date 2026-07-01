import React, { useEffect, useState } from "react";
import { AlertCircle, Flame, ShieldAlert, Sparkles, Target, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getCustomerHealth,
  getRiskFlags,
  getInteractionHeatLevel,
  CustomerHealth,
  HeatLevel,
} from "@/lib/customerHealth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerRiskSummaryProps {
  customer: any;
}

export const CustomerRiskSummary: React.FC<CustomerRiskSummaryProps> = ({ customer }) => {
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const healthStatus: CustomerHealth = getCustomerHealth(customer);
  const riskFlags: string[] = getRiskFlags(customer);
  const heatLevel: HeatLevel = getInteractionHeatLevel(customer);

  useEffect(() => {
    let isMounted = true;
    const fetchCachedAi = async () => {
      if (!customer?.id) return;
      try {
        const { data } = await supabase
          .from("ai_customer_suggestions")
          .select("suggestion_json")
          .eq("customer_id", customer.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (isMounted && data) {
          setAiSuggestion(data.suggestion_json);
        }
      } catch (e) {
        // silently ignore error if no active suggestion
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchCachedAi();
    return () => {
      isMounted = false;
    };
  }, [customer?.id]);

  const getHealthColor = (status: CustomerHealth) => {
    switch (status) {
      case "good":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200";
      case "warning":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200";
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200";
    }
  };

  const getHeatColor = (level: HeatLevel) => {
    switch (level) {
      case "hot":
        return "text-red-500 bg-red-50 dark:bg-red-950 border-red-200";
      case "warm":
        return "text-orange-500 bg-orange-50 dark:bg-orange-950 border-orange-200";
      case "cold":
        return "text-blue-500 bg-blue-50 dark:bg-blue-950 border-blue-200";
      case "frozen":
        return "text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200";
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-background border rounded-lg shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          Tổng quan Sức khỏe & Rủi ro
        </h4>
        <Badge variant="outline" className={`capitalize ${getHealthColor(healthStatus)}`}>
          {healthStatus === "good"
            ? "Ổn định"
            : healthStatus === "warning"
              ? "Cảnh báo"
              : healthStatus === "critical"
                ? "Nguy hiểm"
                : "Chưa rõ"}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={`flex items-center gap-1 ${getHeatColor(heatLevel)}`}>
          <Flame className="w-3 h-3" />
          {heatLevel === "hot"
            ? "Đang nóng"
            : heatLevel === "warm"
              ? "Đang ấm"
              : heatLevel === "cold"
                ? "Đang lạnh"
                : "Đóng băng"}
        </Badge>
        {riskFlags.slice(0, 3).map((flag, i) => (
          <Badge
            key={i}
            variant="secondary"
            className="bg-slate-100 dark:bg-slate-800 text-xs font-normal"
          >
            {flag}
          </Badge>
        ))}
        {riskFlags.length > 3 && (
          <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-xs font-normal">
            +{riskFlags.length - 3} rủi ro khác
          </Badge>
        )}
        {riskFlags.length === 0 && (
          <span className="text-xs text-muted-foreground italic flex items-center">
            <Activity className="w-3 h-3 mr-1" /> Không phát hiện rủi ro
          </span>
        )}
      </div>

      {(loading || aiSuggestion) && (
        <div className="mt-2 pt-3 border-t border-dashed">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center">
            <Sparkles className="w-3 h-3 mr-1 text-blue-500" /> AI Đề xuất (Dữ liệu lưu)
          </h4>
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded text-sm border border-blue-100 dark:border-blue-900/50">
              {aiSuggestion.next_best_action && (
                <div className="flex items-start gap-2 mb-1">
                  <Target className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {aiSuggestion.next_best_action.action}
                  </span>
                </div>
              )}
              {aiSuggestion.recommended_channel && (
                <div className="text-xs text-slate-500 ml-6">
                  Kênh khuyên dùng:{" "}
                  <span className="font-semibold uppercase text-blue-600 dark:text-blue-400">
                    {aiSuggestion.recommended_channel.platform}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
