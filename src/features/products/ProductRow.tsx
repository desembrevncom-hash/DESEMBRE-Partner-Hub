/**
 * ProductRow — Task 8 (desktop)
 * Renders a single desktop table row for a product.
 */
import { Sparkles, FileText, Printer, MoreVertical, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductImageCell from "@/components/ProductImageCell";
import ProductLinkCell from "@/components/ProductLinkCell";
import { CATEGORIES } from "@/data/products";
import type { Product } from "@/types/product";
import type {
  ProductGuard,
  SalesSheetInfo,
  ProductKnowledgeSummary,
  GuidebookStatus,
} from "./types";
import { ProductVariantAction } from "./ProductVariantAction";
import { ProductPipelineStatusBadges } from "./ProductPipelineStatusBadges";

interface Props {
  product: Product;
  idx: number;
  isManager: boolean;
  isUsingDbCatalogData: boolean;
  vatOn: boolean;
  fmt: (n: number) => string;
  guard: ProductGuard;
  salesSheetInfo: SalesSheetInfo | undefined;
  guidebookStatus?: GuidebookStatus;
  knowledgeSummary?: ProductKnowledgeSummary;
  onPick: (sizeType: "retail" | "salon") => void;
  onUpdate: (field: string, value: unknown) => void;
  onOpenKnowledge: () => void;
  onOpenKnowledgeReadOnly?: () => void;
  onOpenSalesSheet: () => void;
}

function DropdownAction() {
  return (
    <button className="w-10 h-10 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-all flex items-center justify-center">
      <MoreVertical className="w-4 h-4" />
    </button>
  );
}

export function ProductRow({
  product: p,
  idx,
  isManager,
  isUsingDbCatalogData,
  vatOn,
  fmt,
  guard,
  salesSheetInfo,
  guidebookStatus,
  knowledgeSummary,
  onPick,
  onUpdate,
  onOpenKnowledge,
  onOpenKnowledgeReadOnly,
  onOpenSalesSheet,
}: Props) {
  const retail = p.variants.find((v) => v.type === "retail");
  const salon = p.variants.find((v) => v.type === "salon");

  /** Task 5: show product.categoryName first, fallback to static CATEGORIES */
  const categoryLabel =
    p.categoryName || CATEGORIES.find((c) => c.id === p.categoryId)?.name || "N/A";

  const salesSheetStatus =
    salesSheetInfo?.status === "approved"
      ? "approved"
      : salesSheetInfo?.status === "draft"
        ? "draft"
        : "none";

  const knowledgeStatus =
    knowledgeSummary?.qa_status === "approved"
      ? "approved"
      : knowledgeSummary?.qa_status === "review"
        ? "review"
        : knowledgeSummary?.qa_status === "draft"
          ? "draft"
          : "none";

  return (
    <tr
      className={`group transition-all duration-300 ${idx % 2 === 0 ? "bg-slate-50/60" : "bg-white"} hover:bg-blue-50/60`}
    >
      <td className="px-3 py-5 text-center">
        <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
          {String(idx + 1).padStart(2, "0")}
        </span>
      </td>
      <td className="px-3 py-5">
        <ProductImageCell
          productNo={p.id}
          src={p.imageUrl}
          onChange={(src) => onUpdate("image_url", src)}
          isReadOnly={!isManager}
          isDbMode={isUsingDbCatalogData}
        />
      </td>
      <td className="px-3 py-5 max-w-md">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-black text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
              {p.name}
            </h3>
            {isUsingDbCatalogData && p.brand_name && (
              <Badge className="bg-indigo-50 text-indigo-600 border-none text-[8px] font-black shrink-0 uppercase">
                {p.brand_name}
              </Badge>
            )}
            {p.isCustom && (
              <Badge className="bg-amber-50 text-amber-600 border-none text-[8px] font-black shrink-0">
                CUSTOM
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
            {p.description || "Chưa có mô tả kỹ thuật cho sản phẩm này."}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant="outline"
              className="text-[9px] font-bold text-slate-400 border-slate-200 py-0 uppercase bg-white"
            >
              {categoryLabel}
            </Badge>
            <span className="text-[10px] text-slate-400 font-mono font-medium">
              SKU: {retail?.sku || salon?.sku || `DES-${p.id}`}
            </span>
          </div>

          {/* Pipeline Status Indicators */}
          <ProductPipelineStatusBadges
            guidebookStatus={guidebookStatus}
            knowledgeStatus={knowledgeStatus}
            salesSheetStatus={salesSheetStatus}
            className="pt-1"
          />
        </div>
      </td>
      <td className="px-3 py-5 text-center">
        <div className="space-y-2">
          {retail && (
            <div className="px-2 py-1 rounded bg-blue-50/80 border border-blue-100 text-[10px] font-black text-blue-700 uppercase">
              {retail.size} (R)
            </div>
          )}
          {salon && (
            <div className="px-2 py-1 rounded bg-violet-50/80 border border-violet-100 text-[10px] font-black text-violet-700 uppercase">
              {salon.size} (S)
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-5 text-right">
        <ProductVariantAction
          variant={retail}
          channel="retail"
          orderable={guard.retailOrderable}
          mismatchReason={guard.retailMismatchReason}
          vatOn={vatOn}
          fmt={fmt}
          onPick={() => onPick("retail")}
          layout="desktop"
        />
      </td>
      <td className="px-6 py-5 text-right">
        <ProductVariantAction
          variant={salon}
          channel="salon"
          orderable={guard.salonOrderable}
          mismatchReason={guard.salonMismatchReason}
          vatOn={vatOn}
          fmt={fmt}
          onPick={() => onPick("salon")}
          layout="desktop"
        />
      </td>
      <td className="px-6 py-6 text-center">
        {p.isDbProduct && p.dbId ? (
          <SalesSheetCellInner
            product={p}
            salesSheetInfo={salesSheetInfo}
            knowledgeSummary={knowledgeSummary}
            guidebookStatus={guidebookStatus}
            isManager={isManager}
            onOpenSalesSheet={onOpenSalesSheet}
            onOpenKnowledge={onOpenKnowledge}
          />
        ) : (
          <ProductLinkCell
            productNo={p.id}
            href={p.pdfUrl}
            onChange={(url) => onUpdate("link_url", url)}
            isReadOnly={!isManager}
          />
        )}
      </td>
      <td className="px-6 py-6 text-center">
        <div className="flex items-center justify-end gap-2">
          {isManager ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenKnowledge}
              className="h-9 px-3 text-[10px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 uppercase tracking-wider rounded-xl transition-all whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 animate-pulse" /> Tri thức AI
            </Button>
          ) : knowledgeSummary?.qa_status === "approved" && knowledgeSummary?.is_active ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenKnowledgeReadOnly}
              className="h-8 px-2.5 text-[10px] font-bold rounded-lg border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1 text-indigo-600" /> Xem Tri thức
            </Button>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
              Chưa có tri thức
            </span>
          )}
          {isManager && <DropdownAction />}
        </div>
      </td>
    </tr>
  );
}

/** Inner helper */
function SalesSheetCellInner({
  product,
  salesSheetInfo,
  knowledgeSummary,
  guidebookStatus = "none",
  isManager,
  onOpenSalesSheet,
  onOpenKnowledge,
}: {
  product: Product;
  salesSheetInfo: SalesSheetInfo | undefined;
  knowledgeSummary?: ProductKnowledgeSummary;
  guidebookStatus?: GuidebookStatus;
  isManager: boolean;
  onOpenSalesSheet: () => void;
  onOpenKnowledge: () => void;
}) {
  if (isManager) {
    if (salesSheetInfo) {
      return (
        <Button
          onClick={onOpenSalesSheet}
          variant="outline"
          className={`h-8 px-2.5 rounded-lg text-[10px] font-bold ${
            salesSheetInfo.status === "approved"
              ? "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
              : "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
          }`}
        >
          <FileText className="w-3 h-3 mr-1" />
          Sheet ({salesSheetInfo.status === "approved" ? "Đã duyệt" : "Nháp"})
        </Button>
      );
    }

    // No sales sheet yet => Check pipeline stages
    const hasApprovedKnowledge =
      knowledgeSummary?.qa_status === "approved" && knowledgeSummary?.is_active;

    if (guidebookStatus === "none") {
      return (
        <Button
          onClick={() =>
            toast.info(
              "Sản phẩm chưa có Guidebook. Vui lòng mở chi tiết sản phẩm trong Quản lý Brand & Danh mục để tải file hoặc nhập Text Guidebook.",
            )
          }
          variant="outline"
          className="h-8 px-2.5 rounded-lg text-[10px] font-bold border-slate-200 text-slate-500 bg-slate-50 hover:bg-slate-100"
        >
          <FileText className="w-3 h-3 mr-1 text-slate-400" />
          Nhập Guidebook
        </Button>
      );
    }

    if (guidebookStatus === "saved") {
      return (
        <Button
          onClick={() =>
            toast.info(
              "Guidebook đã lưu nhưng chưa hoàn tất trích xuất. Vui lòng bấm 'Phân tích vào Tri thức' trong chi tiết sản phẩm.",
            )
          }
          variant="outline"
          className="h-8 px-2.5 rounded-lg text-[10px] font-bold border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          <FileText className="w-3 h-3 mr-1 text-blue-500" />
          Guidebook chưa trích xuất
        </Button>
      );
    }

    if (!hasApprovedKnowledge) {
      return (
        <Button
          onClick={onOpenKnowledge}
          variant="outline"
          className="h-8 px-2.5 rounded-lg text-[10px] font-bold border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
        >
          <Sparkles className="w-3 h-3 mr-1 text-indigo-600" />
          Duyệt Tri thức AI
        </Button>
      );
    }

    return (
      <Button
        onClick={onOpenSalesSheet}
        variant="outline"
        className="h-8 px-2.5 rounded-lg text-[10px] font-bold border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 shadow-3xs"
      >
        <Sparkles className="w-3 h-3 mr-1 text-emerald-600" />
        Tạo Sales Sheet từ Tri thức AI
      </Button>
    );
  }

  // Non-manager (Staff / Sales)
  if (!salesSheetInfo || salesSheetInfo.status !== "approved") {
    return <span className="text-xs text-slate-400 font-medium">Chưa có tài liệu bán hàng</span>;
  }
  return (
    <Button
      onClick={onOpenSalesSheet}
      variant="outline"
      className="h-8 px-3 rounded-lg border-green-200 text-green-700 bg-green-50 hover:bg-green-100 text-[10px] font-bold"
    >
      <Printer className="w-3.5 h-3.5 mr-1" />
      Sales Sheet
    </Button>
  );
}
