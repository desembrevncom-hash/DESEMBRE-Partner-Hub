import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceShell } from "./WorkspaceShell";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { getStaffName } from "@/lib/customerOwnership";
import { 
  Users, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  LayoutDashboard,
  Plus,
  PhoneCall,
  Zap,
  Play,
  Check,
  PhoneOff,
  CalendarClock,
  User,
  Info,
  ChevronRight,
  TrendingUp,
  UserCheck,
  MoreHorizontal,
  UserX,
  Heart,
  ArrowRightLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
import { getTaskStatusLabel } from "@/lib/tasks";

export const TeleLeadWorkspace: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>({
    customers: [],
    unassignedLeads: [],
    overdueTasks: [],
    qualifiedLeads: [],
    todayActivities: [],
    notifications: [],
    telesaleStaff: [],
    allTeamTasks: [],
    loading: true
  });
  const [isAssigning, setIsAssigning] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // Task Actions
  const [taskAction, setTaskAction] = useState<{ task: any; action: string } | null>(null);

  // Drawer Preview
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);

  // Active Queue Dialog
  const [activeQueue, setActiveQueue] = useState<{ title: string; items: any[]; type: 'unassigned' | 'task' | 'customer' | 'activities' } | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      
      const [customersRes, unassignedRes, overdueRes, companyRes, notifsRes, staffRolesRes, activitiesRes, teamTasksRes] = await Promise.all([
        supabase.from("customers").select("*").eq("owner_tele_id", user.id).is("deleted_at", null),
        supabase.from("customers").select("*").is("owner_tele_id", null).eq("lifecycle_stage", "new_lead").is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("customer_tasks").select("*, customer:customers(*)").lt("due_at", new Date().toISOString()).neq("status", "completed"),
        supabase.from("company_events").select("*").order("starts_at", { ascending: true }),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("user_roles").select("user_id").eq("role", "telesale"),
        supabase.from("customer_activities").select("*, customer:customers(*)").gte("created_at", startOfToday.toISOString()),
        supabase.from("customer_tasks").select("*, customer:customers(*)").neq("status", "completed").neq("status", "cancelled")
      ]);

      let staffList: any[] = [];
      if (staffRolesRes.data && staffRolesRes.data.length > 0) {
        const ids = staffRolesRes.data.map(r => r.user_id);
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
        staffList = profiles || [];
      }

      const { data: qualifiedRes } = await supabase
        .from("customers")
        .select("*")
        .eq("lifecycle_stage", "qualified")
        .is("owner_sale_id", null)
        .is("deleted_at", null);

      setData({
        customers: customersRes.data || [],
        unassignedLeads: unassignedRes.data || [],
        overdueTasks: overdueRes.data || [],
        qualifiedLeads: qualifiedRes || [],
        todayActivities: activitiesRes.data || [],
        companyEvents: companyRes.data || [],
        notifications: notifsRes.data || [],
        telesaleStaff: staffList,
        allTeamTasks: teamTasksRes.data || [],
        loading: false
      });
    }
    fetchData();
  }, [user, refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleAssign = async (leadId: string, leadName: string, staffId: string, staffName: string) => {
    setIsAssigning(true);
    try {
      const { error: updateError } = await supabase
        .from("customers")
        .update({ owner_tele_id: staffId, lifecycle_stage: 'assigned' })
        .eq("id", leadId);

      if (updateError) throw updateError;

      await supabase.from("notifications").insert({
        recipient_user_id: staffId,
        customer_id: leadId,
        title: "Lead mới được gán",
        message: `Bạn vừa được gán lead mới: ${leadName}`,
        type: "lead_assigned"
      });

      toast.success(`Đã gán ${leadName} cho ${staffName}`);
      handleRefresh();
      
      if (activeQueue) {
        setActiveQueue(prev => {
          if (!prev) return null;
          return {
            ...prev,
            items: prev.items.filter(item => item.id !== leadId)
          };
        });
      }
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  // Sort tasks for Priority Tasks
  const priorityTasks = [...data.allTeamTasks].sort((a, b) => {
    const overdueA = new Date(a.due_at).getTime() < new Date().getTime();
    const overdueB = new Date(b.due_at).getTime() < new Date().getTime();
    if (overdueA && !overdueB) return -1;
    if (!overdueA && overdueB) return 1;

    const prioOrder: Record<string, number> = { urgent: 3, high: 2, normal: 1, low: 0 };
    const scoreA = prioOrder[a.priority || "normal"] || 1;
    const scoreB = prioOrder[b.priority || "normal"] || 1;
    return scoreB - scoreA;
  });

  return (
    <WorkspaceShell title="Tele Lead Workspace" icon={<LayoutDashboard className="w-6 h-6" />} loading={data.loading}>
      
      {/* ACTIONS ROW */}
      <div className="flex justify-end gap-3 mb-6">
        <Button 
          size="sm" 
          className="bg-slate-900 hover:bg-primary rounded-xl font-bold px-4"
          onClick={() => setIsAddCustomerOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" /> Thêm khách hàng
        </Button>
      </div>

      {/* ACTONABLE QUEUE CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        
        {/* Card 1: Task team chưa chia */}
        <div className="bg-white rounded-2xl border border-orange-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <Users className="w-20 h-20 text-orange-500" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Leads chưa chia</span>
            <div className="text-3xl font-black text-slate-900">{data.unassignedLeads.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50/50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Leads mới chưa phân công Telesale", items: data.unassignedLeads, type: 'unassigned' })}
          >
            Xem
          </Button>
        </div>

        {/* Card 2: Task team quá hạn */}
        <div className="bg-white rounded-2xl border border-red-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <Clock className="w-20 h-20 text-red-650" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Team task quá hạn</span>
            <div className="text-3xl font-black text-slate-900">{data.overdueTasks.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-red-655 hover:text-red-700 hover:bg-red-50/50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Danh sách công việc trễ hạn của Team", items: data.overdueTasks, type: 'task' })}
          >
            Xem
          </Button>
        </div>

        {/* Card 3: Khách Tele cần chăm */}
        <div className="bg-white rounded-2xl border border-indigo-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <PhoneCall className="w-20 h-20 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Khách cần chăm</span>
            <div className="text-3xl font-black text-slate-900">{data.customers.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-indigo-650 hover:text-indigo-750 hover:bg-indigo-50/50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Khách hàng Tele phụ trách trực tiếp", items: data.customers, type: 'customer' })}
          >
            Xem
          </Button>
        </div>

        {/* Card 4: Khách qualified cần chuyển Sale */}
        <div className="bg-white rounded-2xl border border-emerald-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <UserCheck className="w-20 h-20 text-emerald-650" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Chờ chuyển Sale</span>
            <div className="text-3xl font-black text-slate-900">{data.qualifiedLeads.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-emerald-650 hover:text-emerald-755 hover:bg-emerald-50/50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Khách hàng đạt chất lượng (Qualified) chưa gán Sale", items: data.qualifiedLeads, type: 'customer' })}
          >
            Xem
          </Button>
        </div>

        {/* Card 5: Hiệu suất Telesale hôm nay */}
        <div className="bg-white rounded-2xl border border-pink-100 p-4 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-115 transition-transform">
            <TrendingUp className="w-20 h-20 text-pink-600" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-pink-600 uppercase tracking-widest">Hoạt động hôm nay</span>
            <div className="text-3xl font-black text-slate-900">{data.todayActivities.length}</div>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full text-pink-655 hover:text-pink-700 hover:bg-pink-50/50 mt-4 text-xs font-bold"
            onClick={() => setActiveQueue({ title: "Lịch sử hoạt động Telesale trong ngày", items: data.todayActivities, type: 'activities' })}
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
                        t.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {getTaskStatusLabel(t.status)}
                      </Badge>
                      {isOverdue && <Badge className="bg-red-55 text-red-755 border border-red-200 text-[9px] font-black uppercase">Quá hạn</Badge>}
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
            <p className="text-xs text-slate-500 font-bold">Chưa có công việc nào trong danh sách ưu tiên</p>
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
              <div className="space-y-3">
                
                {/* Case: unassigned leads */}
                {activeQueue.type === 'unassigned' && activeQueue.items.map((lead) => (
                  <div key={lead.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-black text-slate-900">{lead.facility_name || lead.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{lead.city || "Toàn quốc"}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setActiveQueue(null);
                          setPreviewCustomerId(lead.id);
                        }}
                        className="h-7 text-[10px] font-bold text-primary hover:bg-slate-100"
                      >
                        Hồ sơ nhanh
                      </Button>
                    </div>
                    
                    <select 
                      className="h-8 rounded-lg border-slate-200 text-[10px] font-black uppercase px-2 w-full outline-none bg-white"
                      onChange={(e) => {
                        const staff = data.telesaleStaff.find((s: any) => s.id === e.target.value);
                        if (staff) handleAssign(lead.id, lead.facility_name || lead.name, staff.id, staff.full_name || staff.email);
                      }}
                      disabled={isAssigning}
                    >
                      <option value="">Chọn Telesale để gán...</option>
                      {data.telesaleStaff.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {/* Case: task */}
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

                {/* Case: customer */}
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

                {/* Case: activities */}
                {activeQueue.type === 'activities' && activeQueue.items.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-slate-800">{item.title}</span>
                      <span className="text-[9px] text-slate-400 font-bold">{format(new Date(item.created_at), "HH:mm dd/MM", { locale: vi })}</span>
                    </div>
                    {item.content && <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{item.content}</p>}
                    {item.customer && (
                      <div className="text-[9px] font-bold text-slate-400">Khách hàng: {item.customer.name}</div>
                    )}
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
