import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ArrowLeft,
  FileText,
  Search,
  Filter,
  TrendingUp,
  Clock,
  Truck,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  MoreHorizontal,
  Download,
  LayoutDashboard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMTableWrapper } from "@/components/crm/CRMTableWrapper";
import { CRMStatusBadge } from "@/components/crm/CRMStatusBadge";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";
import { CRMLoadingState } from "@/components/crm/CRMLoadingState";

export const Route = createFileRoute("/orders/")({
  component: OrdersList,
});

type OrderRow = {
  id: string;
  order_no: number;
  sale_user_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  total: number;
  status: string;
  created_at: string;
  customers?: {
    facility_name: string;
  };
};

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";

function OrdersList() {
  const { user, isAdmin, isSale, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    fetchOrders();
  }, [user, isAdmin, isSale, loading]);

  const fetchOrders = async () => {
    setBusy(true);
    try {
      let query = supabase
        .from("orders")
        .select("*, customers(facility_name)")
        .order("created_at", { ascending: false });

      if (!isAdmin && user?.id) {
        query = query.eq("sale_user_id", user.id);
      }

      const { data } = await query;
      setOrders((data as OrderRow[]) || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setBusy(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "draft":
        return { label: "Bản nháp", color: "bg-slate-100 text-slate-600 border-slate-200" };
      case "confirmed":
        return { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700 border-blue-200" };
      case "processing":
        return { label: "Đang xử lý", color: "bg-purple-100 text-purple-700 border-purple-200" };
      case "shipping":
        return { label: "Đang giao", color: "bg-amber-100 text-amber-700 border-amber-200" };
      case "delivered":
        return { label: "Hoàn thành", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
      case "cancelled":
        return { label: "Đã hủy", color: "bg-red-100 text-red-700 border-red-200" };
      default:
        return { label: status, color: "bg-slate-100 text-slate-500 border-slate-200" };
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = filterStatus === "all" || o.status === filterStatus;
    const matchesSearch =
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.order_no.toString().includes(searchQuery) ||
      o.customers?.facility_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    totalRevenue: orders
      .filter((o) => o.status !== "cancelled")
      .reduce((acc, o) => acc + o.total, 0),
    pendingCount: orders.filter((o) => ["confirmed", "processing", "shipping"].includes(o.status))
      .length,
    deliveredCount: orders.filter((o) => o.status === "delivered").length,
  };

  return (
    <CRMPageContainer>
      <CRMPageHeader
        title="Quản lý Đơn hàng"
        subtitle="Financial Control Center"
        icon={<LayoutDashboard className="w-5 h-5 text-indigo-600" />}
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="hidden md:flex rounded-xl border-slate-200 font-bold text-xs h-9"
            >
              <Download className="w-3.5 h-3.5 mr-2" /> Xuất báo cáo
            </Button>
            <Button
              asChild
              className="rounded-xl bg-primary shadow-lg shadow-primary/20 font-black text-xs h-9 px-6"
            >
              <Link to="/orders/new">
                <Plus className="w-4 h-4 mr-2" /> Tạo đơn mới
              </Link>
            </Button>
          </div>
        }
        backTo="/workspace"
      />

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* KPI OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CRMCard className="bg-slate-900 text-white overflow-hidden relative">
            <div className="p-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Tổng doanh thu hệ thống
              </p>
              <h3 className="text-2xl font-black">{fmt(stats.totalRevenue)}</h3>
              <div className="mt-4 flex items-center gap-2">
                <CRMStatusBadge
                  variant="success"
                  className="bg-emerald-500/20 text-emerald-400 border-none"
                >
                  +12% tháng này
                </CRMStatusBadge>
              </div>
              <TrendingUp className="absolute -bottom-2 -right-2 w-24 h-24 text-white/5" />
            </div>
          </CRMCard>
          <CRMCard className="overflow-hidden">
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Đang xử lý/Giao hàng
                </p>
                <h3 className="text-2xl font-black text-slate-900">{stats.pendingCount} Đơn</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100">
                <Truck className="w-6 h-6" />
              </div>
            </div>
          </CRMCard>
          <CRMCard className="overflow-hidden">
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Đã hoàn thành
                </p>
                <h3 className="text-2xl font-black text-slate-900">{stats.deliveredCount} Đơn</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </CRMCard>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm mã đơn, tên khách hàng hoặc spa..."
              className="pl-10 rounded-xl bg-white border-slate-200 focus:ring-primary/20 h-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full md:w-auto">
            {["all", "draft", "confirmed", "processing", "shipping", "delivered", "cancelled"].map(
              (status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-full px-4 text-[11px] font-bold h-9 transition-all ${filterStatus === status ? "bg-slate-900 shadow-lg" : "bg-white border-slate-200"}`}
                >
                  {status === "all" ? "Tất cả" : getStatusConfig(status).label}
                </Button>
              ),
            )}
          </div>
        </div>

        {/* ORDERS TABLE CONTAINER */}
        <CRMCard className="overflow-hidden p-0">
          <CRMTableWrapper>
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Mã đơn
                    </th>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Khách hàng / Spa
                    </th>
                    <th className="text-right px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Tổng tiền
                    </th>
                    <th className="text-center px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Trạng thái
                    </th>
                    <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Ngày tạo
                    </th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {busy ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <CRMLoadingState type="table" rows={3} />
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <CRMEmptyState
                          title="Không tìm thấy đơn hàng nào"
                          icon={<FileText className="w-12 h-12 text-slate-100" />}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const config = getStatusConfig(order.status);
                      return (
                        <tr
                          key={order.id}
                          onClick={() => navigate({ to: "/orders/$id", params: { id: order.id } })}
                          className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2 group/link">
                              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 group-hover/link:bg-primary group-hover/link:text-white transition-all">
                                #{order.order_no}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            {order.customer_id ? (
                              <Link
                                to="/customers/$id"
                                params={{ id: order.customer_id }}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-indigo-600 transition-colors group/cust relative z-10 block"
                              >
                                <p className="text-[13px] font-black text-slate-900 group-hover/cust:text-indigo-600">
                                  {order.customers?.facility_name || "Spa tự do"}
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {order.customer_name} • {order.customer_phone || "—"}
                                </p>
                              </Link>
                            ) : (
                              <>
                                <p className="text-[13px] font-black text-slate-850">
                                  {order.customers?.facility_name || "Spa tự do"}
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {order.customer_name} • {order.customer_phone || "—"}
                                </p>
                              </>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right font-black text-slate-900">
                            {fmt(order.total)}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <CRMStatusBadge
                              variant={
                                order.status === "draft"
                                  ? "neutral"
                                  : order.status === "cancelled"
                                    ? "error"
                                    : order.status === "delivered"
                                      ? "success"
                                      : order.status === "processing"
                                        ? "premium"
                                        : order.status === "shipping"
                                          ? "warning"
                                          : "info"
                              }
                            >
                              {config.label}
                            </CRMStatusBadge>
                          </td>
                          <td className="px-6 py-5 text-[11px] text-slate-400 font-bold">
                            {format(new Date(order.created_at), "HH:mm · dd/MM/yyyy", {
                              locale: vi,
                            })}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-300 hover:text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CRMTableWrapper>

          {/* Mobile Card List View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {busy ? (
              <div className="py-8">
                <CRMLoadingState type="list" rows={3} />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-8">
                <CRMEmptyState
                  title="Không có đơn hàng nào"
                  icon={<FileText className="w-12 h-12 text-slate-100" />}
                />
              </div>
            ) : (
              filteredOrders.map((order) => {
                const config = getStatusConfig(order.status);
                return (
                  <CRMCard
                    variant="inner"
                    key={order.id}
                    onClick={() => navigate({ to: "/orders/$id", params: { id: order.id } })}
                    className="p-4 hover:bg-slate-50/50 transition-all cursor-pointer active:bg-slate-100 flex flex-col gap-3 rounded-none border-b border-x-0 border-t-0 last:border-b-0"
                  >
                    {/* Header: Order No & Status Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100">
                          #{order.order_no}
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {format(new Date(order.created_at), "HH:mm · dd/MM/yy", { locale: vi })}
                        </span>
                      </div>
                      <CRMStatusBadge
                        variant={
                          order.status === "draft"
                            ? "neutral"
                            : order.status === "cancelled"
                              ? "error"
                              : order.status === "delivered"
                                ? "success"
                                : order.status === "processing"
                                  ? "premium"
                                  : order.status === "shipping"
                                    ? "warning"
                                    : "info"
                        }
                      >
                        {config.label}
                      </CRMStatusBadge>
                    </div>

                    {/* Body: Customer & Price */}
                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-slate-900 truncate">
                          {order.customers?.facility_name || "Spa tự do"}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">
                          {order.customer_name}{" "}
                          {order.customer_phone ? `· ${order.customer_phone}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-slate-900 block">
                          {fmt(order.total)}
                        </span>
                      </div>
                    </div>
                  </CRMCard>
                );
              })
            )}
          </div>
        </CRMCard>
      </main>
    </CRMPageContainer>
  );
}

// Fallback Icon
function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
