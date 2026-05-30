import React from "react";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCustomerDataHealth, DataHealthResult } from "@/lib/customers/dataHealth";

interface DataHealthBadgeProps {
  customer?: any;
  healthResult?: DataHealthResult;
  mode?: "compact" | "full";
  className?: string;
}

export function DataHealthBadge({ customer, healthResult, mode = "compact", className = "" }: DataHealthBadgeProps) {
  const result = healthResult || getCustomerDataHealth(customer);
  
  if (!result) return null;

  const Icon = result.severity === "danger" ? ShieldAlert : 
               result.severity === "warning" ? AlertCircle : CheckCircle2;

  const badgeContent = (
    <Badge variant="outline" className={`flex items-center gap-1 cursor-help transition-colors ${result.badgeClassName} ${className}`}>
      <Icon className="w-3 h-3" />
      {mode === "full" ? (
        <span className="font-bold text-[10px] uppercase tracking-wider">{result.label}</span>
      ) : (
        <span className="font-bold text-[10px] uppercase tracking-wider hidden sm:inline-block">
          {result.severity === "ok" ? "OK" : result.primaryReason || result.label}
        </span>
      )}
      {result.reasons.length > 1 && mode !== "full" && (
        <span className="ml-0.5 text-[9px] opacity-80">(+{result.reasons.length - 1})</span>
      )}
    </Badge>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex shrink-0">
            {badgeContent}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3 space-y-2 rounded-xl shadow-xl border-slate-100 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Icon className={`w-4 h-4 ${result.severity === 'danger' ? 'text-rose-500' : result.severity === 'warning' ? 'text-amber-500' : 'text-emerald-500'}`} />
            <span className="font-black text-xs text-slate-800 uppercase tracking-widest">{result.label}</span>
          </div>
          {result.severity === "ok" ? (
            <p className="text-xs text-slate-500 font-medium">Dữ liệu khách hàng đầy đủ và đang được chăm sóc tốt.</p>
          ) : (
            <ul className="space-y-1">
              {result.reasons.map((r, i) => (
                <li key={i} className="text-[11px] font-medium text-slate-600 flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
