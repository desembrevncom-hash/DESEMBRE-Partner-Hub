import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { WorkspaceShell } from "./WorkspaceShell";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";

import {
  Phone,
  Clock,
  UserCheck,
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
  AlertCircle,
  Target,
  ArrowRight,
  MoreHorizontal,
  UserX,
  Heart,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskActionDialog } from "./TaskActionDialog";
import { getTaskStatusLabel } from "@/lib/tasks";

export const TelesaleWorkspace: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>({
    allTasks: [],
    todayTasks: [],
    overdueTasks: [],
    noAnswerTasks: [],
    interestedCustomers: [],
    needsHandoffCustomers: [],
    companyEvents: [],
    notifications: [],
    loading: true,
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // Task Actions
  const [taskAction, setTaskAction] = useState<{ task: any; action: string } | null>(null);

  // Drawer Preview
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);

  // Active Queue Dialog
  const [activeQueue, setActiveQueue] = useState<{
    title: string;
    items: any[];
    type: "task" | "customer";
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const [tasksRes, companyRes, notifsRes, customersRes] = await Promise.all([
        supabase
          .from("customer_tasks")
          .select("*, customer:customers(*)")
          .eq("assigned_to", user.id)
          .neq("status", "completed")
          .neq("status", "cancelled"),
        supabase.from("company_events").select("*").order("starts_at", { ascending: true }),
        supabase
          .from("notifications")
          .select("*")
          .eq("recipient_user_id", user.id)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("customers").select("*").eq("owner_tele_id", user.id).is("deleted_at", null),
      ]);

      const allTasks = tasksRes.data || [];
      const customers = customersRes.data || [];

      // Filter Cuộc gọi hôm nay
      const todayTasks = allTasks.filter((t: any) => {
        if (!t.due_at) return false;
        const dueTime = new Date(t.due_at).getTime();
        return (
          t.task_type === "call" &&
          dueTime >= startOfToday.getTime() &&
          dueTime <= endOfToday.getTime()
        );
      });

      // Filter Task quá hạn
      const overdueTasks = allTasks.filter((t: any) => {
        if (!t.due_at) return false;
        const dueTime = new Date(t.due_at).getTime();
        return dueTime < startOfToday.getTime();
      });

      // Filter Không nghe máy cần gọi lại
      const noAnswerTasks = allTasks.filter((t: any) => t.result === "no_answer");

      // Filter Khách quan tâm (hot / warm)
      const interestedCustomers = customers.filter(
        (c: any) => c.potential_level === "hot" || c.potential_level === "warm",
      );

      // Filter Cần chuyển Sale
      const needsHandoffCustomers = customers.filter(
        (c: any) =>
          (c.lifecycle_stage === "qualified" || c.care_model === "tele_qualified_then_sale") &&
          !c.owner_sale_id,
      );

      setData({
        allTasks,
        todayTasks,
        overdueTasks,
        noAnswerTasks,
        interestedCustomers,
        needsHandoffCustomers,
        companyEvents: companyRes.data || [],
        notifications: notifsRes.data || [],
        loading: false,
      });
    }
    fetchData();
  }, [user, refreshKey]);

  const handleRefresh = () => setRefreshKey((prev) => prev + 1);

  // Sort tasks for Priority Tasks
  const priorityTasks = [...data.allTasks].sort((a, b) => {
    // 1. Quá hạn lên đầu
    const overdueA = new Date(a.due_at).getTime() < new Date().getTime();
    const overdueB = new Date(b.due_at).getTime() < new Date().getTime();
    if (overdueA && !overdueB) return -1;
    if (!overdueA && overdueB) return 1;

    // 2. Priority urgent/high
    const prioOrder: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
    const scoreA = prioOrder[a.priority || "normal"] || 2;
    const scoreB = prioOrder[b.priority || "normal"] || 2;
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 3. Lead mới chưa gọi (task_type = 'call', customer.lifecycle_stage = 'new_lead')
    const isNewLeadA = a.task_type === "call" && a.customer?.lifecycle_stage === "new_lead";
    const isNewLeadB = b.task_type === "call" && b.customer?.lifecycle_stage === "new_lead";
    if (isNewLeadA && !isNewLeadB) return -1;
    if (!isNewLeadA && isNewLeadB) return 1;

    // 4. Follow-up hôm nay
    const isFollowUpA = a.task_type === "follow_up";
    const isFollowUpB = b.task_type === "follow_up";
    if (isFollowUpA && !isFollowUpB) return -1;
    if (!isFollowUpA && isFollowUpB) return 1;

    // 5. Check-in hôm nay
    const isCheckinA = a.task_type === "check_in" || a.task_type === "visit";
    const isCheckinB = b.task_type === "check_in" || b.task_type === "visit";
    if (isCheckinA && !isCheckinB) return -1;
    if (!isCheckinA && isCheckinB) return 1;

    // 6. Gần nhất lên đầu
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  const newLeadPriorities = data.customers
    .filter((c: any) => c.lifecycle_stage === "assigned")
    .map((c: any) => ({
      id: `new_lead_${c.id}`,
      task_type: "call",
      title: "Lead mới được giao",
      priority: "urgent",
      status: "pending",
      due_at: new Date().toISOString(),
      customer_id: c.id,
      customer: c,
      _is_new_lead_virtual_task: true,
    }));

  const combinedPriorityTasks = [...newLeadPriorities, ...priorityTasks];

  return (
    <WorkspaceShell
      title="Telesale Workspace"
      icon={<LayoutDashboard className="w-6 h-6" />}
      loading={data.loading}
    >
      {/* ACTIONS ROW */}
      <div className="flex justify-stretch sm:justify-end gap-3 mb-6">
        <Button
          size="sm"
          className="w-full sm:w-auto bg-slate-900 hover:bg-primary rounded-xl font-bold px-4"
          onClick={() => setIsAddCustomerOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" /> Thêm khách hàng
        </Button>
      </div>

      {/* ACTONABLE QUEUE CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {/* Card 1: Cuộc gọi hôm nay */}
        <div className="bg-white rounded-2xl border border-indigo-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <Phone className="w-20 h-20 text-indigo-600" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
              Cuộc gọi hôm nay
            </span>
            <div className="text-3xl font-black text-slate-900">{data.todayTasks.length}</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 mt-4 text-xs font-bold"
            onClick={() =>
              setActiveQueue({
                title: "Cuộc gọi chăm sóc hôm nay",
                items: data.todayTasks,
                type: "task",
              })
            }
          >
            Xem
          </Button>
        </div>

        {/* Card 2: Task quá hạn */}
        <div className="bg-white rounded-2xl border border-red-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <AlertCircle className="w-20 h-20 text-red-650" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">
              Task quá hạn
            </span>
            <div className="text-3xl font-black text-slate-900">{data.overdueTasks.length}</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-red-655 hover:text-red-700 hover:bg-red-50/50 mt-4 text-xs font-bold"
            onClick={() =>
              setActiveQueue({
                title: "Công việc đã quá hạn xử lý",
                items: data.overdueTasks,
                type: "task",
              })
            }
          >
            Xem
          </Button>
        </div>

        {/* Card 3: Không nghe máy cần gọi lại */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <PhoneOff className="w-20 h-20 text-slate-500" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Không nghe máy
            </span>
            <div className="text-3xl font-black text-slate-900">{data.noAnswerTasks.length}</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-slate-600 hover:text-slate-700 hover:bg-slate-50 mt-4 text-xs font-bold"
            onClick={() =>
              setActiveQueue({
                title: "Danh sách cuộc gọi không nhấc máy",
                items: data.noAnswerTasks,
                type: "task",
              })
            }
          >
            Xem
          </Button>
        </div>

        {/* Card 4: Khách quan tâm */}
        <div className="bg-white rounded-2xl border border-pink-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <Target className="w-20 h-20 text-pink-600" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-pink-600 uppercase tracking-widest">
              Khách quan tâm
            </span>
            <div className="text-3xl font-black text-slate-900">
              {data.interestedCustomers.length}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-pink-655 hover:text-pink-700 hover:bg-pink-50/50 mt-4 text-xs font-bold"
            onClick={() =>
              setActiveQueue({
                title: "Khách hàng quan tâm (HOT / WARM)",
                items: data.interestedCustomers,
                type: "customer",
              })
            }
          >
            Xem
          </Button>
        </div>

        {/* Card 5: Cần chuyển Sale */}
        <div className="bg-white rounded-2xl border border-amber-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <ArrowRight className="w-20 h-20 text-amber-500" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
              Cần chuyển Sale
            </span>
            <div className="text-3xl font-black text-slate-900">
              {data.needsHandoffCustomers.length}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-amber-655 hover:text-amber-750 hover:bg-amber-50/50 mt-4 text-xs font-bold"
            onClick={() =>
              setActiveQueue({
                title: "Khách hàng qualified cần bàn giao Sale",
                items: data.needsHandoffCustomers,
                type: "customer",
              })
            }
          >
            Xem
          </Button>
        </div>

        {/* Card 6: Thông báo mới */}
        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-200 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-115 transition-transform">
            <AlertCircle className="w-20 h-20 text-indigo-600" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
              Thông báo mới
            </span>
            <div className="text-3xl font-black text-indigo-900">
              {data.notifications.filter((n: any) => !n.read_at).length}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 mt-4 text-xs font-bold"
            onClick={() => {
              // Notification center will handle it
              toast.info("Vui lòng check hộp thư thông báo (Icon chuông ở góc trên)");
            }}
          >
            Mở hộp thư
          </Button>
        </div>
      </div>

      {/* PRIORITY TASKS SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs mb-8">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">
            Việc ưu tiên hôm nay
          </h3>
        </div>

        {combinedPriorityTasks.length > 0 ? (
          <div className="space-y-3">
            {combinedPriorityTasks.map((t: any) => {
              const isOverdue = new Date(t.due_at).getTime() < new Date().getTime();
              const isUrgent = t.priority === "urgent" || isOverdue;

              return (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${isUrgent ? "border-red-200 bg-red-50/40 hover:shadow-2xs" : "border-slate-150 bg-white hover:shadow-2xs"}`}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 leading-snug">
                        {t.title}
                      </span>
                      <Badge
                        className={`text-[9px] uppercase font-black tracking-wider ${
                          t.priority === "urgent"
                            ? "bg-red-655 text-white"
                            : t.priority === "high"
                              ? "bg-orange-500 text-white"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {t.priority || "NORMAL"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-bold px-1.5 py-0 border uppercase tracking-wider ${
                          t.status === "in_progress"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {getTaskStatusLabel(t.status)}
                      </Badge>
                      {isOverdue && (
                        <Badge className="bg-red-50 text-red-755 border border-red-200 text-[9px] font-black uppercase">
                          Quá hạn
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-450 font-bold">
                      {t.customer && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          🏢 {t.customer.business_name || t.customer.facility_name || t.customer.contact_name || t.customer.name || t.customer.facebook_display_name || "Spa tự do"} - 📞{" "}
                          {t.customer.phone || "Chưa cập nhật"}
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
                        className="h-8 text-[11px] font-black text-primary hover:bg-slate-100 px-2"
                      >
                        Mở khách
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTaskAction({ task: t, action: "completed" })}
                      className="h-8 text-[11px] font-black text-emerald-600 hover:bg-emerald-50 px-2"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Hoàn thành
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTaskAction({ task: t, action: "call_back_later" })}
                      className="h-8 text-[11px] font-black text-amber-600 hover:bg-amber-50 px-2"
                    >
                      <CalendarClock className="w-3.5 h-3.5 mr-1" /> Hẹn gọi lại
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 rounded-lg hover:bg-slate-105 border border-slate-200"
                        >
                          <MoreHorizontal className="w-4 h-4 text-slate-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => setTaskAction({ task: t, action: "start" })}
                        >
                          <Play className="w-3.5 h-3.5 mr-2 text-blue-500" /> Bắt đầu xử lý
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTaskAction({ task: t, action: "completed" })}
                        >
                          <Check className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Hoàn thành
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTaskAction({ task: t, action: "no_answer" })}
                        >
                          <PhoneOff className="w-3.5 h-3.5 mr-2 text-red-500" /> Không nghe máy
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTaskAction({ task: t, action: "wrong_number" })}
                        >
                          <UserX className="w-3.5 h-3.5 mr-2 text-slate-500" /> Sai số
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTaskAction({ task: t, action: "interested" })}
                        >
                          <Heart className="w-3.5 h-3.5 mr-2 text-pink-500" /> Khách quan tâm
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTaskAction({ task: t, action: "call_back_later" })}
                        >
                          <CalendarClock className="w-3.5 h-3.5 mr-2 text-amber-500" /> Hẹn gọi lại
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTaskAction({ task: t, action: "transfer_to_sale" })}
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-2 text-indigo-500" /> Cần chuyển
                          Sale
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
            <p className="text-xs text-slate-500 font-bold">Chưa có cuộc gọi nào cần thực hiện</p>
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
                {activeQueue.type === "task" &&
                  activeQueue.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-950 leading-snug">
                          {item.title}
                        </div>
                        {item.customer && (
                          <div className="text-[10px] text-slate-450 font-bold mt-1">
                            🏢 {item.customer.business_name || item.customer.facility_name || item.customer.contact_name || item.customer.name || item.customer.facebook_display_name || "Spa tự do"}
                          </div>
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

                {activeQueue.type === "customer" &&
                  activeQueue.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-950 leading-snug">
                          {item.name || item.contact_name}
                        </div>
                        <div className="text-[10px] text-slate-455 font-bold mt-1">
                          🏢 {item.facility_name || item.business_name || "Spa tự do"}
                        </div>
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
              </div>
            ) : (
              <div className="py-12 text-center">
                <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Không có dữ liệu trong hàng chờ này
                </p>
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
