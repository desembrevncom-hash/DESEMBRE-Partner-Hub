/**
 * CartDrawer — Task 9
 * Slide-in sheet showing selected cart items.
 * - Remove individual item
 * - Clear all items
 * - "Tạo đơn nháp" CTA navigates to /orders/new with compatible pickupCart
 */
import { ShoppingCart, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import type { CartItemAny } from "./types";
import { getCartEntryLabel, getCartEntryPrice } from "./types";

interface Props {
  cart: CartItemAny[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRemove: (idx: number) => void;
  onClear: () => void;
  onCreateOrder: () => void;
}

export function CartDrawer({
  cart,
  isOpen,
  onOpen,
  onClose,
  onRemove,
  onClear,
  onCreateOrder,
}: Props) {
  const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";

  return (
    <>
      {/* Floating trigger button */}
      {cart.length > 0 && (
        <div className="fixed bottom-8 right-8 z-50 animate-fade-in">
          <Button
            onClick={onOpen}
            className="h-14 px-6 rounded-xl shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold hover:scale-105 transition-all group"
          >
            <ShoppingCart className="w-5 h-5 mr-2 group-hover:-rotate-12 transition-transform" />
            GIỎ HÀNG NHÁP ({cart.length})
          </Button>
        </div>
      )}

      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <SheetTitle className="flex items-center justify-between text-slate-900">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                <span className="text-base font-black">Giỏ hàng nháp</span>
                <span className="ml-1 text-xs font-bold bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={onClear}
                  className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors"
                  title="Xóa tất cả"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa tất cả
                </button>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShoppingCart className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-sm font-bold text-slate-400">Chưa có sản phẩm nào</p>
                <p className="text-xs text-slate-400 mt-1">
                  Bấm CHỌN LÊN ĐƠN ở từng sản phẩm để thêm vào đây.
                </p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const label = getCartEntryLabel(item);
                const price = getCartEntryPrice(item);
                const channel = item.source === "db_catalog" ? item.channel : item.sizeType;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm"
                  >
                    <div
                      className={`w-1.5 self-stretch rounded-full shrink-0 ${channel === "retail" ? "bg-blue-400" : "bg-violet-400"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
                        {label}
                      </p>
                      {price !== null && (
                        <p className="text-xs font-black text-indigo-700 mt-0.5">{fmt(price)}</p>
                      )}
                      <span
                        className={`inline-block mt-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          channel === "retail"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-violet-50 text-violet-700"
                        }`}
                      >
                        {channel === "retail" ? "Retail" : "Salon"}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemove(idx)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 mt-0.5"
                      title="Xóa khỏi giỏ"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <SheetFooter className="px-5 py-4 border-t border-slate-200 bg-slate-50">
            {cart.length > 0 ? (
              <div className="w-full space-y-2">
                <Button
                  onClick={onCreateOrder}
                  className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  TẠO ĐƠN NHÁP ({cart.length} sản phẩm)
                </Button>
                <p className="text-[10px] text-slate-400 text-center font-medium">
                  Đơn sẽ được lưu nháp — bạn có thể chỉnh sửa trước khi xác nhận.
                </p>
              </div>
            ) : (
              <Button variant="outline" className="w-full h-10 rounded-xl" onClick={onClose}>
                Đóng
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
