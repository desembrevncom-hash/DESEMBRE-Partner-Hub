import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface FacebookIdentityBadgeProps {
  facebookUid?: string | null;
  resolverMethod?: string | null;
  confidenceScore?: number | null;
  autoResolveStatus?: string | null;
  lastAutoResolveError?: string | null;
  jobStatus?: string | null;
  facebookDisplayName?: string | null;
  displayNameSource?: string | null;
  displayNameConfidenceScore?: number | null;
  onApplyName?: (name: string) => void;
  isApplyPending?: boolean;
  canApplyName?: boolean;
  duplicateProfile?: {
    customers?: {
      id?: string;
      name?: string;
      phone?: string | null;
    } | null;
  } | null;
}

export function FacebookIdentityBadge({
  facebookUid,
  resolverMethod,
  confidenceScore,
  autoResolveStatus,
  lastAutoResolveError,
  jobStatus,
  facebookDisplayName,
  displayNameSource,
  displayNameConfidenceScore,
  onApplyName,
  isApplyPending,
  canApplyName,
  duplicateProfile,
}: FacebookIdentityBadgeProps) {
  // A. UID & Display Name exists
  if (facebookUid || facebookDisplayName) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {facebookUid && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] px-2 py-0.5 cursor-help">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> UID: {facebookUid}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="flex flex-col gap-1">
                <span>Nguồn UID: {resolverMethod || "Không rõ"}</span>
                {confidenceScore !== undefined && confidenceScore !== null && (
                  <span>Độ tin cậy UID: {confidenceScore}%</span>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {facebookDisplayName && (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-[10px] px-2 py-0.5 cursor-help">
                    Tên Facebook: {facebookDisplayName}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="flex flex-col gap-1">
                  <span>Nguồn tên: {displayNameSource || "Không rõ"}</span>
                  {displayNameConfidenceScore !== undefined && displayNameConfidenceScore !== null && (
                    <span>Độ tin cậy tên: {displayNameConfidenceScore}%</span>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {canApplyName && onApplyName && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onApplyName(facebookDisplayName);
                }}
                disabled={isApplyPending}
              >
                {isApplyPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Áp dụng làm tên KH"}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // B. Resolving
  if (autoResolveStatus === "resolving" || autoResolveStatus === "queued") {
    return (
      <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] px-2 py-0.5">
        <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> Đang tìm UID tự động...
      </Badge>
    );
  }

  // D. Duplicate
  if (jobStatus === "duplicate_candidate" || autoResolveStatus === "duplicate_detected") {
    const link = duplicateProfile?.customers?.id ? `/customers?id=${duplicateProfile.customers.id}` : null;
    return (
      <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[10px] px-2 py-0.5 flex items-center gap-1">
        <AlertCircle className="w-2.5 h-2.5" /> UID trùng khách khác
        {link && (
          <Button variant="link" className="h-auto p-0 text-[10px] text-rose-700 underline flex items-center" onClick={(e) => { e.stopPropagation(); window.open(link, "_blank"); }}>
            (Mở khách cũ)
          </Button>
        )}
      </Badge>
    );
  }

  // C. Failed
  if (autoResolveStatus === "failed" || autoResolveStatus === "timeout" || autoResolveStatus === "not_found") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-[10px] px-2 py-0.5 cursor-help">
              <AlertCircle className="w-2.5 h-2.5 mr-1" /> Chưa tìm được UID
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{lastAutoResolveError || "Lỗi không xác định"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // E. No resolver result yet (but not resolving/failed)
  if (autoResolveStatus === "not_attempted" || jobStatus === "manual_review_required") {
     return (
      <Badge className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 text-[10px] px-2 py-0.5">
        <AlertCircle className="w-2.5 h-2.5 mr-1" /> Đã nhận diện username, đang chờ phân giải UID
      </Badge>
     );
  }

  return null;
}
