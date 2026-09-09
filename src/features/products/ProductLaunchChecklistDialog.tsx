import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, CheckCircle2, AlertTriangle } from "lucide-react";
import { getProductLaunchStatus } from "@/lib/publicProductProfile";
import type { ProductKnowledgeSummary, GuidebookStatus, SalesSheetStatus } from "./types";

interface ProductItemChecklist {
  id: string | number;
  name: string;
  guidebookStatus?: GuidebookStatus;
  knowledgeSummary?: ProductKnowledgeSummary;
  salesSheetStatus?: SalesSheetStatus;
}

interface Props {
  products: ProductItemChecklist[];
  guidebooksMap: Record<string, GuidebookStatus>;
  knowledgeMap: Record<string, ProductKnowledgeSummary>;
  salesSheetsMap: Record<string, { status: "draft" | "approved" }>;
}

export function ProductLaunchChecklistDialog({
  products,
  guidebooksMap,
  knowledgeMap,
  salesSheetsMap,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const checklistData = products.map((p) => {
    const key = String(p.id);
    const gStatus = guidebooksMap[key] || p.guidebookStatus || "none";
    const kSummary = knowledgeMap[key] || p.knowledgeSummary;
    const sSheet =
      salesSheetsMap[key] || (p.salesSheetStatus ? { status: p.salesSheetStatus } : undefined);

    const launchStatus = getProductLaunchStatus(kSummary as unknown as Record<string, unknown>, {
      hasSourceDocs: gStatus !== "none",
      hasCompletedGuidebook: gStatus === "extracted",
      salesSheetStatus: sSheet?.status,
    });

    return {
      product: p,
      guidebookStatus: gStatus,
      knowledgeSummary: kSummary,
      salesSheetStatus: sSheet?.status || "none",
      launchStatus,
    };
  });

  const totalProducts = checklistData.length;
  const countWithGuidebook = checklistData.filter((c) => c.guidebookStatus !== "none").length;
  const countApprovedKnowledge = checklistData.filter(
    (c) => c.knowledgeSummary?.qa_status === "approved",
  ).length;
  const countPublicReady = checklistData.filter((c) => c.launchStatus.isLaunchReady).length;
  const countApprovedSalesSheet = checklistData.filter(
    (c) => c.salesSheetStatus === "approved",
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Rocket className="w-4 h-4 text-emerald-600" />
          <span>
            Launch Checklist ({countPublicReady}/{totalProducts})
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl border-slate-200 p-6">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 text-white font-black text-[10px] uppercase">
              Launch Readiness Overview
            </Badge>
          </div>
          <DialogTitle className="text-xl font-black text-slate-900">
            Danh sách Kiểm duyệt Xuất bản Sản phẩm (Product Launch Checklist)
          </DialogTitle>
        </DialogHeader>

        {/* Overview Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Tổng sản phẩm</span>
            <div className="text-xl font-black text-slate-900">{totalProducts}</div>
          </div>
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-blue-700 uppercase">Có Guidebook</span>
            <div className="text-xl font-black text-blue-900">{countWithGuidebook}</div>
          </div>
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-indigo-700 uppercase">Duyệt Tri thức</span>
            <div className="text-xl font-black text-indigo-900">{countApprovedKnowledge}</div>
          </div>
          <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-amber-700 uppercase">
              Duyệt Sales Sheet
            </span>
            <div className="text-xl font-black text-amber-900">{countApprovedSalesSheet}</div>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-emerald-800 uppercase">
              Sẵn sàng Launch
            </span>
            <div className="text-xl font-black text-emerald-700">{countPublicReady}</div>
          </div>
        </div>

        {/* Product Readiness Table */}
        <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          {checklistData.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 max-w-md">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">{item.product.name}</span>
                </div>
                {item.launchStatus.isLaunchReady && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Đạt 100% điều kiện xuất bản công khai</span>
                  </div>
                )}

                {/* 1. Lỗi chặn launch */}
                {item.launchStatus.blockingReasons.length > 0 && (
                  <div className="space-y-1 pt-0.5">
                    <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                      Lỗi chặn launch ({item.launchStatus.blockingReasons.length}):
                    </div>
                    <ul className="space-y-0.5 pl-0.5">
                      {item.launchStatus.blockingReasons.map((reason, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-[11px] font-medium text-rose-700 leading-snug"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2. Cảnh báo cần kiểm tra */}
                {item.launchStatus.warnings.length > 0 && (
                  <div className="space-y-1 pt-0.5">
                    <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                      Cảnh báo cần kiểm tra ({item.launchStatus.warnings.length}):
                    </div>
                    <ul className="space-y-0.5 pl-0.5">
                      {item.launchStatus.warnings.map((warning, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-[11px] font-medium text-amber-800 leading-snug"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.launchStatus.isLaunchReady ? (
                  <Badge className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 shadow-2xs">
                    Sẵn sàng Launch
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px] px-2 py-0.5"
                  >
                    Chưa sẵn sàng
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
