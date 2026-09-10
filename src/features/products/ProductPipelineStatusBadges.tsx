import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { GuidebookStatus, KnowledgeStatus, SalesSheetStatus } from "./types";

interface Props {
  guidebookStatus?: GuidebookStatus;
  knowledgeStatus?: KnowledgeStatus;
  salesSheetStatus?: SalesSheetStatus;
  isPublic?: boolean | null;
  hasImage?: boolean;
  isLaunchReady?: boolean;
  blockingReasons?: string[];
  warnings?: string[];
  className?: string;
}

export function ProductPipelineStatusBadges({
  guidebookStatus = "none",
  knowledgeStatus = "none",
  salesSheetStatus = "none",
  isPublic,
  hasImage,
  isLaunchReady = false,
  blockingReasons = [],
  warnings = [],
  className = "",
}: Props) {
  const launchBadgeNode = (
    <Badge
      variant={isLaunchReady ? "default" : "outline"}
      className={
        isLaunchReady
          ? "bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] px-1.5 py-0 shadow-2xs cursor-help"
          : "bg-rose-50 text-rose-700 border-rose-200 text-[9px] font-bold px-1.5 py-0 cursor-help"
      }
    >
      Launch: {isLaunchReady ? "Sẵn sàng" : "Chưa sẵn sàng"}
    </Badge>
  );

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* 1. GUIDEBOOK STATUS */}
      {guidebookStatus === "extracted" ? (
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[9px] font-bold px-1.5 py-0">
          Guidebook: Đã trích xuất
        </Badge>
      ) : guidebookStatus === "saved" ? (
        <Badge className="bg-blue-50 text-blue-700 border border-blue-200/80 text-[9px] font-bold px-1.5 py-0">
          Guidebook: Đã lưu
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="bg-slate-50/60 text-slate-400 border-slate-200 text-[9px] font-medium px-1.5 py-0"
        >
          Guidebook: Chưa có
        </Badge>
      )}

      {/* 2. PRODUCT KNOWLEDGE STATUS */}
      {knowledgeStatus === "approved" ? (
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[9px] font-bold px-1.5 py-0">
          Tri thức AI: Đã duyệt
        </Badge>
      ) : knowledgeStatus === "review" ? (
        <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[9px] font-bold px-1.5 py-0">
          Tri thức AI: Chờ duyệt
        </Badge>
      ) : knowledgeStatus === "draft" ? (
        <Badge className="bg-amber-50 text-amber-700 border border-amber-200/80 text-[9px] font-bold px-1.5 py-0">
          Tri thức AI: Nháp
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="bg-slate-50/60 text-slate-400 border-slate-200 text-[9px] font-medium px-1.5 py-0"
        >
          Tri thức AI: Chưa có
        </Badge>
      )}

      {/* 3. WEBSITE PUBLIC STATUS */}
      {isPublic === true ? (
        <Badge className="bg-purple-50 text-purple-700 border border-purple-200/80 text-[9px] font-bold px-1.5 py-0">
          Website: Công khai
        </Badge>
      ) : isPublic === false ? (
        <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold px-1.5 py-0">
          Website: Nội bộ
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="bg-slate-50/60 text-slate-400 border-slate-200 text-[9px] font-medium px-1.5 py-0"
        >
          Website: Thiếu dữ liệu
        </Badge>
      )}

      {/* 4. SALES SHEET STATUS */}
      {salesSheetStatus === "approved" ? (
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[9px] font-bold px-1.5 py-0">
          Sales Sheet: Đã duyệt
        </Badge>
      ) : salesSheetStatus === "draft" ? (
        <Badge className="bg-amber-50 text-amber-700 border border-amber-200/80 text-[9px] font-bold px-1.5 py-0">
          Sales Sheet: Nháp
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="bg-slate-50/60 text-slate-400 border-slate-200 text-[9px] font-medium px-1.5 py-0"
        >
          Sales Sheet: Chưa có
        </Badge>
      )}

      {/* 4b. IMAGE STATUS BADGE */}
      {hasImage === false && (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-300 text-[9px] font-bold px-1.5 py-0"
        >
          Thiếu ảnh
        </Badge>
      )}

      {/* 5. LAUNCH READINESS STATUS WITH TOOLTIP */}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex shrink-0">{launchBadgeNode}</div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs p-3 space-y-2 rounded-xl shadow-xl border-slate-100 bg-white text-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              {isLaunchReady ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              <span className="font-black text-xs uppercase tracking-wider text-slate-900">
                Trạng thái Launch: {isLaunchReady ? "Sẵn sàng" : "Chưa sẵn sàng"}
              </span>
            </div>

            {blockingReasons.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-wide">
                  Lỗi chặn launch ({blockingReasons.length}):
                </span>
                <ul className="space-y-1">
                  {blockingReasons.map((reason, i) => (
                    <li
                      key={i}
                      className="text-[11px] font-medium text-rose-700 flex items-start gap-1.5 leading-snug"
                    >
                      <span className="text-rose-500 mt-0.5">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-wide">
                  Cảnh báo cần kiểm tra ({warnings.length}):
                </span>
                <ul className="space-y-1">
                  {warnings.map((warning, i) => (
                    <li
                      key={i}
                      className="text-[11px] font-medium text-amber-700 flex items-start gap-1.5 leading-snug"
                    >
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isLaunchReady && warnings.length === 0 && (
              <p className="text-[11px] font-medium text-slate-500">
                Sản phẩm đã đầy đủ dữ liệu chuẩn hóa và đáp ứng 100% điều kiện xuất bản công khai.
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
