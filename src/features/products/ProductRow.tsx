/**
 * ProductRow — Task 8 (desktop)
 * Renders a single desktop table row for a product.
 */
import { Sparkles, FileText, Printer, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductImageCell from "@/components/ProductImageCell";
import ProductLinkCell from "@/components/ProductLinkCell";
import { CATEGORIES } from "@/data/products";
import type { Product } from "@/types/product";
import type { ProductGuard, SalesSheetInfo } from "./types";
import { ProductVariantAction } from "./ProductVariantAction";

interface Props {
  product: Product;
  idx: number;
  isManager: boolean;
  isUsingDbCatalogData: boolean;
  vatOn: boolean;
  fmt: (n: number) => string;
  guard: ProductGuard;
  salesSheetInfo: SalesSheetInfo | undefined;
  onPick: (sizeType: "retail" | "salon") => void;
  onUpdate: (field: string, value: unknown) => void;
  onOpenKnowledge: () => void;
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
  onPick,
  onUpdate,
  onOpenKnowledge,
  onOpenSalesSheet,
}: Props) {
  const retail = p.variants.find((v) => v.type === "retail");
  const salon = p.variants.find((v) => v.type === "salon");

  /** Task 5: show product.categoryName first, fallback to static CATEGORIES */
  const categoryLabel =
    p.categoryName || CATEGORIES.find((c) => c.id === p.categoryId)?.name || "N/A";

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
            isManager={isManager}
            onOpenSalesSheet={onOpenSalesSheet}
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
          {isManager && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenKnowledge}
              className="h-9 px-3 text-[10px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 uppercase tracking-wider rounded-xl transition-all whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 animate-pulse" /> Tri thức
            </Button>
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
  isManager,
  onOpenSalesSheet,
}: {
  product: Product;
  salesSheetInfo: SalesSheetInfo | undefined;
  isManager: boolean;
  onOpenSalesSheet: () => void;
}) {
  if (isManager) {
    if (!salesSheetInfo) {
      return (
        <Button
          onClick={onOpenSalesSheet}
          variant="outline"
          className="h-8 px-2.5 rounded-lg border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-[10px] font-bold"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Tạo AI Sheet
        </Button>
      );
    }
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
        Sheet ({salesSheetInfo.status === "approved" ? "Duyệt" : "Nháp"})
      </Button>
    );
  }
  // Non-manager
  if (!salesSheetInfo || salesSheetInfo.status !== "approved") {
    return <span className="text-xs text-slate-400 font-medium">Chưa có tài liệu</span>;
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
