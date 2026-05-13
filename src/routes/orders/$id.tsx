import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/orders/$id")({
  component: OrderDetail,
});

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

function OrderDetail() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [checkinPromptOpen, setCheckinPromptOpen] = useState(false);
  const [creatingCheckin, setCreatingCheckin] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      let o = null;
      let it = [];
      const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      if (data) {
        o = data;
        const { data: itemsData } = await supabase.from("order_items").select("*").eq("order_id", id).order("created_at");
        it = itemsData ?? [];
      } else {
        // Fallback to local guest_orders
        const guestOrders = JSON.parse(localStorage.getItem("guest_orders") || "[]");
        const localOrder = guestOrders.find((go: any) => go.id === id);
        if (localOrder) {
          o = localOrder;
          it = localOrder.items || [];
        }
      }
      setOrder(o); setItems(it); setBusy(false);
    })();
  }, [id, user, loading]);

  const setStatus = async (status: string) => {
    // If it's a local order, update in localStorage
    const guestOrders = JSON.parse(localStorage.getItem("guest_orders") || "[]");
    const localIdx = guestOrders.findIndex((go: any) => go.id === id);
    if (localIdx >= 0) {
      guestOrders[localIdx].status = status;
      localStorage.setItem("guest_orders", JSON.stringify(guestOrders));
      toast.success("Đã cập nhật");
      const updatedOrder = { ...order, status };
      setOrder(updatedOrder);
      if (status === "confirmed" && (updatedOrder.customer_id || updatedOrder.customer_name)) {
        setCheckinPromptOpen(true);
      }
      return;
    }

    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Đã cập nhật");
    const updatedOrder = { ...order, status };
    setOrder(updatedOrder);
    if (status === "confirmed" && (updatedOrder.customer_id || updatedOrder.customer_name)) {
      setCheckinPromptOpen(true);
    }
  };

  // Hàm tạo lịch trình Check-in tự động sau 7 ngày (bước 9)
  const handleCreateCheckinEvent = async () => {
    if (!user) {
      toast.info("Tính năng tạo lịch hẹn trực tuyến cần đăng nhập");
      setCheckinPromptOpen(false);
      return;
    }
    setCreatingCheckin(true);
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 7);
      
      const payload = {
        title: "Check-in khách sau mua hàng",
        event_type: "check_in",
        status: "pending",
        starts_at: targetDate.toISOString(),
        order_id: order.id,
        customer_id: order.customer_id || null,
        assigned_sale_id: order.sale_user_id || user.id,
        created_by: user.id,
        remind_before_minutes: 30
      };

      const { error } = await supabase.from("calendar_events").insert([payload]);
      if (error) throw error;
      
      toast.success("Đã tạo lịch hẹn Check-in tự động sau 7 ngày!");
      setCheckinPromptOpen(false);
    } catch (err: any) {
      toast.error("Lỗi tạo lịch Check-in: " + err.message);
    } finally {
      setCreatingCheckin(false);
    }
  };

  if (busy) return <p className="p-6 text-sm text-muted-foreground">Đang tải…</p>;
  if (!order) return <p className="p-6">Không tìm thấy đơn.</p>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border print:hidden">
        <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link to="/orders" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Đơn hàng
          </Link>
          <div className="flex gap-2">
            {order.status === "draft" && (
              <>
                <Button size="sm" asChild variant="outline">
                  <Link to="/orders/new" search={{ edit: id }}>Chỉnh sửa</Link>
                </Button>
                <Button size="sm" onClick={() => setStatus("confirmed")}>Xác nhận</Button>
              </>
            )}
            {order.status !== "cancelled" && (
              <Button size="sm" variant="outline" onClick={() => setStatus("cancelled")}>Huỷ đơn</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> In
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-6 max-w-3xl">
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-start border-b border-border pb-4">
            <div>
              <h1 className="text-2xl font-bold">Đơn hàng #{order.order_no}</h1>
              <p className="text-xs text-muted-foreground mt-1">{new Date(order.created_at).toLocaleString("vi-VN")}</p>
            </div>
            <span className={`px-3 py-1 rounded text-xs font-semibold ${
              order.status === "confirmed" ? "bg-green-500/20 text-green-700" :
              order.status === "cancelled" ? "bg-red-500/20 text-red-700" :
              "bg-yellow-500/20 text-yellow-700"
            }`}>
              {order.status === "confirmed" ? "Đã xác nhận" : order.status === "cancelled" ? "Đã huỷ" : "Nháp"}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Khách hàng</div>
              <div className="font-semibold">{order.customer_name}</div>
              {order.customer_phone && <div>{order.customer_phone}</div>}
              {order.customer_address && <div className="text-muted-foreground">{order.customer_address}</div>}
            </div>
            {order.note && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Ghi chú</div>
                <div>{order.note}</div>
              </div>
            )}
          </div>

          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2">Sản phẩm</th>
                <th className="text-left py-2">Size</th>
                <th className="text-right py-2">Đơn giá</th>
                <th className="text-center py-2">SL</th>
                <th className="text-right py-2">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-border">
                  <td className="py-2">{it.product_name}</td>
                  <td className="py-2 text-xs text-muted-foreground">{it.size_type === "retail" ? "Retail" : "Salon"} {it.size}</td>
                  <td className="py-2 text-right font-mono">{fmt(it.unit_price)}</td>
                  <td className="py-2 text-center">{it.quantity}</td>
                  <td className="py-2 text-right font-mono font-semibold">{fmt(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-sm border-t border-border pt-3 ml-auto max-w-xs">
            <div className="flex justify-between"><span>Tạm tính</span><span className="font-mono">{fmt(order.subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Chiết khấu</span><span>-{Math.round(order.discount_rate * 100)}%</span></div>
            {Number(order.vat_rate) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>VAT</span><span>+{Math.round(order.vat_rate * 100)}%</span></div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border"><span>Tổng</span><span className="font-mono text-primary">{fmt(order.total)}</span></div>
          </div>
        </div>
      </main>

      {/* Dialog Gợi ý Tạo Lịch Hẹn Check-in Khách Hàng Sau Khi Xác Nhận Đơn (bước 9) */}
      <Dialog open={checkinPromptOpen} onOpenChange={setCheckinPromptOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold">
              <Calendar className="w-5 h-5" /> Gợi ý chăm sóc sau mua
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-xs text-slate-600 space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              Tạo lịch check-in sau 7 ngày?
            </p>
            <p>
              Hệ thống sẽ tự động lên lịch nhắc việc vào <span className="font-bold text-primary">7 ngày sau</span> để liên hệ hỏi thăm tình trạng sử dụng sản phẩm của khách hàng <span className="font-bold">{order.customer_name}</span>.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCheckinPromptOpen(false)}
              disabled={creatingCheckin}
            >
              Không, bỏ qua
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateCheckinEvent}
              disabled={creatingCheckin}
              className="font-bold"
            >
              {creatingCheckin ? "Đang tạo..." : "Đồng ý tạo lịch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
