import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Sparkles, PhoneCall, LogIn, CheckCircle2, AlertCircle, BookOpen } from "lucide-react";
import { formatCatalogPrice } from "@/lib/pricing";
import type { CatalogVatMode } from "@/lib/pricing";
import { CatalogProductImage } from "./CatalogProductImage";
import type { PublicProduct } from "./types";

interface Props {
  product: PublicProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenContact: () => void;
  vatMode: CatalogVatMode;
}

export function ProductDetailModal({ product, isOpen, onClose, onOpenContact, vatMode }: Props) {
  if (!product) return null;

  const altText = `${product.brandName} - ${product.name}${product.retailSize ? ` (${product.retailSize})` : ""}`;
  const hasPricedItem = product.publicPriceItems.some((it) => !it.requiresContact);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Product Image Panel */}
          <div className="bg-slate-50 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-100 relative min-h-[280px]">
            <CatalogProductImage
              src={product.imageUrl}
              alt={altText}
              className="max-h-72 w-auto object-contain rounded-2xl shadow-sm hover:scale-105 transition-transform duration-300"
              fallbackIconSize={64}
              showWatermark
            />
            <div className="absolute top-4 left-4 flex flex-col gap-1.5">
              <Badge className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider">
                {product.brandName}
              </Badge>
              <Badge
                variant="outline"
                className="bg-white/90 backdrop-blur-sm text-slate-700 border-slate-200 font-bold text-[9px] uppercase"
              >
                {product.categoryName}
              </Badge>
            </div>
          </div>

          {/* Product Information Panel */}
          <div className="p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <DialogHeader className="text-left space-y-1">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                  Mỹ phẩm sinh học chuyên sâu
                </span>
                <DialogTitle className="text-lg font-black text-slate-900 leading-snug">
                  {product.name}
                </DialogTitle>
              </DialogHeader>

              {/* Per-size price table */}
              {product.publicPriceItems.length > 0 ? (
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Quy cách &amp; Giá niêm yết:
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white/80 border border-indigo-100/80 px-2 py-0.5 rounded-md">
                      {vatMode === "with_vat"
                        ? "Giá đang hiển thị: Đã gồm VAT 8%"
                        : "Giá đang hiển thị: Chưa VAT"}
                    </span>
                  </div>

                  <div className="space-y-2 divide-y divide-indigo-100/60 pt-0.5">
                    {product.publicPriceItems.map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between gap-3 ${i > 0 ? "pt-2" : ""}`}
                      >
                        <span className="text-[11px] font-extrabold text-slate-700 bg-white border border-indigo-100 px-2.5 py-1 rounded-lg whitespace-nowrap shadow-3xs shrink-0">
                          {item.sizeLabel}
                        </span>
                        {item.requiresContact ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-amber-600 whitespace-nowrap text-right">
                              Liên hệ báo giá
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                onOpenContact();
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md transition-colors shadow-3xs cursor-pointer"
                              title="Liên hệ tư vấn và báo giá quy cách này"
                            >
                              <PhoneCall className="w-2.5 h-2.5" />
                              <span>Liên hệ</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-base sm:text-xl font-black text-indigo-700 tracking-tight whitespace-nowrap text-right">
                            {formatCatalogPrice(item.retailPrice!, vatMode)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {!hasPricedItem && (
                    <p className="text-[10px] text-slate-400 font-medium pt-1">
                      Liên hệ để được tư vấn và nhận báo giá phù hợp
                    </p>
                  )}
                </div>
              ) : (
                /* Fallback for products with no publicPriceItems */
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100/80 space-y-2">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Giá niêm yết bán lẻ:
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white/80 border border-indigo-100/80 px-2 py-0.5 rounded-md">
                      {vatMode === "with_vat"
                        ? "Giá đang hiển thị: Đã gồm VAT 8%"
                        : "Giá đang hiển thị: Chưa VAT"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-indigo-700 tracking-tight">
                      {product.retailPrice ? (
                        formatCatalogPrice(product.retailPrice, vatMode)
                      ) : (
                        <span className="text-amber-600 text-sm font-bold">Liên hệ báo giá</span>
                      )}
                    </span>
                    {product.retailSize && (
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <span className="font-bold text-slate-400">Dung tích:</span>
                        <span className="font-extrabold text-slate-800 px-2 py-0.5 rounded bg-white border border-indigo-100 text-[10px]">
                          {product.retailSize}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {product.description && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Mô tả sản phẩm
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Benefits if present */}
              {product.benefits && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Hiệu quả nổi bật
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {product.benefits}
                  </p>
                </div>
              )}

              {/* Usage Instructions if present */}
              {product.usageInstructions && (
                <div className="space-y-1.5 p-3 rounded-2xl bg-amber-50/70 border border-amber-100 text-amber-950">
                  <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-amber-800">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    Hướng dẫn sử dụng
                  </h4>
                  <p className="text-xs leading-relaxed font-medium text-amber-900">
                    {product.usageInstructions}
                  </p>
                </div>
              )}

              {/* Warnings if present */}
              {product.warnings && (
                <div className="space-y-1.5 p-3 rounded-2xl bg-rose-50/70 border border-rose-100">
                  <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    Lưu ý
                  </h4>
                  <p className="text-xs leading-relaxed font-medium text-rose-800">
                    {product.warnings}
                  </p>
                </div>
              )}

              {/* Skin concerns tags */}
              {product.skinConcerns && product.skinConcerns.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Phù hợp loại da &amp; vấn đề
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {product.skinConcerns.map((sc, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold"
                      >
                        {sc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sparkles note */}
              {hasPricedItem && (
                <div className="flex items-start gap-1.5 text-[10px] text-slate-400 font-medium">
                  <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-indigo-400" />
                  <span>Đăng nhập Partner để xem giá Spa và lên đơn hàng</span>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <Button
                onClick={() => {
                  onClose();
                  onOpenContact();
                }}
                className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 transition-all cursor-pointer"
              >
                <PhoneCall className="w-4 h-4 mr-2" />
                Liên hệ tư vấn liệu trình &amp; đặt hàng
              </Button>

              <Button
                variant="outline"
                asChild
                className="w-full h-10 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
              >
                <Link to="/login">
                  <LogIn className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  Đăng nhập Partner để xem giá Spa &amp; lên đơn
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
