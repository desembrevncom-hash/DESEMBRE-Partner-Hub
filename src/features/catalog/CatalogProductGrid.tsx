import { Loader2, PackageSearch, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogProductCard } from "./CatalogProductCard";
import type { PublicProduct } from "./types";

interface Props {
  products: PublicProduct[];
  loading: boolean;
  onSelectProduct: (prod: PublicProduct) => void;
  onClearFilters: () => void;
}

export function CatalogProductGrid({ products, loading, onSelectProduct, onClearFilters }: Props) {
  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">
            Đang tải danh mục sản phẩm...
          </p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-20 px-6 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
          <PackageSearch className="w-8 h-8" />
        </div>
        <h3 className="text-base font-black text-slate-900 mb-1">
          Không tìm thấy sản phẩm phù hợp
        </h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc để hiển thị toàn bộ danh mục.
        </p>
        <Button
          onClick={onClearFilters}
          className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-2" />
          Xóa toàn bộ bộ lọc
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((p) => (
        <CatalogProductCard key={p.id} product={p} onSelect={onSelectProduct} />
      ))}
    </div>
  );
}
