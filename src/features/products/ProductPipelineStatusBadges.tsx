import React from "react";
import { Badge } from "@/components/ui/badge";
import type { GuidebookStatus, KnowledgeStatus, SalesSheetStatus } from "./types";

interface Props {
  guidebookStatus?: GuidebookStatus;
  knowledgeStatus?: KnowledgeStatus;
  salesSheetStatus?: SalesSheetStatus;
  className?: string;
}

export function ProductPipelineStatusBadges({
  guidebookStatus = "none",
  knowledgeStatus = "none",
  salesSheetStatus = "none",
  className = "",
}: Props) {
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

      {/* 3. SALES SHEET STATUS */}
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
    </div>
  );
}
