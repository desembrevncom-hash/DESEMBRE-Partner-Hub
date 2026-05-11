import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, FileText } from "lucide-react";

export const Route = createFileRoute("/orders/")({
  component: OrdersList,
});

type OrderRow = {
  id: string;
  order_no: number;
  sale_user_id: string;
  customer_name: string;
  customer_phone: string | null;
  total: number;
  status: string;
  created_at: string;
};

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));
const dt = (s: string) => new Date(s).toLocaleString("vi-VN");

function OrdersList() {
  const { user, isAdmin, isSale, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "confirmed">("all");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!isAdmin && !isSale) {
      navigate({ to: "/" });
      return;
    }
    (async () => {
      let query = supabase
        .from("orders")
        .select("id,order_no,sale_user_id,customer_name,customer_phone,total,status,created_at")
        .order("created_at", { ascending: false });

      if (!isAdmin && user?.id) {
        query = query.eq("sale_user_id", user.id);
      }

      const { data } = await query;
        
      const guestOrders = JSON.parse(localStorage.getItem("guest_orders") || "[]");
      const filteredGuest = isAdmin ? guestOrders : guestOrders.filter((go: any) => go.sale_user_id === user?.id || go.sale_user_id === "guest");

      const combined = [...(data ?? []), ...filteredGuest];
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setOrders(combined as OrderRow[]);
      setBusy(false);
    })();
  }, [user, isAdmin, isSale, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Trang chủ
            </Link>
            <h1 className="text-xl font-bold">Đơn hàng</h1>
          </div>
          <Button asChild size="sm">
            <Link to="/orders/new"><Plus className="w-4 h-4" /> Tạo đơn mới</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-6">
        {busy ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
              <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Tất cả</Button>
              <Button variant={filter === "draft" ? "default" : "outline"} size="sm" onClick={() => setFilter("draft")}>Bản nháp</Button>
              <Button variant={filter === "confirmed" ? "default" : "outline"} size="sm" onClick={() => setFilter("confirmed")}>Đã xác nhận</Button>
            </div>
            
            {orders.filter(o => filter === "all" || o.status === filter).length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto opacity-30 mb-2" />
                <p className="text-sm">Chưa có đơn nào.</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Mã đơn</th>
                  <th className="text-left px-4 py-3">Khách hàng</th>
                  <th className="text-left px-4 py-3">SĐT</th>
                  <th className="text-right px-4 py-3">Tổng tiền</th>
                  <th className="text-center px-4 py-3">Trạng thái</th>
                  <th className="text-left px-4 py-3">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {orders.filter(o => filter === "all" || o.status === filter).map((o) => (
                  <tr key={o.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono">
                      <Link to="/orders/$id" params={{ id: o.id }} className="text-primary hover:underline">
                        #{o.order_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold">{o.customer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customer_phone ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(o.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        o.status === "confirmed" ? "bg-green-500/20 text-green-700 dark:text-green-300"
                          : o.status === "cancelled" ? "bg-red-500/20 text-red-700 dark:text-red-300"
                          : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
                      }`}>
                        {o.status === "confirmed" ? "Đã xác nhận" : o.status === "cancelled" ? "Huỷ" : "Nháp"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{dt(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
