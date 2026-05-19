import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceShell } from "./WorkspaceShell";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { getStaffName } from "@/lib/customerOwnership";
import { 
  Phone, 
  Clock, 
  UserCheck, 
  FileText, 
  Plus, 
  LayoutDashboard,
  Zap,
  Play,
  Check,
  PhoneOff,
  CalendarClock,
  User,
  Info,
  ChevronRight,
  Package,
  AlertCircle,
  MoreHorizontal,
  UserX,
  Heart,
  ArrowRightLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskActionDialog } from "./TaskActionDialog";
import { getTaskTypeLabel, getTaskStatusLabel } from "@/lib/tasks";

export const SaleWorkspace: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>({
    allTasks: [],
    todayTasks: [],
    allAppointments: [],
    todayAppointments: [],
    notifications: [],
    customers: [],
    companyEvents: [],
    orders: [],
    loading: true
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  
  // Task Actions
  const [taskAction, setTaskAction] = useState<{ task: any; action: string } | null>(null);

  // Drawer Preview
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);

  // Active Queue Dialog
  const [activeQueue, setActiveQueue] = useState<{ title: string; items: any[]; type: 'task' | 'customer' | 'order' } | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      
      const [tasksRes, personalRes, companyRes, notifsRes, customersRes, ordersRes] = await Promise.all([
        supabase.from("customer_tasks")
          .select("*, customer:customers(*)")
          .eq("assigned_to", user.id)
          .neq("status", "completed")
          .neq("status", "cancelled"),
        supabase.from("calendar_events")
          .select("*")
          .eq("assigned_sale_id", user.id)
          .order("starts_at", { ascending: true }),
        supabase.from("company_events").select("*").order("starts_at", { ascending: true }),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("customers")
          .select("*")
          .eq("owner_sale_id", user.id)
          .is("deleted_at", null),
        supabase.from("orders")
          .select("*, customer:customers(*)")
          .eq("created_by", user.id)
          .in("status", ["draft", "pending"])
      ]);

      const allTasks = tasksRes.data || [];
      const allAppointments = personalRes.data || [];

      const todayTasks = allTasks.filter((t: any) => {
        if (!t.due_at) return false;
        const dueTime = new Date(t.due_at).getTime();
        return dueTime <= endOfToday.getTime();
      });

      const todayAppointments = allAppointments.filter((a: any) => {
        if (!a.starts_at) return false;
        const startTime = new Date(a.starts_at).getTime();
        return startTime >= startOfToday.getTime() && startTime <= endOfToday.getTime();
      });

      setData({
        allTasks,
        todayTasks,
        allAppointments,
        todayAppointments,
        companyEvents: companyRes.data || [],
        notifications: notifsRes.data || [],
        customers: customersRes.data || [],
        orders: ordersRes.data || [],
        loading: false
      });
    }
    fetchData();
  }, [user, refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  // Grouped Queues
  const leadTasks = data.allTasks.filter((t: any) => t.task_type === 'call');
  
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const followUpToday = data.customers.filter((c: any) => c.next_follow_up_at && new Date(c.next_follow_up_at).getTime() <= endOfToday.getTime());

  const checkinTasks = data.allTasks.filter((t: any) => t.task_type === 'check_in' || t.task_type === 'visit' || t.title?.toLowerCase().includes('check'));
  const quotationTasks = data.allTasks.filter((t: any) => t.task_type === 'quote_follow_up' || t.task_type === 'quotation' || t.title?.toLowerCase().includes('báo giá'));
  const pendingOrders = data.orders;

  // Sort tasks for Priority Tasks
  const priorityTasks = [...data.allTasks].sort((a, b) => {
    const overdueA = new Date(a.due_at).getTime() < new Date().getTime();
    const overdueB = new Date(b.due_at).getTime() < new Date().getTime();
    if (overdueA && !overdueB) return -1;
    if (!overdueA && overdueB) return 1;

    const prioOrder: Record<string, number> = { urgent: 3, high: 2, normal: 1, low: 0 };
    const scoreA = prioOrder[a.priority || "normal"] || 1;
    const scoreB = prioOrder[b.priority || "normal"] || 1;
    return scoreB - scoreA;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <WorkspaceShell title="Sales Workspace" icon={<LayoutDashboard className="w-6 h-6" />} loading={data.loading}>
      
      {/* ACTIONS ROW */}
      <div className="flex justify-end gap-3 mb-6">
        <Button asChild size="sm" className="bg-slate-900 hover:bg-primary rounded-xl font-bold px-4">
          <Link to="/orders/new"><Plus className="w-4 h-4 mr-2" /> Tạo đơn mới</Link>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-white border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-4"
          onClick={() => setIsAddCustomerOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2 text-primary" /> Thêm khách hàng
        </Button>
      </div>

      {/* ACTONABLE QUEUE CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        
        {/* Card 1: Lead cần gọi */}
        <div className="bg-white rounded-2xl border border-blue-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <Phone className="w-20 h-20 text-blue-600" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Lead cần gọi</span>
            <div className="text-3xl font-black text-slate-900">{leadTasks.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Lead/Task cần gọi", items: leadTasks, type: 'task' })}
          >
            Xem
          </Button>
        </div>

        {/* Card 2: Follow-up hôm nay */}
        <div className="bg-white rounded-2xl border border-amber-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <Clock className="w-20 h-20 text-amber-500" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Follow-up hôm nay</span>
            <div className="text-3xl font-black text-slate-900">{followUpToday.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-amber-600 hover:text-amber-700 hover:bg-amber-50/50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Khách hàng cần Follow-up hôm nay", items: followUpToday, type: 'customer' })}
          >
            Xem
          </Button>
        </div>

        {/* Card 3: Khách cần check-in */}
        <div className="bg-white rounded-2xl border border-emerald-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <UserCheck className="w-20 h-20 text-emerald-600" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Cần check-in</span>
            <div className="text-3xl font-black text-slate-900">{checkinTasks.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Khách hàng cần check-in", items: checkinTasks, type: 'task' })}
          >
            Xem
          </Button>
        </div>

        {/* Card 4: Báo giá chưa chốt */}
        <div className="bg-white rounded-2xl border border-violet-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <FileText className="w-20 h-20 text-violet-600" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Báo giá chưa chốt</span>
            <div className="text-3xl font-black text-slate-900">{quotationTasks.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-violet-600 hover:text-violet-700 hover:bg-violet-50/50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Lịch sử báo giá chưa chốt", items: quotationTasks, type: 'task' })}
          >
            Xem
          </Button>
        </div>

        {/* Card 5: Đơn nháp/Chờ xử lý */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <Package className="w-20 h-20 text-slate-600" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Đơn nháp / Chờ duyệt</span>
            <div className="text-3xl font-black text-slate-900">{pendingOrders.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-slate-600 hover:text-slate-700 hover:bg-slate-50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Đơn hàng nháp & Chờ xử lý", items: pendingOrders, type: 'order' })}
          >
            Xem
          </Button>
        </div>

      </div>

      {/* PRIORITY TASKS SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs mb-8">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Việc ưu tiên hôm nay</h3>
        </div>

        {priorityTasks.length > 0 ? (
          <div className="space-y-3">
            {priorityTasks.map((t: any) => {
              const isOverdue = new Date(t.due_at).getTime() < new Date().getTime();
              
              return (
                <div key={t.id} className="p-4 rounded-2xl border border-slate-150 bg-white hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 leading-snug">{t.title}</span>
                      <Badge className={`text-[9px] uppercase font-black tracking-wider ${
                        t.priority === 'urgent' ? 'bg-red-650 text-white' :
                        t.priority === 'high' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {t.priority || "NORMAL"}
                      </Badge>
                      <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 border uppercase tracking-wider ${
                        t.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {getTaskStatusLabel(t.status)}
                      </Badge>
                      {isOverdue && <Badge className="bg-red-50 text-red-750 border border-red-200 text-[9px] font-black uppercase">Quá hạn</Badge>}
                    </div>

                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-450 font-bold">
                      {t.customer && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {t.customer.name} ({t.customer.facility_name || "Spa tự do"})
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Hạn chót: {format(new Date(t.due_at), "dd/MM HH:mm", { locale: vi })}
                      </span>
                    </div>
                  </div>

                  {/* QUICK ACTIONS ROW */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {t.customer_id && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setPreviewCustomerId(t.customer_id)}
                        className="h-8 text-[11px] font-black text-primary hover:bg-slate-100"
                      >
                        Mở khách
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg hover:bg-slate-105 border border-slate-200">
                          <MoreHorizontal className="w-4 h-4 text-slate-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setTaskAction({ task: t, action: "start" })}>
                          <Play className="w-3.5 h-3.5 mr-2 text-blue-500" /> Bắt đầu xử lý
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTaskAction({ task: t, action: "completed" })}>
                          <Check className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Hoàn thành
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTaskAction({ task: t, action: "no_answer" })}>
                          <PhoneOff className="w-3.5 h-3.5 mr-2 text-red-500" /> Không nghe máy
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTaskAction({ task: t, action: "wrong_number" })}>
                          <UserX className="w-3.5 h-3.5 mr-2 text-slate-500" /> Sai số
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTaskAction({ task: t, action: "interested" })}>
                          <Heart className="w-3.5 h-3.5 mr-2 text-pink-500" /> Khách quan tâm
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTaskAction({ task: t, action: "call_back_later" })}>
                          <CalendarClock className="w-3.5 h-3.5 mr-2 text-amber-500" /> Hẹn gọi lại
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTaskAction({ task: t, action: "transfer_to_sale" })}>
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-2 text-indigo-500" /> Cần chuyển Sale
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Check className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-bold">Chưa có việc cần làm</p>
          </div>
        )}
      </div>

      {/* QUEUE DETAILS DIALOG */}
      <Dialog open={!!activeQueue} onOpenChange={(o) => !o && setActiveQueue(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
              📋 {activeQueue?.title} ({activeQueue?.items?.length || 0})
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-2 mt-4">
            {activeQueue?.items && activeQueue.items.length > 0 ? (
              <div className="space-y-2">
                {activeQueue.type === 'task' && activeQueue.items.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-950 leading-snug">{item.title}</div>
                      {item.customer && (
                        <div className="text-[10px] text-slate-450 font-bold mt-1">🏢 {item.customer.name} ({item.customer.facility_name || "Spa tự do"})</div>
                      )}
                    </div>
                    {item.customer_id && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setActiveQueue(null);
                          setPreviewCustomerId(item.customer_id);
                        }}
                        className="h-7 text-[10px] font-bold"
                      >
                        Chi tiết
                      </Button>
                    )}
                  </div>
                ))}

                {activeQueue.type === 'customer' && activeQueue.items.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-950 leading-snug">{item.name || item.contact_name}</div>
                      <div className="text-[10px] text-slate-450 font-bold mt-1">🏢 {item.facility_name || item.business_name || "Spa tự do"}</div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setActiveQueue(null);
                        setPreviewCustomerId(item.id);
                      }}
                      className="h-7 text-[10px] font-bold"
                    >
                      Hồ sơ nhanh
                    </Button>
                  </div>
                ))}

                {activeQueue.type === 'order' && activeQueue.items.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-950 leading-snug">Mã đơn: #{item.order_no || item.id.slice(0, 8)}</div>
                      <div className="text-[10px] text-slate-450 font-bold mt-1">
                        Tổng tiền: {formatCurrency(item.total || item.total_amount || 0)} · Trạng thái: {item.status}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setActiveQueue(null);
                        navigate({ to: "/orders/$id", params: { id: item.id } });
                      }}
                      className="h-7 text-[10px] font-bold"
                    >
                      Xem đơn
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Không có dữ liệu trong hàng chờ này</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* PREVIEW CUSTOMER DRAWER */}
      <CustomerPreviewDrawer 
        customer={{ id: previewCustomerId }}
        open={!!previewCustomerId}
        onOpenChange={(o) => !o && setPreviewCustomerId(null)}
        getStaffName={getStaffName}
      />

      <AddCustomerDialog 
        open={isAddCustomerOpen} 
        onOpenChange={setIsAddCustomerOpen} 
        onSuccess={handleRefresh}
      />

      <TaskActionDialog 
        taskAction={taskAction}
        onClose={() => setTaskAction(null)}
        onSuccess={handleRefresh}
      />
    </WorkspaceShell>
  );
};
