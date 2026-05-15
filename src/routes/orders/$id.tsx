import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  FileEdit
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
           </div>
        </div>
      </main>
    </div>
  );
}
