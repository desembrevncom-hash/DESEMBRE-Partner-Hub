import { Eye, PhoneCall, PackageSearch, RotateCcw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCatalogPrice } from "@/lib/pricing";
import type { CatalogVatMode } from "@/lib/pricing";
import { CatalogProductListRow } from "./CatalogProductListRow";
import { CatalogProductImage } from "./CatalogProductImage";
import type { PublicProduct } from "./types";

interface Props {
  products: PublicProduct[];
  loading: boolean;
  onSelectProduct: (prod: PublicProduct) => void;
  onOpenContact?: () => void;
  onClearFilters: () => void;
  vatMode: CatalogVatMode;
}

export function CatalogProductTable({
  products,
  loading,
  onSelectProduct,
  onOpenContact,
  onClearFilters,
  vatMode,
}: Props) {
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
          className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-2" />
          Xóa toàn bộ bộ lọc
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Mobile view: Compact list rows */}
      <div className="block md:hidden space-y-2.5">
        {products.map((p) => (
          <CatalogProductListRow
            key={p.id}
            product={p}
            onSelect={onSelectProduct}
            onOpenContact={onOpenContact}
            vatMode={vatMode}
          />
        ))}
      </div>

      {/* Desktop view: 4-column comparison table */}
      <div className="hidden md:block bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th scope="col" className="py-3 px-3 text-center w-16 shrink-0">
                  Ảnh
                </th>
                <th scope="col" className="py-3 px-3 min-w-[240px]">
                  Sản phẩm
                </th>
                <th scope="col" className="py-3 px-3 w-[320px] min-w-[300px] max-w-[360px]">
                  {vatMode === "with_vat" ? "Quy cách & Giá đã gồm VAT" : "Quy cách & Giá chưa VAT"}
                </th>
                <th scope="col" className="py-3 px-3 text-center w-28 shrink-0">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {products.map((p, idx) => {
                const altText = `${p.brandName} - ${p.name}${p.retailSize ? ` (${p.retailSize})` : ""}`;
                // Action logic: has at least one priced item → show "Chi tiết"; all contact-only → show "Liên hệ"
                const hasPricedItem = p.publicPriceItems.some((it) => !it.requiresContact);

                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelectProduct(p)}
                    className={`group cursor-pointer transition-colors ${
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                    } hover:bg-indigo-50/50`}
                  >
                    {/* Ảnh */}
                    <td className="py-2.5 px-3 text-center w-16">
                      <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-0.5 mx-auto overflow-hidden">
                        <CatalogProductImage
                          src={p.imageUrl}
                          alt={altText}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          fallbackIconSize={20}
                        />
                      </div>
                    </td>

                    {/* Sản phẩm */}
                    <td className="py-2.5 px-3">
                      <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                        {p.name}
                      </h4>
                      {p.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed mt-0.5 font-normal">
                          {p.description}
                        </p>
                      )}
                      {/* Category + brand badges */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[9px] font-bold text-indigo-700 bg-indigo-50/80 border-indigo-200/60 py-0 px-1.5 uppercase leading-tight"
                        >
                          {p.categoryName}
                        </Badge>
                        {p.brandName && (
                          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider bg-slate-100 border border-slate-200/60 px-1.5 py-0.2 rounded">
                            {p.brandName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Quy cách & Giá */}
                    <td className="py-2.5 px-3 w-[320px] min-w-[300px] max-w-[360px]">
                      {p.publicPriceItems.length > 0 ? (
                        <div className="space-y-1.5 w-full max-w-[320px]">
                          {p.publicPriceItems.map((item, i) => (
                            <div key={i} className="flex items-center justify-between gap-3">
                              <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200/70 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0">
                                {item.sizeLabel}
                              </span>
                              {item.requiresContact ? (
                                <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap text-right">
                                  Liên hệ báo giá
                                </span>
                              ) : (
                                <span className="text-[11px] font-black text-indigo-700 tracking-tight whitespace-nowrap text-right">
                                  {formatCatalogPrice(item.retailPrice!, vatMode)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {hasPricedItem ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProduct(p);
                          }}
                          className="h-7 px-2.5 rounded-lg border-slate-200 group-hover:border-indigo-300 group-hover:text-indigo-700 group-hover:bg-white text-[11px] font-bold shadow-3xs cursor-pointer"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Chi tiết
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenContact) {
                              onOpenContact();
                            } else {
                              onSelectProduct(p);
                            }
                          }}
                          className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-3xs cursor-pointer"
                        >
                          <PhoneCall className="w-3 h-3 mr-1" />
                          Liên hệ
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
