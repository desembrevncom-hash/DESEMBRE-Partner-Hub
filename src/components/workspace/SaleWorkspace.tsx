import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getReclaimDeadlineLabel } from "@/lib/customerReclaimRules";
import { WorkspaceShell } from "./WorkspaceShell";
import { WorkspaceCalendarCard } from "./WorkspaceCalendarCard";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { useWorkspaceDashboard } from "@/hooks/useWorkspaceDashboard";
import { WorkspaceKpiCards } from "./WorkspaceKpiCards";
import { WorkspacePriorityList } from "./WorkspacePriorityList";
import { WorkspaceTimeline } from "./WorkspaceTimeline";
import { WorkspaceSmartAlerts } from "./WorkspaceSmartAlerts";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskActionDialog } from "./TaskActionDialog";
import { getTaskTypeLabel, getTaskStatusLabel } from "@/lib/tasks";

export const SaleWorkspace: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: dashData, loading: dashLoading } = useWorkspaceDashboard();
  
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
  const [previewCustomerAction, setPreviewCustomerAction] = useState<"note" | "task" | "followup" | "call" | null>(null);

  const handleOpenPreviewDrawer = (customerId: string, action?: "note" | "task" | "followup" | "call") => {
    setPreviewCustomerId(customerId);
    if (action) {
      setPreviewCustomerAction(action);
    } else {
      setPreviewCustomerAction(null);
    }
  };

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
  const atRiskCustomers = data.customers.filter((c: any) => c.ownership_status === 'at_risk');

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
    const isNewLeadA = a.task_type === 'call' && a.customer?.lifecycle_stage === 'new_lead';
    const isNewLeadB = b.task_type === 'call' && b.customer?.lifecycle_stage === 'new_lead';
    if (isNewLeadA && !isNewLeadB) return -1;
    if (!isNewLeadA && isNewLeadB) return 1;

    // 4. Follow-up hôm nay
    const isFollowUpA = a.task_type === 'follow_up';
    const isFollowUpB = b.task_type === 'follow_up';
    if (isFollowUpA && !isFollowUpB) return -1;
    if (!isFollowUpA && isFollowUpB) return 1;

    // 5. Check-in hôm nay
    const isCheckinA = a.task_type === 'check_in' || a.task_type === 'visit';
    const isCheckinB = b.task_type === 'check_in' || b.task_type === 'visit';
    if (isCheckinA && !isCheckinB) return -1;
    if (!isCheckinA && isCheckinB) return 1;

    // 6. Gần nhất lên đầu
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
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
          <Plus className="w-4 h-4 mr-2 text-primary" /> Thêm khách nhanh
        </Button>
      </div>

      <WorkspaceKpiCards counters={dashData?.counters} loading={dashLoading} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* CỘT TRÁI (2 phần) - Ưu tiên hôm nay & Lịch */}
        <div className="xl:col-span-2 space-y-8">
          <WorkspacePriorityList 
            priorities={dashData?.today_priorities || []}
            teamRisks={dashData?.team_risks}
            loading={dashLoading}
            onOpenCustomer={handleOpenPreviewDrawer}
          />

          <WorkspaceCalendarCard 
            events={[
              ...data.allTasks.map((t: any) => ({ ...t, _ui_type: 'task' })),
              ...data.allAppointments.map((a: any) => ({ ...a, _ui_type: 'personal' })),
              ...data.companyEvents.map((c: any) => ({ ...c, _ui_type: 'company' }))
            ]} 
            onRefresh={handleRefresh} 
          />
        </div>

        {/* CỘT PHẢI (1 phần) - Smart Alerts & Timeline */}
        <div className="space-y-8">
          <div className="h-[400px]">
            <WorkspaceTimeline 
              events={dashData?.upcoming_timeline || []} 
              loading={dashLoading} 
              onOpenCustomer={handleOpenPreviewDrawer}
            />
          </div>
          <div className="h-[350px]">
            <WorkspaceSmartAlerts 
              alerts={dashData?.smart_alerts} 
              loading={dashLoading} 
            />
          </div>
        </div>
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
        onOpenChange={(o) => {
          if (!o) {
            setPreviewCustomerId(null);
            setPreviewCustomerAction(null);
          }
        }}

        initialQuickAction={previewCustomerAction as any}
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
