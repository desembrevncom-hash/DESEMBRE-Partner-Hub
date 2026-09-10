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
  priority?: boolean;
}

export function CatalogProductListRow({
  product,
  onSelect,
  onOpenContact,
  vatMode,
  priority = false,
}: Props) {
  const altText = `${product.brandName} - ${product.name}${product.retailSize ? ` (${product.retailSize})` : ""}`;

  const visibleItems = product.publicPriceItems.slice(0, MAX_VISIBLE_SIZES);
  const overflowCount = product.publicPriceItems.length - MAX_VISIBLE_SIZES;
  const hasPricedItem = product.publicPriceItems.some((it) => !it.requiresContact);

  return (
    <div
      onClick={() => onSelect(product)}
      className="min-h-[72px] bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3.5 shadow-3xs hover:shadow-sm transition-all cursor-pointer group"
    >
      {/* Thumbnail: 56px on mobile, 64px on sm+ */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1 overflow-hidden">
        <CatalogProductImage
          src={product.imageUrl}
          fallbackSrc={product.fallbackImageUrl}
          alt={product.imageAlt ?? product.name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          fallbackIconSize={24}
          priority={priority}
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
            {visibleItems.map((item, i) => {
              const itemPrice = item.price ?? item.retailPrice;
              const isContact = item.requiresContact || itemPrice == null || itemPrice <= 0;
              const channelLabel = item.channel === "salon" ? "Salon" : "Cá nhân";
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-1.5 text-[11px] leading-tight"
                >
                  <div className="flex items-center gap-1 shrink-0 text-slate-600">
                    <span className="font-bold text-slate-800">{item.sizeLabel}</span>
                    <span className="text-[10px] text-slate-400">· {channelLabel}</span>
                    <span className="text-slate-300 font-normal">—</span>
                  </div>
                  {isContact ? (
                    <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap text-right">
                      Liên hệ báo giá
                    </span>
                  ) : (
                    <span className="text-xs font-black text-indigo-700 tracking-tight whitespace-nowrap text-right">
                      {formatCatalogPrice(itemPrice!, vatMode)}
                    </span>
                  )}
                </div>
              );
            })}
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
            className="min-w-[44px] min-h-[44px] p-0 rounded-xl text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors cursor-pointer"
            aria-label="Xem chi tiết"
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
            className="min-h-[44px] px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Liên hệ</span>
          </Button>
        )}
      </div>
    </div>
  );
}
