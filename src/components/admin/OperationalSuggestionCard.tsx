import React from "react";
import { InterventionSeverity, OperationalIntervention } from "@/lib/operationalInterventions";
import { AlertCircle, ArrowRight, Zap, Target, AlertTriangle, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OperationalSuggestionCardProps {
  intervention: OperationalIntervention;
  onAction?: (intervention: OperationalIntervention) => void;
}

const severityConfig: Record<
  InterventionSeverity,
  { bg: string; border: string; icon: any; iconColor: string }
> = {
  critical: {
    bg: "bg-rose-50/50",
    border: "border-rose-200/50",
    icon: AlertOctagon,
    iconColor: "text-rose-500",
  },
  warning: {
    bg: "bg-amber-50/50",
    border: "border-amber-200/50",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
  monitor: {
    bg: "bg-slate-50/50",
    border: "border-slate-200/50",
    icon: AlertCircle,
    iconColor: "text-slate-400",
  },
};

export function OperationalSuggestionCard({
  intervention,
  onAction,
}: OperationalSuggestionCardProps) {
  const config = severityConfig[intervention.severity];
  const Icon = config.icon;

  return (
    <div
      className={`p-4 rounded-xl border ${config.bg} ${config.border} flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-sm`}
    >
      <div className="flex gap-3 items-start">
        <div className="mt-0.5">
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">{intervention.title}</h4>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">{intervention.reason}</p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="bg-white hover:bg-slate-50 border-slate-200 text-xs font-bold text-slate-700 w-full md:w-auto shrink-0"
        onClick={() => onAction?.(intervention)}
      >
        <Target className="w-3.5 h-3.5 mr-1.5" />
        {intervention.suggestedAction}
      </Button>
    </div>
  );
}
