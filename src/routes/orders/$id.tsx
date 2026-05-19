import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PRODUCTS, CATEGORIES } from "@/data/products";
import { 
  ArrowLeft, 
  Printer, 
  Truck, 
  CheckCircle2, 
  Package, 
  Clock, 
  ChevronRight, 
  UserCircle, 
  Building2, 
  Phone,
  ShieldCheck,
  AlertCircle,
  FileText,
  BadgeCheck,
  Zap,
  MoreVertical,
  XCircle,
  FileEdit,
  Sparkles,
  TrendingUp,
  PhoneCall,
  RefreshCw,
  ShoppingBag,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createPostPurchaseCheckinAutomation } from "@/lib/automation";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetail,
});

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";

function OrderDetail() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    fetchOrderDetail();
  }, [id, user, loading]);

  const fetchOrderDetail = async () => {
    setBusy(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*, customers(*)")
        .eq("id", id)
        .maybeSingle();

      if (orderError) throw orderError;

      if (orderData) {
        setOrder(orderData);
        const { data: itemsData } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", id)
          .order("created_at");
        setItems(itemsData ?? []);
      }
    } catch (err: any) {
      toast.error("Lỗi khi tải thông tin đơn hàng");
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      // Trigger Automation if status becomes 'delivered'
      if (newStatus === 'delivered') {
        await createPostPurchaseCheckinAutomation(
          order.customer_id, 
          order.sale_user_id || user?.id, 
          order.id
        );
        toast.success("Đơn hàng hoàn thành! Đã tự động lên lịch chăm sóc sau mua.");
      } else {
        toast.success(`Đã cập nhật trạng thái: ${newStatus}`);
      }

      setOrder({ ...order, status: newStatus });
    } catch (err: any) {
      toast.error("Lỗi cập nhật trạng thái: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusSteps = () => [
    { id: 'draft', label: 'Nháp', icon: FileEdit },
    { id: 'confirmed', label: 'Xác nhận', icon: BadgeCheck },
    { id: 'processing', label: 'Xử lý', icon: Package },
    { id: 'shipping', label: 'Giao hàng', icon: Truck },
    { id: 'delivered', label: 'Hoàn thành', icon: CheckCircle2 },
  ];

  const currentStepIdx = getStatusSteps().findIndex(s => s.id === order?.status);

  if (busy) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang trích xuất vận đơn...</p>
      </div>
    );
  }

  if (!order) return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50">
      <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
      <h2 className="text-lg font-bold text-slate-900">Không tìm thấy đơn hàng</h2>
      <Button onClick={() => navigate({ to: "/orders" })} className="mt-4">Quay lại danh sách</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      {/* HEADER ACTIONS */}
      <header className="bg-white/80 border-b border-slate-200/60 sticky top-0 z-20 backdrop-blur-md print:hidden">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <Link to="/orders" className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200">
               <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
               <h1 className="text-lg font-black text-slate-900 tracking-tight">Chi tiết Đơn #{order.order_no}</h1>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngày tạo: {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline" className="rounded-xl border-slate-200 font-bold text-xs h-10 px-6 shadow-sm hover:bg-slate-50" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2 text-slate-400" /> In đơn hàng
             </Button>
             {order.status !== 'delivered' && order.status !== 'cancelled' && (
               <Button 
                variant="destructive" 
                className="rounded-xl font-bold text-xs h-10 px-6 opacity-80 hover:opacity-100"
                onClick={() => updateStatus('cancelled')}
               >
                  <XCircle className="w-4 h-4 mr-2" /> Hủy đơn
               </Button>
             )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* STATUS STEPPER */}
        <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
           <CardContent className="p-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative">
                 {/* Progress Bar Background */}
                 <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 hidden md:block"></div>
                 
                 {getStatusSteps().map((step, idx) => {
                    const isCompleted = idx <= currentStepIdx;
                    const isActive = idx === currentStepIdx;
                    return (
                       <div key={step.id} className="relative z-1 flex flex-col items-center gap-3 group">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-4 transition-all duration-500 ${
                            isActive ? 'bg-primary text-white border-primary/20 scale-110 shadow-xl shadow-primary/20' : 
                            isCompleted ? 'bg-emerald-500 text-white border-emerald-100' : 
                            'bg-white text-slate-300 border-slate-50'
                          }`}>
                             <step.icon className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                             <p className={`text-[11px] font-black uppercase tracking-widest ${isCompleted ? 'text-slate-900' : 'text-slate-300'}`}>{step.label}</p>
                             {isActive && (
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 className="h-6 text-[9px] font-black text-primary hover:bg-primary/5 mt-1 rounded-full px-3"
                                 disabled={isUpdating}
                                 onClick={() => {
                                   const next = getStatusSteps()[idx + 1];
                                   if (next) updateStatus(next.id);
                                 }}
                               >
                                  BƯỚC TIẾP THEO <ChevronRight className="w-3 h-3 ml-0.5" />
                               </Button>
                             )}
                          </div>
                       </div>
                    );
                 })}
              </div>
           </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* LEFT: ORDER ITEMS */}
           <div className="lg:col-span-2 space-y-8">
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                 <CardHeader className="p-8 pb-4 border-b border-slate-50">
                    <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                       <Package className="w-5 h-5 text-primary" /> Danh sách mặt hàng
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <table className="w-full text-sm">
                       <thead>
                          <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                             <th className="px-8 py-4 text-left">Sản phẩm</th>
                             <th className="px-8 py-4 text-center">Số lượng</th>
                             <th className="px-8 py-4 text-right">Đơn giá</th>
                             <th className="px-8 py-4 text-right">Thành tiền</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {items.map(item => (
                             <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                                <td className="px-8 py-6">
                                   <p className="text-sm font-black text-slate-900">{item.product_name}</p>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{item.size_type || 'Retail'} {item.size}</p>
                                </td>
                                <td className="px-8 py-6 text-center font-black text-slate-900">
                                   {item.quantity}
                                </td>
                                <td className="px-8 py-6 text-right font-bold text-slate-600">
                                   {fmt(item.unit_price)}
                                </td>
                                <td className="px-8 py-6 text-right font-black text-primary">
                                   {fmt(item.line_total)}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                    
                    <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col items-end space-y-3">
                       <div className="flex justify-between w-full max-w-[300px] text-xs font-bold text-slate-500">
                          <span>Tạm tính</span>
                          <span className="text-slate-900">{fmt(order.subtotal || 0)}</span>
                       </div>
                       <div className="flex justify-between w-full max-w-[300px] text-xs font-bold text-emerald-600">
                          <span>Chiết khấu ({Math.round(order.discount_rate * 100)}%)</span>
                          <span>-{fmt(order.subtotal * order.discount_rate)}</span>
                       </div>
                       {order.vat_rate > 0 && (
                          <div className="flex justify-between w-full max-w-[300px] text-xs font-bold text-slate-500">
                             <span>Thuế VAT ({Math.round(order.vat_rate * 100)}%)</span>
                             <span>+{fmt(order.total * order.vat_rate)}</span>
                          </div>
                       )}
                       <div className="flex justify-between w-full max-w-[300px] pt-3 border-t border-slate-200">
                          <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Tổng cộng</span>
                          <span className="text-xl font-black text-indigo-600">{fmt(order.total)}</span>
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>

           {/* RIGHT: CUSTOMER & LOGISTICS INFO */}
           <div className="space-y-8">
              {/* Customer Card */}
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                 <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">Thông tin khách hàng</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 pt-0 space-y-6">
                    <div className="flex items-center gap-4 group">
                       <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-black border border-indigo-100 shadow-sm transition-transform group-hover:scale-105">
                          {order.customer_name?.slice(0,1)}
                       </div>
                       <div>
                          <p className="text-base font-black text-slate-900">{order.customer_name}</p>
                          <Link 
                            to="/customers/$id" 
                            params={{ id: order.customer_id }} 
                            className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline flex items-center gap-1 mt-0.5"
                          >
                             Xem hồ sơ đầy đủ <ChevronRight className="w-3 h-3" />
                          </Link>
                       </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                       <div className="flex items-center gap-3">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-bold text-slate-700">{order.customers?.facility_name || 'Spa tự do'}</span>
                       </div>
                       <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-bold text-slate-700">{order.customer_phone || '—'}</span>
                       </div>
                       <div className="flex items-start gap-3">
                          <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5" />
                          <span className="text-xs font-medium text-slate-600 leading-relaxed">{order.customer_address || 'Chưa cập nhật địa chỉ'}</span>
                       </div>
                    </div>
                 </CardContent>
              </Card>

              {/* Logistics & Payment */}
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                 <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">Vận chuyển & Thanh toán</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 pt-0 space-y-6">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Đơn vị vận chuyển</p>
                       <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">Giao Hàng Nhanh (GHN)</span>
                          <Badge variant="outline" className="bg-white text-indigo-500 text-[9px] font-black">EXPRESS</Badge>
                       </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hình thức thanh toán</p>
                       <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">Chuyển khoản Ngân hàng</span>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-black">ĐÃ THANH TOÁN</Badge>
                       </div>
                    </div>

                    <div className="pt-2 text-center">
                       <p className="text-[10px] text-slate-400 font-medium italic">
                          * Khi đơn hàng hoàn thành, hệ thống sẽ tự động lên lịch chăm sóc sau mua hàng cho khách.
                       </p>
                    </div>
                 </CardContent>
              </Card>

               {/* UPSELL INTELLIGENCE PANEL - visible for all non-cancelled orders */}
               {order.status !== 'cancelled' && items.length > 0 && (
                 <UpsellPanel items={items} customerPhone={order.customer_phone} customerName={order.customer_name} orderId={order.id} orderStatus={order.status} />
               )}
           </div>
        </div>
      </main>
    </div>
  );
}

// ─── UPSELL INTELLIGENCE PANEL ──────────────────────────────────────────────
function UpsellPanel({ items, customerPhone, customerName, orderId, orderStatus }: {
  items: any[];
  customerPhone: string;
  customerName: string;
  orderId: string;
  orderStatus?: string;
}) {
    // Per-variant cycle settings: { [productId]: { retail?: number; salon?: number } }
  const productCycles: Record<number, { retail?: number; salon?: number }> = (() => {
    try { return JSON.parse(localStorage.getItem('product_cycle_settings') || '{}'); } catch { return {}; }
  })();
  const tierSettings = (() => {
    try { return JSON.parse(localStorage.getItem('system_tier_settings') || '{}'); } catch { return {}; }
  })();
  const globalCycle = Number(tierSettings.refillCycleDays || 60);

  const suggestions = (() => {
    const result: Array<{
      productId: number | null;
      productName: string;
      categoryId: string;
      cycleDays: number;
      variantType: 'retail' | 'salon';
      variant: { size: string; price: number } | null;
      alertDays: number;
    }> = [];

    items.forEach(item => {
      const orderedType: 'retail' | 'salon' = item.size_type === 'salon' ? 'salon' : 'retail';
      
      // Try to match against product catalog for richer data
      const matched = PRODUCTS.find(p =>
        p.name === item.product_name ||
        (item.product_name && p.name && item.product_name.toLowerCase().includes(p.name.toLowerCase().slice(0, 15))) ||
        (item.product_name && p.name && p.name.toLowerCase().includes(item.product_name.toLowerCase().slice(0, 15)))
      );

      if (matched) {
        const retail = matched.variants.find(v => v.type === 'retail');
        const salon = matched.variants.find(v => v.type === 'salon');
        const cycleEntry = productCycles[matched.id] || {};
        const variantMatch = orderedType === 'salon' ? (salon || retail) : (retail || salon);
        const cycleDays = cycleEntry[orderedType] ?? globalCycle;
        const alertDays = Math.max(cycleDays - 10, 0);
        result.push({
          productId: matched.id,
          productName: matched.name,
          categoryId: matched.categoryId,
          cycleDays,
          variantType: orderedType,
          alertDays,
          variant: variantMatch ? { size: variantMatch.size, price: variantMatch.price } : { size: item.size || '', price: item.unit_price || 0 }
        });
      } else {
        // Fallback: use raw item data even without catalog match
        const cycleDays = globalCycle;
        const alertDays = Math.max(cycleDays - 10, 0);
        result.push({
          productId: null,
          productName: item.product_name || 'Sản phẩm không rõ',
          categoryId: '',
          cycleDays,
          variantType: orderedType,
          alertDays,
          variant: { size: item.size || '', price: item.unit_price || 0 }
        });
      }
    });

    return result;
  })();

  // Always show panel if items exist (never return null early)

  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';

  return (
    <Card className="rounded-[32px] border-none overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)' }}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-8 pt-8 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Upsell Intelligence</p>
              <h3 className="text-base font-black text-white mt-0.5">Gợi ý Tái mua hàng</h3>
            </div>
          </div>
          <p className="text-[11px] text-indigo-300 mt-3 leading-relaxed">
            {suggestions.length} sản phẩm trong đơn · Chu kỳ refill dự kiến:
          </p>
          {orderStatus !== 'delivered' && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-400/15 border border-amber-400/25 rounded-lg px-2.5 py-1">
              <Clock className="w-3 h-3 text-amber-300" />
              <span className="text-[9px] font-black text-amber-300 uppercase tracking-wider">Gọi gối đầu khi gần hết hàng</span>
            </div>
          )}
        </div>

        {/* Product list */}
        <div className="px-6 py-4 space-y-3">
          {suggestions.map((s, idx) => {
            const cat = CATEGORIES.find(c => c.id === s.categoryId);
            return (
              <div key={idx} className="p-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 transition-all group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-indigo-300">#{s.productId}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {(cat || s.categoryId) && (
                        <span className="text-[9px] font-black text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md uppercase tracking-widest shrink-0">
                          {cat?.nameVi || cat?.name || s.categoryId}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white line-clamp-2 leading-snug">{s.productName}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400">≈{s.cycleDays} ngày/chu kỳ</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] font-bold text-amber-400">Nhắc sau {s.alertDays} ngày</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={'text-[9px] font-black px-2 py-0.5 rounded-md ' + (s.variantType === 'retail' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300')}>
                        {s.variantType === 'retail' ? 'RETAIL' : 'SALON'} · {s.variant.size}
                      </span>
                      <span className="text-[11px] font-black text-indigo-300">{fmt(s.variant.price)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Actions */}
        <div className="px-6 pb-4 space-y-3">
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="flex items-center justify-center gap-2.5 w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-white font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] shadow-lg shadow-emerald-500/30"
            >
              <PhoneCall className="w-4 h-4" /> Gọi ngay {customerName?.split(' ').slice(-1)[0] || 'khách'}
            </a>
          )}
          <Link
            to="/orders/new"
            className="flex items-center justify-center gap-2.5 w-full h-11 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 font-black text-xs uppercase tracking-widest transition-all"
          >
            <ShoppingBag className="w-4 h-4" /> Tạo đơn Upsell mới
            <ArrowRight className="w-3.5 h-3.5 ml-auto" />
          </Link>
        </div>

        {/* Footer tip */}
        <div className="px-6 pb-6">
          <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-start gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-200 font-medium leading-relaxed">
              Gọi điện nhắc tái mua gối đầu trước khi khách cạn kiệt sản phẩm để tăng tỷ lệ chốt đơn lên 2-3x.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
