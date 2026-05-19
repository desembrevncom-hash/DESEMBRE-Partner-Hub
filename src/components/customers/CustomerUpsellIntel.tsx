import React, { useMemo } from "react";
import { TrendingUp, Sparkles, CheckCircle2, AlertTriangle, ArrowUpRight, Zap, Target } from "lucide-react";

interface CustomerUpsellIntelProps {
  orders: any[];
  items: any[];
  totalSpend: number;
}

export const CustomerUpsellIntel: React.FC<CustomerUpsellIntelProps> = ({ orders, items, totalSpend }) => {
  const hasData = orders.length > 0 && items.length > 0;

  const analysis = useMemo(() => {
    if (!hasData) return null;

    // 1. Dòng sản phẩm đã mua
    const purchasedLines = {
      cleansing: items.some(it => /(cleans|rửa mặt|tẩy trang)/i.test(it.product_name || "")),
      serum: items.some(it => /(serum|tế bào gốc|ampoule|concentrate)/i.test(it.product_name || "")),
      sunscreen: items.some(it => /(sun|chống nắng)/i.test(it.product_name || "")),
      cream: items.some(it => /(cream|kem dưỡng)/i.test(it.product_name || "")),
      mask: items.some(it => /(mask|mặt nạ)/i.test(it.product_name || "")),
    };

    // 2. Top sản phẩm khách thường mua
    const topProductsMap = new Map<string, number>();
    items.forEach(it => {
      const name = it.product_name || it.product_no || "Sản phẩm";
      topProductsMap.set(name, (topProductsMap.get(name) || 0) + (it.quantity || 1));
    });
    const topProducts = Array.from(topProductsMap.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    // 3. Dòng sản phẩm chưa từng mua
    const unpurchasedLines: string[] = [];
    if (!purchasedLines.cleansing) unpurchasedLines.push("Làm sạch (Tẩy trang, Sữa rửa mặt)");
    if (!purchasedLines.serum) unpurchasedLines.push("Tinh chất Ampoule / Tế bào gốc đặc trị");
    if (!purchasedLines.sunscreen) unpurchasedLines.push("Chống nắng bảo vệ da");
    if (!purchasedLines.cream) unpurchasedLines.push("Kem dưỡng ẩm & phục hồi khóa da");
    if (!purchasedLines.mask) unpurchasedLines.push("Mặt nạ sinh học / Mặt nạ kem trị liệu");

    // 4. Dự báo sắp hết hàng (restock)
    const forecastItems: any[] = [];
    const productLastPurchased = new Map<string, string>();
    items.forEach(it => {
      const dateStr = it.order?.created_at || it.created_at;
      if (dateStr && it.product_name) {
        const existing = productLastPurchased.get(it.product_name);
        if (!existing || new Date(dateStr) > new Date(existing)) {
          productLastPurchased.set(it.product_name, dateStr);
        }
      }
    });

    productLastPurchased.forEach((dateStr, name) => {
      const daysSince = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 45 && daysSince <= 90) {
        forecastItems.push({
          name,
          daysSince,
          status: "Cần nhắc mua lại (Đã dùng ~45-90 ngày)",
          severity: "warning"
        });
      } else if (daysSince > 90) {
        forecastItems.push({
          name,
          daysSince,
          status: "Cần nạp lại khẩn cấp (Đã mua >90 ngày)",
          severity: "danger"
        });
      }
    });

    // 5. Gợi ý bán chéo (cross sell)
    const crossSells: string[] = [];
    if (purchasedLines.serum && !purchasedLines.cream) {
      crossSells.push("Gợi ý bán kèm **Kem dưỡng khóa ẩm** để tối ưu hóa hiệu quả khóa dưỡng chất của Tinh chất Ampoule đã mua.");
    }
    if (purchasedLines.cleansing && !purchasedLines.sunscreen) {
      crossSells.push("Tư vấn thêm **Kem chống nắng Desembre** để bảo vệ nền da sau khi làm sạch sâu.");
    }
    if (!purchasedLines.cleansing && purchasedLines.cream) {
      crossSells.push("Chào bán thêm dòng **Tẩy trang & Sữa rửa mặt** để tối ưu hóa nền da trước dưỡng.");
    }
    if (purchasedLines.sunscreen && !purchasedLines.cleansing) {
      crossSells.push("Tư vấn **Tẩy trang chuyên dụng** để làm sạch sâu lớp kem chống nắng vật lý vào cuối ngày.");
    }
    if (crossSells.length === 0) {
      crossSells.push("Khuyên dùng **Tế bào gốc Desembre Activator** - dòng sản phẩm điều trị Spa bán chạy nhất.");
    }

    return {
      purchasedLines,
      topProducts,
      unpurchasedLines,
      forecastItems,
      crossSells
    };
  }, [orders, items, hasData]);

  // Tier progression details
  const tierProgress = useMemo(() => {
    let currentTier = "NEW CO";
    let nextTier = "SILVER";
    let progress = 0;
    let targetSpend = 1;
    let remaining = 1;

    if (totalSpend >= 100000000) {
      currentTier = "DIAMOND";
      nextTier = "HẠNG CAO NHẤT";
      progress = 100;
      remaining = 0;
      targetSpend = 100000000;
    } else if (totalSpend >= 50000000) {
      currentTier = "GOLD";
      nextTier = "DIAMOND";
      targetSpend = 100000000;
      remaining = 100000000 - totalSpend;
      progress = Math.min(100, Math.floor(((totalSpend - 50000000) / 50000000) * 100));
    } else if (totalSpend > 0) {
      currentTier = "SILVER";
      nextTier = "GOLD";
      targetSpend = 50000000;
      remaining = 50000000 - totalSpend;
      progress = Math.min(100, Math.floor((totalSpend / 50000000) * 100));
    } else {
      currentTier = "NEW CO";
      nextTier = "SILVER";
      targetSpend = 1;
      remaining = 1;
      progress = 0;
    }

    return {
      currentTier,
      nextTier,
      progress,
      targetSpend,
      remaining
    };
  }, [totalSpend]);

  if (!hasData) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <Sparkles className="w-8 h-8 text-slate-350 mx-auto mb-3 animate-pulse" />
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Customer Intelligence</h4>
        <p className="text-xs text-slate-500 mt-2 font-medium max-w-sm mx-auto leading-relaxed">
          Chưa đủ dữ liệu để gợi ý upsell. Hãy chốt đơn hàng đầu tiên của khách hàng để kích hoạt trí tuệ gợi ý bán hàng!
        </p>
      </div>
    );
  }

  const { purchasedLines, topProducts, unpurchasedLines, forecastItems, crossSells } = analysis!;

  return (
    <div className="space-y-6 text-left">
      {/* 1. TIẾN TRÌNH HẠNG KHÁCH HÀNG */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-500" />
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Tiến trình hạng khách</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
            LTV: {totalSpend.toLocaleString("vi-VN")} đ
          </span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-sm font-black text-slate-800">{tierProgress.currentTier}</span>
            <span className="text-xs font-bold text-slate-400">Tiến tới {tierProgress.nextTier}</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div 
              style={{ width: `${tierProgress.progress}%` }} 
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-500" 
            />
          </div>
          <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
            <span>{tierProgress.progress}% hoàn thành</span>
            {tierProgress.remaining > 0 && (
              <span>Cần thêm {tierProgress.remaining.toLocaleString("vi-VN")} đ</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. DÒNG SẢN PHẨM & TOP SẢN PHẨM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top sản phẩm đã mua */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-2xs space-y-3">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Top sản phẩm thường mua
          </span>
          <div className="divide-y divide-slate-50">
            {topProducts.map((p, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 truncate max-w-[200px]">{p.name}</span>
                <span className="font-black text-slate-400 shrink-0 bg-slate-50 px-2 py-0.5 rounded-md">SL: {p.qty}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trạng thái danh mục */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-2xs space-y-3">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-500" /> Danh mục đã trải nghiệm
          </span>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
            <div className={`p-2 rounded-xl border flex items-center justify-between ${purchasedLines.cleansing ? "bg-emerald-50/50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-400"}`}>
              <span>Làm sạch</span>
              <span>{purchasedLines.cleansing ? "✓" : "○"}</span>
            </div>
            <div className={`p-2 rounded-xl border flex items-center justify-between ${purchasedLines.serum ? "bg-emerald-50/50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-400"}`}>
              <span>Ampoule</span>
              <span>{purchasedLines.serum ? "✓" : "○"}</span>
            </div>
            <div className={`p-2 rounded-xl border flex items-center justify-between ${purchasedLines.sunscreen ? "bg-emerald-50/50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-400"}`}>
              <span>Chống nắng</span>
              <span>{purchasedLines.sunscreen ? "✓" : "○"}</span>
            </div>
            <div className={`p-2 rounded-xl border flex items-center justify-between ${purchasedLines.cream ? "bg-emerald-50/50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-400"}`}>
              <span>Kem dưỡng</span>
              <span>{purchasedLines.cream ? "✓" : "○"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DỰ BÁO SẮP HẾT HÀNG & GỢI Ý BÁN CHÉO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dự báo sắp hết hàng */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-2xs space-y-3">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 animate-bounce" /> Dự báo sắp hết hàng
          </span>
          <div className="space-y-2">
            {forecastItems.length > 0 ? (
              forecastItems.map((f, idx) => (
                <div key={idx} className={`p-3 rounded-xl border flex flex-col gap-1 ${f.severity === 'danger' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                  <span className="text-xs font-extrabold truncate">{f.name}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest">{f.status}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider py-4 text-center">Tất cả sản phẩm đều trong hạn dùng</p>
            )}
          </div>
        </div>

        {/* Gợi ý bán chéo */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-2xs space-y-3">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-indigo-500" /> Chiến lược gợi ý bán chéo
          </span>
          <div className="space-y-2.5">
            {crossSells.map((c, idx) => (
              <div key={idx} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 text-xs font-medium text-slate-700 leading-relaxed">
                {c.split("**").map((part, index) => 
                  index % 2 === 1 ? <strong key={index} className="text-indigo-700 font-extrabold">{part}</strong> : part
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. DÒNG SẢN PHẨM CHƯA MUA */}
      {unpurchasedLines.length > 0 && (
        <div className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-2xs space-y-3">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Dòng sản phẩm chưa từng mua</span>
          <div className="flex flex-wrap gap-2">
            {unpurchasedLines.map((l, idx) => (
              <span key={idx} className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-500">
                {l}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
