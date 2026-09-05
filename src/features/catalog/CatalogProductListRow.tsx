import { ChevronRight, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCatalogPrice } from "@/lib/pricing";
import type { CatalogVatMode } from "@/lib/pricing";
import { CatalogProductImage } from "./CatalogProductImage";
import type { PublicProduct } from "./types";

const MAX_VISIBLE_SIZES = 2;

interface Props {
  product: PublicProduct;
  onSelect: (product: PublicProduct) => void;
  onOpenContact?: () => void;
  vatMode: CatalogVatMode;
}

export function CatalogProductListRow({ product, onSelect, onOpenContact, vatMode }: Props) {
  const altText = `${product.brandName} - ${product.name}${product.retailSize ? ` (${product.retailSize})` : ""}`;

  const visibleItems = product.publicPriceItems.slice(0, MAX_VISIBLE_SIZES);
  const overflowCount = product.publicPriceItems.length - MAX_VISIBLE_SIZES;
  const hasPricedItem = product.publicPriceItems.some((it) => !it.requiresContact);

  return (
    <div
      onClick={() => onSelect(product)}
      className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 p-3 flex items-center gap-3 shadow-3xs hover:shadow-sm transition-all cursor-pointer group"
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1 overflow-hidden">
        <CatalogProductImage
          src={product.imageUrl}
          alt={altText}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
          fallbackIconSize={24}
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className="text-[9px] font-extrabold text-indigo-700 border-indigo-200/60 bg-indigo-50/70 py-0 px-1.5 uppercase"
          >
            {product.categoryName}
          </Badge>
          {product.brandName && (
            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider bg-slate-100 border border-slate-200/60 px-1.5 py-0.2 rounded">
              {product.brandName}
            </span>
          )}
        </div>

        <h3 className="text-xs sm:text-sm font-black text-slate-900 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
          {product.name}
        </h3>

        {visibleItems.length > 0 ? (
          <div className="space-y-0.5 pt-0.5">
            {visibleItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2 max-w-[220px]">
                <span className="text-[9px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200/70 px-1.5 py-0.2 rounded whitespace-nowrap shrink-0">
                  {item.sizeLabel}
                </span>
                {item.requiresContact ? (
                  <span className="text-[9px] font-bold text-amber-600 whitespace-nowrap text-right">
                    Liên hệ báo giá
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-indigo-700 tracking-tight whitespace-nowrap text-right">
                    {formatCatalogPrice(item.retailPrice!, vatMode)}
                  </span>
                )}
              </div>
            ))}
            {overflowCount > 0 && (
              <p className="text-[9px] font-bold text-slate-400">+{overflowCount} quy cách khác</p>
            )}
          </div>
        ) : (
          /* Fallback single price */
          <div className="pt-0.5">
            {hasPricedItem || product.retailPrice ? (
              <span className="text-xs sm:text-sm font-black text-indigo-700 tracking-tight">
                {product.retailPrice
                  ? formatCatalogPrice(product.retailPrice, vatMode)
                  : "Liên hệ báo giá"}
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-600">Liên hệ báo giá</span>
            )}
          </div>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0 flex items-center">
        {hasPricedItem ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0 rounded-xl text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenContact) {
                onOpenContact();
              } else {
                onSelect(product);
              }
            }}
            className="h-8 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px]"
          >
            <PhoneCall className="w-3 h-3 mr-1" />
            Liên hệ
          </Button>
        )}
      </div>
    </div>
  );
}
