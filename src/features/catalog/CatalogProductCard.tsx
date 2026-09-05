import { Eye, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CatalogProductImage } from "./CatalogProductImage";
import type { PublicProduct } from "./types";

interface Props {
  product: PublicProduct;
  onSelect: (product: PublicProduct) => void;
}

export function CatalogProductCard({ product, onSelect }: Props) {
  const fmt = (n?: number) =>
    n ? new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ" : "Liên hệ báo giá";

  const altText = `${product.brandName} - ${product.name}${product.retailSize ? ` (${product.retailSize})` : ""}`;

  return (
    <div
      onClick={() => onSelect(product)}
      className="group bg-white rounded-3xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-50/50 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer"
    >
      {/* Card Image Container */}
      <div className="relative aspect-[4/3] bg-slate-50 flex items-center justify-center p-4 overflow-hidden border-b border-slate-100">
        <CatalogProductImage
          src={product.imageUrl}
          alt={altText}
          className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out"
          fallbackIconSize={48}
          showWatermark
        />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1 pointer-events-none">
          <Badge className="bg-slate-900/90 backdrop-blur-md text-white font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 shadow-sm">
            {product.brandName}
          </Badge>
          {product.publicSizes && product.publicSizes.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 text-slate-700 text-[10px] font-extrabold shadow-3xs">
              {product.publicSizes[0]}
              {product.publicSizes.length > 1 && ` (+${product.publicSizes.length - 1})`}
            </span>
          )}
        </div>

        {/* Hover Quick Action Overlay */}
        <div className="absolute inset-0 bg-indigo-950/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="px-3.5 py-1.5 rounded-full bg-white text-indigo-700 font-bold text-xs shadow-lg flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <Eye className="w-3.5 h-3.5" /> Xem chi tiết
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="text-[9px] font-bold text-indigo-700 border-indigo-200/60 bg-indigo-50/70 py-0 px-1.5 uppercase"
            >
              {product.categoryName}
            </Badge>
            {product.publicSizes && product.publicSizes.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {product.publicSizes.map((sz, i) => (
                  <span
                    key={i}
                    className="text-[9px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200/60 px-1.5 py-0.2 rounded"
                  >
                    {sz}
                  </span>
                ))}
              </div>
            )}
          </div>

          <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
            {product.name}
          </h3>

          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
            {product.description ||
              "Dòng mỹ phẩm chăm sóc và trị liệu chuyên sâu chuẩn spa Hàn Quốc."}
          </p>
        </div>

        {/* Price & Action Row */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Giá niêm yết
            </span>
            {product.retailPrice ? (
              <span className="text-sm sm:text-base font-black text-indigo-700 tracking-tight">
                {fmt(product.retailPrice)}
              </span>
            ) : (
              <span className="text-xs sm:text-sm font-black text-amber-600 tracking-tight">
                Liên hệ báo giá
              </span>
            )}
          </div>

          <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-colors">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
