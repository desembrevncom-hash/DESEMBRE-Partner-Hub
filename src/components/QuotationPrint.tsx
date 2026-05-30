// @ts-nocheck
import React from "react";
import { fmt } from "@/lib/utils"; // Assuming utils has fmt or I'll define it locally

interface QuotationProps {
  orderNo: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: any[];
  subtotal: number;
  vatAmount: number;
  total: number;
  note?: string;
  quoterName?: string;
  quoterEmail?: string;
  vatRate?: number;
}

export const QuotationPrint = React.forwardRef<HTMLDivElement, QuotationProps>((props, ref) => {
  const { orderNo, customerName, customerPhone, customerAddress, items, subtotal, vatAmount, total, note, quoterName, quoterEmail, vatRate = 0.08 } = props;
  const dateStr = new Date().toLocaleDateString("vi-VN");

  return (
    <div ref={ref} className="p-0 bg-white text-black w-full max-w-[800px] mx-auto hidden print:block font-sans">
      {/* Header with Background/Banner Style */}
      <div className="relative h-48 overflow-hidden bg-gray-800">
        <img 
          src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1000&auto=format&fit=crop" 
          className="w-full h-full object-cover opacity-50"
          alt="Banner"
        />
        <div className="absolute inset-0 p-8 flex justify-between items-start text-white">
          <div className="bg-white/90 p-4 rounded-sm text-black shadow-lg max-w-[300px]">
            <h1 className="text-xl font-black tracking-tighter text-primary">DESEMBRE VIETNAM</h1>
            <p className="text-[10px] leading-relaxed mt-1 font-medium">
              123 Đường ABC, Quận XYZ, TP. Hồ Chí Minh<br/>
              Hotline: 0123 456 789 | contact@desembre.vn<br/>
              www.desembre.vn
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black uppercase tracking-tight mb-1">QUOTATION</h2>
            <div className="text-xs space-y-0.5 opacity-90">
              <p>Quote No: <span className="font-bold">#{orderNo}</span></p>
              <p>Date: {dateStr}</p>
              <p>Valid Until: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("vi-VN")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-10 pt-6">
        {/* Customer Information Section */}
        <div className="bg-[#e9d5b3] p-4 mb-8 flex justify-between items-center rounded-sm">
          <div>
            <h3 className="text-sm font-bold uppercase mb-1">Customer Information</h3>
            <p className="text-sm font-bold">{customerName}</p>
            <p className="text-xs opacity-80">{customerPhone} {customerAddress && `| ${customerAddress}`}</p>
          </div>
        </div>

        {/* Product Table */}
        <div className="mb-8 overflow-hidden rounded-sm border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-black text-white uppercase text-[10px] tracking-wider">
                <th className="p-3 text-center w-12 border-r border-white/20">#</th>
                <th className="p-3 text-left border-r border-white/20">Description / Product Name</th>
                <th className="p-3 text-center w-20 border-r border-white/20">Size</th>
                <th className="p-3 text-right w-28 border-r border-white/20">Unit Cost</th>
                <th className="p-3 text-center w-16 border-r border-white/20">Qty</th>
                <th className="p-3 text-right w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="p-3 text-center border-r border-gray-100">{idx + 1}</td>
                  <td className="p-3 border-r border-gray-100">
                    <p className="font-bold">{it.product_name}</p>
                    <p className="text-[10px] text-gray-500 italic">Official Desembre Product</p>
                  </td>
                  <td className="p-3 text-center uppercase text-[10px] border-r border-gray-100">{it.size}</td>
                  <td className="p-3 text-right font-mono border-r border-gray-100">{new Intl.NumberFormat("vi-VN").format(it.unit_price)}</td>
                  <td className="p-3 text-center border-r border-gray-100">{it.quantity}</td>
                  <td className="p-3 text-right font-mono font-bold">
                    {new Intl.NumberFormat("vi-VN").format(it.unit_price * it.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary and Notes */}
        <div className="flex justify-between gap-10">
          <div className="flex-1">
            {note && (
              <div className="mb-6">
                <h4 className="text-[10px] font-bold uppercase text-gray-400 mb-1">Notes & Instructions</h4>
                <p className="text-xs text-gray-600 italic border-l-2 border-gray-200 pl-3 py-1 bg-gray-50">
                  {note}
                </p>
              </div>
            )}
            <div className="text-[10px] text-gray-400 leading-relaxed">
              <p className="font-bold mb-1">Terms & Conditions:</p>
              <ul className="list-disc pl-3 space-y-0.5">
                <li>Quote is valid for 7 days from the date of issue.</li>
                <li>Prices inclusive of all standard discounts.</li>
                <li>Payment required upon order confirmation.</li>
              </ul>
            </div>
          </div>
          
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-xs py-1 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Sub-Total:</span>
              <span className="font-mono">{new Intl.NumberFormat("vi-VN").format(subtotal)}</span>
            </div>
            {vatAmount > 0 && (
              <div className="flex justify-between text-xs py-1 border-b border-gray-100 text-orange-600">
                <span className="font-medium">Tax (VAT {Math.round(vatRate * 100)}%):</span>
                <span className="font-mono">+{new Intl.NumberFormat("vi-VN").format(vatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-3 bg-black text-white px-3 rounded-sm mt-2">
              <span className="text-xs font-black uppercase tracking-widest">Total</span>
              <span className="text-lg font-black font-mono">
                {new Intl.NumberFormat("vi-VN").format(total)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-100 flex justify-between items-start text-left">
          <div className="w-1/2">
            <h5 className="text-xs font-black uppercase mb-1">Người lập báo giá</h5>
            <p className="text-sm font-bold">{quoterName || "(Ký và ghi rõ họ tên)"}</p>
            {quoterEmail && <p className="text-[10px] text-gray-500">{quoterEmail}</p>}
          </div>
          <div className="w-1/2 text-right">
            <h5 className="text-sm font-black mb-1">Thank you for your Business!</h5>
            <p className="text-[9px] text-gray-400 uppercase tracking-[0.2em]">Desembre Vietnam - Quality is our priority</p>
          </div>
        </div>
      </div>
    </div>
  );
});

QuotationPrint.displayName = "QuotationPrint";
