import React from "react";
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

interface DetailSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function DetailSection({ title, icon, children, className = "" }: DetailSectionProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

interface InfoCardProps {
  title: string;
  icon?: React.ReactNode;
  content: string;
  variant?: "amber" | "rose" | "indigo" | "default";
}

function InfoCard({ title, icon, content, variant = "default" }: InfoCardProps) {
  if (!content || !content.trim()) return null;

  const colorStyles = {
    amber: "bg-amber-50/80 border-amber-200/80 text-amber-950",
    rose: "bg-rose-50/80 border-rose-200/80 text-rose-950",
    indigo: "bg-indigo-50/80 border-indigo-200/80 text-indigo-950",
    default: "bg-slate-50 border-slate-200 text-slate-900",
  };

  const titleColors = {
    amber: "text-amber-800",
    rose: "text-rose-800",
    indigo: "text-indigo-800",
    default: "text-slate-800",
  };

  return (
    <div className={`p-4 rounded-2xl border space-y-1.5 shadow-2xs ${colorStyles[variant]}`}>
      <h4
        className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${titleColors[variant]}`}
      >
        {icon}
        {title}
      </h4>
      <p className="text-xs leading-relaxed font-medium whitespace-pre-line">{content.trim()}</p>
    </div>
  );
}

interface PriceRowsProps {
  product: PublicProduct;
  vatMode: CatalogVatMode;
  onOpenContact: () => void;
  onClose: () => void;
}

function PriceRows({ product, vatMode, onOpenContact, onClose }: PriceRowsProps) {
  const hasPriceItems = product.publicPriceItems && product.publicPriceItems.length > 0;
  const hasPricedItem = hasPriceItems && product.publicPriceItems.some((it) => !it.requiresContact);

  if (!hasPriceItems) {
    return (
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100/80 space-y-2">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
            Quy cách &amp; Giá:
          </span>
          <span className="text-[10px] font-semibold text-slate-500 bg-white/90 border border-indigo-100 px-2 py-0.5 rounded-md">
            {vatMode === "with_vat" ? "Đã gồm VAT 8%" : "Chưa VAT"}
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
            <span className="font-extrabold text-slate-800 px-2.5 py-1 rounded-lg bg-white border border-indigo-100 text-xs">
              {product.retailSize}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100/80 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
          Quy cách &amp; Bảng giá:
        </span>
        <span className="text-[10px] font-semibold text-slate-500 bg-white/90 border border-indigo-100 px-2 py-0.5 rounded-md">
          {vatMode === "with_vat" ? "Đã gồm VAT 8%" : "Chưa VAT"}
        </span>
      </div>

      <div className="space-y-2 divide-y divide-indigo-100/60 pt-0.5">
        {product.publicPriceItems.map((item, i) => {
          const itemPrice = item.price ?? item.retailPrice;
          const isContact = item.requiresContact || itemPrice == null || itemPrice <= 0;
          const channelLabel = item.channel === "salon" ? "Salon" : "Cá nhân";
          return (
            <div
              key={i}
              className={`flex items-center justify-between gap-3 ${i > 0 ? "pt-2" : ""}`}
            >
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-extrabold text-slate-700 bg-white border border-indigo-100 px-2.5 py-1 rounded-lg whitespace-nowrap shadow-2xs">
                  {item.sizeLabel}
                </span>
                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                  · {channelLabel}
                </span>
              </div>
              {isContact ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 whitespace-nowrap">
                    Liên hệ báo giá
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                      onOpenContact();
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200/80 px-2 py-1 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <PhoneCall className="w-2.5 h-2.5" />
                    <span>Liên hệ</span>
                  </button>
                </div>
              ) : (
                <span className="text-base sm:text-lg font-black text-indigo-700 tracking-tight whitespace-nowrap">
                  {formatCatalogPrice(itemPrice!, vatMode)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!hasPricedItem && (
        <p className="text-[10px] text-slate-400 font-medium pt-1">
          Liên hệ để được tư vấn và nhận báo giá phù hợp
        </p>
      )}
    </div>
  );
}

interface CTAFooterProps {
  onClose: () => void;
  onOpenContact: () => void;
  hasPricedItem?: boolean;
}

function CTAFooter({ onClose, onOpenContact, hasPricedItem }: CTAFooterProps) {
  return (
    <div className="space-y-2">
      {hasPricedItem && (
        <div className="flex items-start gap-1.5 text-[10px] text-slate-400 font-medium">
          <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-indigo-400" />
          <span>Đăng nhập Partner để xem giá Spa và lên đơn hàng</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={() => {
            onClose();
            onOpenContact();
          }}
          className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <PhoneCall className="w-4 h-4 shrink-0" />
          <span>Liên hệ tư vấn liệu trình &amp; đặt hàng</span>
        </Button>

        <Button
          variant="outline"
          asChild
          className="w-full h-11 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2"
        >
          <Link to="/login">
            <LogIn className="w-4 h-4 shrink-0 text-slate-400" />
            <span>Đăng nhập Partner để xem giá Spa &amp; lên đơn</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function ProductDetailModal({ product, isOpen, onClose, onOpenContact, vatMode }: Props) {
  if (!product) return null;

  const hasPricedItem =
    product.publicPriceItems && product.publicPriceItems.some((it) => !it.requiresContact);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-3xl border-slate-200 max-w-full">
        <div className="flex flex-col lg:grid lg:grid-cols-12 min-h-0">
          {/* LEFT COLUMN: Image & Price Card */}
          <div className="lg:col-span-5 bg-slate-50/80 p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200/80 space-y-6">
            <div className="space-y-6">
              {/* Product Image Frame */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex items-center justify-center relative min-h-[260px]">
                <CatalogProductImage
                  src={product.imageUrl}
                  fallbackSrc={product.fallbackImageUrl}
                  alt={product.imageAlt ?? product.name}
                  className="max-h-64 w-auto object-contain rounded-xl shadow-xs hover:scale-105 transition-transform duration-300"
                  fallbackIconSize={64}
                  showWatermark
                />
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
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

              {/* Price & Specifications Card */}
              <PriceRows
                product={product}
                vatMode={vatMode}
                onOpenContact={onOpenContact}
                onClose={onClose}
              />
            </div>

            {/* Desktop CTA Footer */}
            <div className="hidden lg:block pt-4 border-t border-slate-200/60">
              <CTAFooter
                onClose={onClose}
                onOpenContact={onOpenContact}
                hasPricedItem={hasPricedItem}
              />
            </div>
          </div>

          {/* RIGHT COLUMN: Knowledge & Product Information */}
          <div className="lg:col-span-7 p-6 space-y-6 overflow-y-auto">
            {/* Header */}
            <DialogHeader className="text-left space-y-1.5">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                Mỹ phẩm sinh học chuyên sâu
              </span>
              <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                {product.name}
              </DialogTitle>
            </DialogHeader>

            {/* Short Description */}
            {product.description && product.description.trim() !== "" && (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {product.description.trim()}
              </p>
            )}

            {/* Benefits */}
            {product.benefits && product.benefits.trim() !== "" && (
              <DetailSection
                title="Hiệu quả nổi bật"
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              >
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100/80 whitespace-pre-line">
                  {product.benefits.trim()}
                </p>
              </DetailSection>
            )}

            {/* Ingredient Highlights */}
            {product.ingredientHighlights && product.ingredientHighlights.length > 0 && (
              <DetailSection title="Thành phần nổi bật">
                <div className="flex flex-wrap gap-2">
                  {product.ingredientHighlights.map((ing, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl bg-indigo-50/80 border border-indigo-100 text-indigo-800 text-xs font-bold shadow-3xs"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </DetailSection>
            )}

            {/* Skin Types */}
            {product.skinTypes && product.skinTypes.length > 0 && (
              <DetailSection title="Loại da phù hợp">
                <div className="flex flex-wrap gap-2">
                  {product.skinTypes.map((st, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl bg-emerald-50/80 border border-emerald-100 text-emerald-800 text-xs font-bold shadow-3xs"
                    >
                      {st}
                    </span>
                  ))}
                </div>
              </DetailSection>
            )}

            {/* Skin Concerns */}
            {product.skinConcerns && product.skinConcerns.length > 0 && (
              <DetailSection title="Vấn đề da mục tiêu">
                <div className="flex flex-wrap gap-2">
                  {product.skinConcerns.map((sc, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200/60 text-slate-700 text-xs font-bold shadow-3xs"
                    >
                      {sc}
                    </span>
                  ))}
                </div>
              </DetailSection>
            )}

            {/* Usage Instructions */}
            {product.usageInstructions && product.usageInstructions.trim() !== "" && (
              <InfoCard
                title="Hướng dẫn sử dụng"
                icon={<BookOpen className="w-4 h-4 text-amber-600" />}
                content={product.usageInstructions}
                variant="amber"
              />
            )}

            {/* Warnings & Contraindications */}
            {product.warnings && product.warnings.trim() !== "" && (
              <InfoCard
                title="Lưu ý &amp; Chống chỉ định"
                icon={<AlertCircle className="w-4 h-4 text-rose-500" />}
                content={product.warnings}
                variant="rose"
              />
            )}
          </div>
        </div>

        {/* Mobile Sticky Bottom CTA Bar */}
        <div className="lg:hidden sticky bottom-0 bg-white/95 backdrop-blur-md p-4 border-t border-slate-200 shadow-lg z-10">
          <CTAFooter
            onClose={onClose}
            onOpenContact={onOpenContact}
            hasPricedItem={hasPricedItem}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
