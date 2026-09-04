/**
 * ProductMobileCard — Task 8 (mobile)
 * Renders a single mobile card for a product.
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

function MobileSalesSheetCell({
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
  if (product.isDbProduct && product.dbId) {
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
  return null;
}

export function ProductMobileCard({
  product: p,
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
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
      {/* Product Header */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 shrink-0">
          <ProductImageCell
            productNo={p.id}
            src={p.imageUrl}
            onChange={(src) => onUpdate("image_url", src)}
            isReadOnly={!isManager}
            isDbMode={isUsingDbCatalogData}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[15px] font-black text-slate-900 leading-tight">{p.name}</h3>
            {isUsingDbCatalogData && p.brand_name && (
              <Badge className="bg-indigo-50 text-indigo-600 border-none text-[8px] font-black shrink-0 px-1.5 py-0.5 uppercase">
                {p.brand_name}
              </Badge>
            )}
            {p.isCustom && (
              <Badge className="bg-amber-50 text-amber-600 border-none text-[8px] font-black shrink-0 px-1.5 py-0.5">
                CUSTOM
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
            {p.description || "Chưa có mô tả kỹ thuật cho sản phẩm này."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
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
      </div>

      {/* Action Blocks */}
      <div className="grid grid-cols-2 gap-3 mt-1 border-t border-slate-100 pt-4">
        <ProductVariantAction
          variant={retail}
          channel="retail"
          orderable={guard.retailOrderable}
          mismatchReason={guard.retailMismatchReason}
          vatOn={vatOn}
          fmt={fmt}
          onPick={() => onPick("retail")}
          layout="mobile"
        />
        <ProductVariantAction
          variant={salon}
          channel="salon"
          orderable={guard.salonOrderable}
          mismatchReason={guard.salonMismatchReason}
          vatOn={vatOn}
          fmt={fmt}
          onPick={() => onPick("salon")}
          layout="mobile"
        />
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
        <div className="flex items-center">
          {p.isDbProduct && p.dbId ? (
            <MobileSalesSheetCell
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
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenKnowledge}
              className="min-h-[44px] px-3 text-[10px] font-black text-blue-600 hover:bg-blue-50 uppercase tracking-wider rounded-xl transition-all whitespace-nowrap active:scale-95 touch-manipulation"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Tri thức
            </Button>
          )}
          {isManager && (
            <button className="w-10 h-10 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-all flex items-center justify-center">
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
