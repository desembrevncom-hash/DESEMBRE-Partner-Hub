import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
  onApplyName?: (name: string, forceOverwrite?: boolean) => void;
  isApplyPending?: boolean;
  canApplyName?: boolean;
  currentCustomerName?: string | null;
  currentCustomerContactName?: string | null;
  onFetchMissingName?: () => void;
  isFetchPending?: boolean;
  onForceRetry?: () => void;
  isRetryPending?: boolean;
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
  currentCustomerName,
  currentCustomerContactName,
  onFetchMissingName,
  isFetchPending,
  onForceRetry,
  isRetryPending,
  duplicateProfile,
}: FacebookIdentityBadgeProps) {
  const { isAdmin, roles } = useAuth();
  const canTriggerResolver = isAdmin || roles.includes("sub_admin");

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

        {facebookDisplayName ? (
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
                  {displayNameConfidenceScore !== undefined &&
                    displayNameConfidenceScore !== null && (
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

                  // Helper function to check if name is replaceable
                  const isReplaceable = (val: string | null | undefined) => {
                    if (!val || !val.trim()) return true;
                    if (
                      val.toLowerCase().includes("http") ||
                      val.toLowerCase().includes("facebook.com") ||
                      val.toLowerCase().includes("fb.com")
                    )
                      return true;
                    if (/^\d+$/.test(val)) return true;
                    return false;
                  };

                  const nameReplaceable = isReplaceable(currentCustomerName);
                  const contactReplaceable = isReplaceable(currentCustomerContactName);

                  if (nameReplaceable || contactReplaceable) {
                    onApplyName(facebookDisplayName);
                  } else {
                    const confirmOverwrite = window.confirm(
                      `Tên hiện tại là "${currentCustomerName || currentCustomerContactName}". Bạn có chắc muốn đổi thành "${facebookDisplayName}" không?`,
                    );
                    if (confirmOverwrite) {
                      onApplyName(facebookDisplayName, true);
                    }
                  }
                }}
                disabled={isApplyPending}
              >
                {isApplyPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Áp dụng làm tên KH"
                )}
              </Button>
            )}
            {!canApplyName && onApplyName && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block cursor-not-allowed">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 bg-white text-slate-400 border-slate-200 pointer-events-none"
                        disabled
                      >
                        Áp dụng làm tên KH
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Bạn không có quyền sửa tên khách hàng này.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : canApplyName &&
          onFetchMissingName &&
          jobStatus !== "duplicate_candidate" &&
          autoResolveStatus !== "duplicate_detected" &&
          autoResolveStatus !== "failed" ? (
          canTriggerResolver ? (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2 bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600"
              onClick={(e) => {
                e.stopPropagation();
                onFetchMissingName();
              }}
              disabled={isFetchPending}
            >
              {isFetchPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Tìm Tên FB"}
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block cursor-not-allowed">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 bg-white text-slate-400 border-slate-200 pointer-events-none"
                      disabled
                    >
                      Tìm Tên FB
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Chỉ Admin/Sub-admin/Manager có quyền tìm UID Facebook.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        ) : (
          <Badge className="bg-slate-50 text-slate-500 border border-slate-200 text-[10px] px-2 py-0.5">
            Tên Facebook chưa có
          </Badge>
        )}
      </div>
    );
  }

  // B. Resolving
  if (autoResolveStatus === "resolving" || autoResolveStatus === "queued") {
    if (!canTriggerResolver) {
      return (
        <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 text-[10px] px-2 py-0.5">
          <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> Chờ Admin xử lý UID
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] px-2 py-0.5">
        <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> Đang tìm UID tự động...
      </Badge>
    );
  }

  // D. Duplicate
  if (jobStatus === "duplicate_candidate" || autoResolveStatus === "duplicate_detected") {
    const link = duplicateProfile?.customers?.id
      ? `/customers?id=${duplicateProfile.customers.id}`
      : null;
    return (
      <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[10px] px-2 py-0.5 flex items-center gap-1">
        <AlertCircle className="w-2.5 h-2.5" /> UID trùng khách khác
        {link && (
          <Button
            variant="link"
            className="h-auto p-0 text-[10px] text-rose-700 underline flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              window.open(link, "_blank");
            }}
          >
            (Mở khách cũ)
          </Button>
        )}
      </Badge>
    );
  }

  // C. Failed / Error States
  if (
    autoResolveStatus === "failed" ||
    autoResolveStatus === "timeout" ||
    autoResolveStatus === "not_found" ||
    autoResolveStatus === "disabled" ||
    autoResolveStatus === "rate_limited" ||
    autoResolveStatus === "skipped_invalid_type" ||
    jobStatus === "failed" ||
    jobStatus === "ignored"
  ) {
    return (
      <div className="flex items-center gap-1">
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
        {canApplyName && onForceRetry && canTriggerResolver && (
          <Button
            variant="outline"
            size="sm"
            onClick={onForceRetry}
            disabled={isRetryPending}
            title="Thử tìm lại UID"
            className="h-[22px] px-2 text-[10px] font-bold text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100 uppercase"
          >
            {isRetryPending ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            TÌM LẠI
          </Button>
        )}
        {canApplyName && onForceRetry && !canTriggerResolver && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block cursor-not-allowed">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="h-[22px] px-2 text-[10px] font-bold text-slate-400 border-slate-200 bg-slate-50 uppercase pointer-events-none"
                  >
                    TÌM LẠI
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chỉ Admin/Sub-admin/Manager có quyền tìm UID Facebook.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  // E. No resolver result yet (but not resolving/failed)
  if (autoResolveStatus === "not_attempted" || jobStatus === "manual_review_required") {
    if (!canTriggerResolver) {
      return (
        <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 text-[10px] px-2 py-0.5">
          <AlertCircle className="w-2.5 h-2.5 mr-1" /> Chờ Admin xử lý UID
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 text-[10px] px-2 py-0.5">
        <AlertCircle className="w-2.5 h-2.5 mr-1" /> Đã nhận diện username, đang chờ phân giải UID
      </Badge>
    );
  }

  return null;
}
