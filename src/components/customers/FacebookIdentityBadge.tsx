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
  duplicateProfile,
}: FacebookIdentityBadgeProps) {
  // A. UID exists
  if (facebookUid) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] px-2 py-0.5 cursor-help">
              <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> UID: {facebookUid}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="flex flex-col gap-1">
            <span>Nguồn: {resolverMethod || "Không rõ"}</span>
            {confidenceScore !== undefined && confidenceScore !== null && (
              <span>Độ tin cậy: {confidenceScore}%</span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
