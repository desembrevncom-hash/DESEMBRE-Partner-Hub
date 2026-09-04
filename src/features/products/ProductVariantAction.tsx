/**
 * ProductVariantAction — Task 7
 * Renders one price+order-button block for a single channel (retail or salon).
 * Used in both ProductRow (desktop) and ProductMobileCard (mobile).
 */
import type { ProductVariant } from "@/types/product";

interface Props {
  variant: ProductVariant | undefined;
  channel: "retail" | "salon";
  orderable: boolean;
  mismatchReason?: string;
  vatOn: boolean;
  fmt: (n: number) => string;
  onPick: () => void;
  /** desktop = compact right-aligned column; mobile = full-width card block */
  layout: "desktop" | "mobile";
}

export function ProductVariantAction({
  variant,
  channel,
  orderable,
  mismatchReason,
  vatOn,
  fmt,
  onPick,
  layout,
}: Props) {
  const isRetail = channel === "retail";
  const labelVat = vatOn
    ? layout === "desktop"
      ? "(VAT)"
      : "ĐÃ CÓ VAT"
    : layout === "desktop"
      ? ""
      : "CHƯA VAT";
  const channelLabel = isRetail ? "NIÊM YẾT LẺ" : "CHUYÊN NGHIỆP";
  const sizeTag = variant ? `${variant.size} (${isRetail ? "R" : "S"})` : "";

  if (layout === "desktop") {
    if (!variant) {
      return <span className="text-slate-300">—</span>;
    }
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div>
          <p
            className={`text-[15px] font-black tracking-tight leading-none ${isRetail ? "text-blue-700" : "text-violet-700"}`}
          >
            {fmt(variant.price)}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
            {channelLabel} {labelVat}
          </p>
        </div>
        {orderable ? (
          <button
            onClick={onPick}
            className={`w-full h-8 flex items-center justify-center rounded-lg bg-white border text-[10px] font-bold uppercase transition-all shadow-sm ${
              isRetail
                ? "border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                : "border-violet-200 text-violet-600 hover:bg-violet-600 hover:text-white hover:border-violet-600"
            }`}
          >
            CHỌN LÊN ĐƠN
          </button>
        ) : (
          <div className="w-full text-center text-[9px] font-bold text-rose-500 bg-rose-50 border border-rose-100 py-1.5 px-2 rounded-lg leading-snug">
            {mismatchReason || "Khóa lên đơn"}
          </div>
        )}
      </div>
    );
  }

  // mobile layout
  if (!variant) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100 opacity-60 min-h-[120px]">
        <span className="text-slate-300">—</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase">
          Không có {isRetail ? "Retail" : "Salon"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1.5 p-3 rounded-xl border relative ${
        isRetail ? "bg-blue-50/60 border-blue-100/50" : "bg-violet-50/60 border-violet-100/50"
      }`}
    >
      <div className="absolute top-3 right-3">
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
            isRetail ? "bg-blue-100/80 text-blue-700" : "bg-violet-100/80 text-violet-700"
          }`}
        >
          {sizeTag}
        </span>
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {isRetail ? "Retail" : "Salon"}
      </span>
      <div className="mt-0.5">
        <p
          className={`text-[15px] font-black tracking-tight leading-none ${
            isRetail ? "text-blue-700" : "text-violet-700"
          }`}
        >
          {fmt(variant.price)}
        </p>
        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{labelVat}</p>
      </div>
      {orderable ? (
        <button
          onClick={onPick}
          className={`w-full min-h-[44px] mt-2 flex items-center justify-center rounded-lg bg-white border text-[11px] font-bold uppercase transition-all shadow-sm active:scale-95 touch-manipulation ${
            isRetail
              ? "border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600"
              : "border-violet-200 text-violet-600 hover:bg-violet-600 hover:text-white hover:border-violet-600"
          }`}
        >
          CHỌN
        </button>
      ) : (
        <div className="w-full min-h-[44px] mt-2 flex items-center justify-center rounded-lg bg-rose-50 border border-rose-100 text-[9px] text-rose-500 font-bold uppercase px-2 py-1 text-center leading-snug">
          {mismatchReason || "Khóa lên đơn"}
        </div>
      )}
    </div>
  );
}
