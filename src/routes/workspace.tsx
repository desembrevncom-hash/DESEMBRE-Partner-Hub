import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Phone, 
  Target, 
  Calendar,
  Users,
  LayoutDashboard,
  Loader2,
  ChevronRight,
  TrendingUp,
  Zap,
  Bell,
  Sparkles,
  ArrowUpRight,
  CalendarDays,
  ListTodo,
  Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  getTaskTypeLabel, 
  isTaskOverdue 
} from "@/lib/tasks";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { SALES_PIPELINE_STAGES } from "@/lib/salesPipeline";
import { toast } from "sonner";
import { createLeadAssignedAutomation } from "@/lib/automation";

export const Route = createFileRoute("/workspace")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { user, isSale, isTeleLead, isAdmin, isSubAdmin } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      
      try {
        // 1. Fetch Tasks
        const tasksQuery = supabase
          .from("customer_tasks")
          .select(`
            *,
            customer:customers(name, facility_name, phone),
            lead:leads(name, facility_name, phone)
          `)
          .order("due_at", { ascending: true });
        
        // 2. Fetch Customers (for Pipeline & Stats)
        const customersQuery = supabase
          .from("customers")
          .select("*")
          .is("deleted_at", null);

        // 3. Fetch Notifications
        const notificationsQuery = supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        // 4. Fetch Calendar Events (Try-catch per table to prevent global crash)
        const [tasksRes, customersRes, notificationsRes] = await Promise.all([
          tasksQuery,
          customersQuery,
          notificationsQuery
        ]);

        if (tasksRes.data) setTasks(tasksRes.data);
        
        // Role-based customer filtering
        if (customersRes.data) {
          let filteredCustomers = customersRes.data;
          if (isSale) {
            filteredCustomers = filteredCustomers.filter(c => c.owner_sale_id === user.id);
          } else if (isTeleLead) {
            filteredCustomers = filteredCustomers.filter(c => c.owner_tele_id === user.id);
          }
          setCustomers(filteredCustomers);
        }

        if (notificationsRes.data) setNotifications(notificationsRes.data);

        // Separate fetch for events because the table might not exist yet
        try {
          const { data: eventsData } = await supabase
            .from("calendar_events" as any)
            .select("*")
            .or(`assigned_sale_id.eq.${user.id},created_by.eq.${user.id}`)
            .order("starts_at", { ascending: true });
          if (eventsData) setEvents(eventsData);
        } catch (e) {
          console.log("Calendar events table might be missing or inaccessible", e);
        }

      } catch (error) {
        console.error("Workspace Data Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, isSale, isTeleLead]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-widest">Đang khởi tạo CRM OS...</p>
        </div>
      </div>
    );
  }

  const commonProps = { tasks, customers, notifications, events };

  if (isAdmin || isSubAdmin) return <ManagerWorkspace {...commonProps} />;
  if (isTeleLead) return <TeleLeadWorkspace {...commonProps} />;
  if (isSale) return <SaleWorkspace {...commonProps} />;
  
  return <TelesaleWorkspace {...commonProps} />;
}

// --- SHARED UI COMPONENTS ---

function KpiCard({ title, value, subValue, icon: Icon, color, trend }: { 
  title: string; 
  value: string | number; 
  subValue?: string;
  icon: any; 
  color: string;
  trend?: string;
}) {
  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden group">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900">{value}</h3>
            {trend && <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />{trend}</span>}
          </div>
          {subValue && <p className="text-[11px] text-slate-500 font-medium mt-1">{subValue}</p>}
        </div>
        <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-black/5`}>
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionBlock({ title, icon: Icon, children, badge, action }: { title: string; icon: any; children: React.ReactNode; badge?: number; action?: React.ReactNode }) {
  return (
    <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden flex flex-col h-full bg-white/50 backdrop-blur-sm">
      <CardHeader className="py-4 px-5 border-b border-slate-100/50 flex flex-row items-center justify-between space-y-0 bg-slate-50/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-600 border border-slate-100">
            <Icon className="w-4 h-4" />
          </div>
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            {title}
            {badge !== undefined && badge > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0 border-none">
                {badge}
              </Badge>
            )}
          </CardTitle>
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto max-h-[400px]">
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description, icon: Icon = ListTodo }: { title: string; description: string; icon?: any }) {
  return (
    <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-3 border border-slate-100">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
      <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">{description}</p>
    </div>
  );
}

function WorkspaceLayout({ role, icon: Icon, children }: { role: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
      <header className="bg-white/90 border-b border-slate-200/60 sticky top-0 z-10 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center text-white">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight">{role}</h1>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-2 h-2" /> CRM Operating System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              {format(new Date(), "eeee, dd MMMM yyyy", { locale: vi })}
            </div>
            <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-slate-100 transition-all">
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
}

// --- ROLE WORKSPACES ---

function SaleWorkspace({ tasks, customers, notifications, events }: { tasks: any[]; customers: any[]; notifications: any[]; events: any[] }) {
  const urgentTasks = tasks.filter(t => t.status === 'pending' && isTaskOverdue(t.due_at, t.status));
  const todayAppointments = tasks.filter(t => t.status === 'pending' && t.due_at && format(new Date(t.due_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'));

  return (
    <WorkspaceLayout role="Sale Workspace" icon={Target}>
      <div className="space-y-6">
        {/* KPI Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Khách hàng quản lý" value={customers.length} subValue="Nguồn lực đang chăm sóc" icon={Users} color="bg-primary text-white" />
          <KpiCard title="Deal trong Pipeline" value={customers.filter(c => c.lifecycle_stage && !['ordered', 'inactive', 'lost'].includes(c.lifecycle_stage)).length} subValue="Đang tiến triển" icon={Zap} color="bg-blue-500 text-white" />
          <KpiCard title="Lịch hẹn hôm nay" value={todayAppointments.length} subValue="Ưu tiên follow-up" icon={CalendarDays} color="bg-amber-500 text-white" />
          <KpiCard title="Task quá hạn" value={urgentTasks.length} subValue="Cần xử lý ngay" icon={AlertCircle} color="bg-red-500 text-white" />
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionBlock title="Việc ưu tiên & Quá hạn" icon={Clock} badge={urgentTasks.length}>
              {urgentTasks.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {urgentTasks.map(task => (
                    <div key={task.id} className="p-4 hover:bg-slate-50 transition-all flex items-center justify-between group">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 shrink-0 border border-red-100/50">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">{task.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{task.customer?.facility_name || task.lead?.facility_name || "Khách tự do"}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg">Xử lý ngay</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sạch bóng Task" description="Bạn đã xử lý hết các việc quan trọng. Tuyệt vời!" icon={CheckCircle2} />
              )}
            </SectionBlock>

            <SectionBlock title="Lịch hẹn & Follow-up hôm nay" icon={CalendarDays} badge={todayAppointments.length}>
              {todayAppointments.length > 0 ? (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {todayAppointments.map(task => (
                    <div key={task.id} className="p-3 bg-white border border-slate-200/60 rounded-xl shadow-sm hover:border-primary/30 transition-all group">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded uppercase border border-primary/10">{format(new Date(task.due_at), "HH:mm")}</span>
                         <Badge variant="outline" className="text-[9px] font-bold">{getTaskTypeLabel(task.task_type)}</Badge>
                       </div>
                       <p className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-primary transition-colors">{task.customer?.facility_name || task.lead?.facility_name}</p>
                       <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{task.title}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Chưa có lịch hẹn" description="Hôm nay bạn chưa có lịch hẹn nào được set." icon={Calendar} />
              )}
            </SectionBlock>
          </div>

          <div className="space-y-6">
            <SectionBlock title="Tiến độ Pipeline" icon={TrendingUp}>
               <div className="p-5 space-y-4">
                  {SALES_PIPELINE_STAGES.slice(0, 7).map(stage => {
                    const count = customers.filter(c => c.lifecycle_stage === stage.value).length;
                    const percentage = customers.length > 0 ? (count / customers.length) * 100 : 0;
                    return (
                      <div key={stage.value} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-600">{stage.label}</span>
                          <span className="text-primary">{count} Deal</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-primary transition-all duration-700`} 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  <Button asChild variant="outline" className="w-full h-9 text-xs font-bold border-slate-200 mt-2 hover:bg-slate-50 rounded-xl">
                    <Link to="/customers">Xem đầy đủ Pipeline <ChevronRight className="ml-1 w-3.5 h-3.5" /></Link>
                  </Button>
               </div>
            </SectionBlock>

            <SectionBlock title="Thông báo mới" icon={Bell} badge={notifications.length}>
               {notifications.length > 0 ? (
                 <div className="divide-y divide-slate-100">
                   {notifications.map(n => (
                     <div key={n.id} className="p-4 hover:bg-slate-50/50 transition-all cursor-pointer group">
                       <p className="text-xs font-bold text-slate-800 group-hover:text-primary transition-colors">{n.title}</p>
                       <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                       <p className="text-[9px] text-slate-400 mt-2 font-medium">{format(new Date(n.created_at), "HH:mm · dd/MM")}</p>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="p-4">
                    <EmptyState title="Tạm thời yên tĩnh" description="Bạn sẽ nhận được thông báo khi có lead mới hoặc hoạt động từ khách hàng." icon={Sparkles} />
                 </div>
               )}
            </SectionBlock>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

function TelesaleWorkspace({ tasks, customers, notifications }: { tasks: any[]; customers: any[]; notifications: any[] }) {
  const todayCalls = tasks.filter(t => t.status === 'pending' && t.task_type === 'call');
  const overdueTasks = tasks.filter(t => isTaskOverdue(t.due_at, t.status));

  return (
    <WorkspaceLayout role="Telesale Operating System" icon={Phone}>
      <div className="space-y-6">
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Cuộc gọi hôm nay" value={todayCalls.length} subValue="Ưu tiên xử lý ngay" icon={Phone} color="bg-indigo-500 text-white" />
          <KpiCard title="Khách đang chăm" value={customers.length} subValue="Nguồn lực Tele quản lý" icon={Users} color="bg-emerald-500 text-white" />
          <KpiCard title="Thông báo mới" value={notifications.length} subValue="Tin nhắn hệ thống" icon={Bell} color="bg-amber-500 text-white" />
          <KpiCard title="Task quá hạn" value={overdueTasks.length} subValue="Cần hoàn thành ngay" icon={AlertCircle} color="bg-red-500 text-white" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2">
              <SectionBlock title="Danh sách Lead cần gọi ngay" icon={Phone} badge={todayCalls.length}>
                 {todayCalls.length > 0 ? (
                   <div className="divide-y divide-slate-100">
                     {todayCalls.map(task => (
                       <div key={task.id} className="p-4 hover:bg-slate-50 transition-all flex items-center justify-between group">
                         <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100">
                              <Phone className="w-4 h-4" />
                            </div>
                            <div>
                               <p className="text-sm font-bold text-slate-800">{task.lead?.name || task.customer?.name}</p>
                               <p className="text-[11px] text-slate-500 font-medium">{task.lead?.facility_name || task.customer?.facility_name}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">{format(new Date(task.due_at), "HH:mm")}</p>
                            <Button size="sm" className="h-7 text-[10px] font-bold rounded-lg px-3">Bắt đầu gọi</Button>
                         </div>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <EmptyState title="Sạch Lead" description="Lead mới sẽ xuất hiện ở đây sau khi được trưởng phòng phân phối." icon={Users} />
                 )}
              </SectionBlock>
           </div>
           <div className="space-y-6">
              <SectionBlock title="Thông báo hệ thống" icon={Bell} badge={notifications.length}>
                 {notifications.length > 0 ? (
                   <div className="divide-y divide-slate-100">
                     {notifications.map(n => (
                       <div key={n.id} className="p-4 hover:bg-slate-50 transition-all cursor-pointer">
                         <p className="text-xs font-bold text-slate-800">{n.title}</p>
                         <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <EmptyState title="Không có thông báo" description="Mọi thứ đang hoạt động bình thường." />
                 )}
              </SectionBlock>
              <SectionBlock title="Tiến độ cá nhân" icon={TrendingUp}>
                 <div className="p-6 text-center">
                    <TrendingUp className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">"Mỗi cuộc gọi là một cơ hội kinh doanh."</p>
                 </div>
              </SectionBlock>
           </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

function TeleLeadWorkspace({ tasks, customers, notifications }: { tasks: any[]; customers: any[]; notifications: any[] }) {
  const [telesaleStaff, setTelesaleStaff] = useState<any[]>([]);
  const [unassignedLeads, setUnassignedLeads] = useState<any[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    async function fetchTeleData() {
      // 1. Fetch Telesale Staff from user_roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "telesale");
        
      if (userRoles && userRoles.length > 0) {
        const userIds = userRoles.map((r: any) => r.user_id);
        const { data: staff } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);
        if (staff) setTelesaleStaff(staff);
      } else {
        setTelesaleStaff([]);
      }

      // 2. Fetch Unassigned Leads (from customer_tasks or customers table depending on flow)
      // For now, we query customers that have no owner_tele_id
      const { data: leads } = await supabase
        .from("customers")
        .select("*")
        .is("owner_tele_id", null)
        .eq("lifecycle_stage", "new_lead")
        .order("created_at", { ascending: false });
      if (leads) setUnassignedLeads(leads);
    }
    fetchTeleData();
  }, []);

  const handleAssign = async (leadId: string, leadName: string, staffId: string, staffName: string) => {
    setIsAssigning(true);
    try {
      // 1. Update Customer Owner
      const { error: updateError } = await supabase
        .from("customers")
        .update({ owner_tele_id: staffId, lifecycle_stage: 'assigned' })
        .eq("id", leadId);

      if (updateError) throw updateError;

      // 2. Trigger Automation (Task & Notification)
      await createLeadAssignedAutomation(leadId, leadName, staffId, "Trưởng phòng Tele");

      toast.success(`Đã giao Lead ${leadName} cho ${staffName}`);
      
      // 3. Update local state
      setUnassignedLeads(prev => prev.filter(l => l.id !== leadId));
    } catch (error) {
      console.error("Assignment Error:", error);
      toast.error("Lỗi khi phân phối Lead");
    } finally {
      setIsAssigning(false);
    }
  };

  const overdueTasks = tasks.filter(t => isTaskOverdue(t.due_at, t.status));

  return (
    <WorkspaceLayout role="Trạm Điều Phối Tele Lead" icon={Users}>
       <div className="space-y-6">
         {/* KPI Cards */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Lead chưa chia" value={unassignedLeads.length} subValue="Cần phân bổ ngay" icon={AlertCircle} color="bg-orange-500 text-white" />
          <KpiCard title="Nhân sự Online" value={telesaleStaff.length} subValue="Đang sẵn sàng nhận việc" icon={Users} color="bg-blue-500 text-white" />
          <KpiCard title="Lead gán hôm nay" value={customers.filter(c => c.owner_tele_id && format(new Date(c.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length} trend="+5" icon={Zap} color="bg-emerald-500 text-white" />
          <KpiCard title="Task team quá hạn" value={overdueTasks.length} subValue="Cần nhắc nhở nhân viên" icon={Clock} color="bg-red-500 text-white" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* LEAD QUEUE */}
           <div className="lg:col-span-2">
              <SectionBlock title="Hàng đợi phân phối Lead" icon={Zap} badge={unassignedLeads.length}>
                 {unassignedLeads.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {unassignedLeads.map(lead => (
                        <div key={lead.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all group">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 border border-orange-100 shadow-sm">
                                <Zap className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-800">{lead.facility_name || lead.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                   <span className="text-[10px] font-bold text-slate-400 uppercase">{lead.city || "Toàn quốc"}</span>
                                   <span className="text-slate-200">•</span>
                                   <span className="text-[10px] font-bold text-primary">{format(new Date(lead.created_at), "HH:mm")}</span>
                                </div>
                              </div>
                           </div>
                           
                           {/* Assign Action */}
                           <div className="flex items-center gap-2">
                              <select 
                                className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2 h-8 outline-none focus:ring-2 focus:ring-primary/20"
                                onChange={(e) => {
                                   const staff = telesaleStaff.find(s => s.id === e.target.value);
                                   if (staff) handleAssign(lead.id, lead.facility_name || lead.name, staff.id, staff.full_name || staff.email);
                                }}
                                defaultValue=""
                                disabled={isAssigning}
                              >
                                 <option value="" disabled>Chọn nhân viên...</option>
                                 {telesaleStaff.map(s => (
                                    <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                                 ))}
                              </select>
                              <Button size="sm" className="h-8 rounded-lg bg-slate-900 hover:bg-black text-[10px] font-bold">Chia nhanh</Button>
                           </div>
                        </div>
                      ))}
                    </div>
                 ) : (
                   <div className="py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-4 border border-slate-100">
                         <Sparkles className="w-8 h-8" />
                      </div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Tuyệt vời! Sạch hàng đợi</h3>
                      <p className="text-[10px] text-slate-400 mt-2">Mọi Lead mới đều đã được phân bổ cho team Telesale.</p>
                   </div>
                 )}
              </SectionBlock>
           </div>

           {/* STAFF MONITORING */}
           <div className="space-y-6">
              <SectionBlock title="Trạng thái xử lý của Team" icon={Users}>
                 <div className="p-4 space-y-4">
                    {telesaleStaff.length > 0 ? (
                       telesaleStaff.map(staff => {
                          const staffLeads = customers.filter(c => c.owner_tele_id === staff.id);
                          const pendingTasks = tasks.filter(t => t.assigned_to === staff.id && t.status === 'pending');
                          return (
                             <div key={staff.id} className="p-3 bg-white border border-slate-100 rounded-xl hover:border-primary/20 transition-all">
                                <div className="flex items-center justify-between mb-3">
                                   <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100">
                                         {(staff.full_name || "S").slice(0, 1)}
                                      </div>
                                      <div>
                                         <p className="text-[11px] font-bold text-slate-800 line-clamp-1">{staff.full_name || staff.email}</p>
                                         <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Đang Online</span>
                                         </div>
                                      </div>
                                   </div>
                                   <Badge className="bg-slate-50 text-slate-500 border-none text-[9px] font-black">{staffLeads.length} LEADS</Badge>
                                </div>
                                <div className="space-y-1.5">
                                   <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
                                      <span>Task chờ xử lý</span>
                                      <span className={pendingTasks.length > 5 ? 'text-red-500' : 'text-primary'}>{pendingTasks.length} việc</span>
                                   </div>
                                   <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                      <div 
                                         className={`h-full transition-all duration-500 ${pendingTasks.length > 5 ? 'bg-red-500' : 'bg-primary'}`}
                                         style={{ width: `${Math.min((pendingTasks.length / 10) * 100, 100)}%` }}
                                      ></div>
                                   </div>
                                </div>
                             </div>
                          );
                       })
                    ) : (
                       <EmptyState title="Chưa có nhân sự" description="Danh sách nhân viên Telesale sẽ hiển thị tại đây." />
                    )}
                 </div>
              </SectionBlock>

              <SectionBlock title="Feed hoạt động Lead" icon={Activity} badge={notifications.length}>
                 <div className="divide-y divide-slate-100">
                    {notifications.slice(0, 5).map(n => (
                      <div key={n.id} className="p-4">
                        <p className="text-[11px] font-bold text-slate-700">{n.title}</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                        <p className="text-[9px] text-slate-400 mt-2 font-medium">{format(new Date(n.created_at), "HH:mm")}</p>
                      </div>
                    ))}
                 </div>
              </SectionBlock>
           </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

function ManagerWorkspace({ tasks, customers, notifications }: { tasks: any[]; customers: any[]; notifications: any[] }) {
  const allOverdue = tasks.filter(t => isTaskOverdue(t.due_at, t.status));

  return (
    <WorkspaceLayout role="Admin Control Center" icon={LayoutDashboard}>
       <div className="space-y-6">
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Tổng doanh thu tháng" value="2.4B" trend="+15%" icon={TrendingUp} color="bg-slate-900 text-white" />
          <KpiCard title="Tổng Lead mới" value="128" trend="+20" icon={Zap} color="bg-blue-600 text-white" />
          <KpiCard title="Khách đang chăm" value={customers.length} icon={Users} color="bg-indigo-600 text-white" />
          <KpiCard title="Cảnh báo hệ thống" value={allOverdue.length} icon={AlertCircle} color="bg-red-600 text-white" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2">
              <SectionBlock title="Tổng quan Pipeline hệ thống" icon={Target}>
                 <div className="p-10 text-center text-slate-300">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-5" />
                    <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-30">BIỂU ĐỒ TĂNG TRƯỞNG DƯỢC MỸ PHẨM DESEMBRE</p>
                    <p className="text-[10px] mt-2 italic">Dữ liệu phân tích đang được tổng hợp...</p>
                 </div>
              </SectionBlock>
           </div>
           <div className="space-y-6">
              <SectionBlock title="Nhật ký hệ thống" icon={Sparkles}>
                 {notifications.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {notifications.map(n => (
                        <div key={n.id} className="p-4">
                           <p className="text-xs font-bold text-slate-800">{n.title}</p>
                           <p className="text-[10px] text-slate-500 mt-1">{n.message}</p>
                        </div>
                      ))}
                    </div>
                 ) : (
                   <EmptyState title="Chưa có log" description="Mọi hoạt động quản trị sẽ được ghi lại tại đây." />
                 )}
              </SectionBlock>
           </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

// Icon fallback for Activity
function Activity(props: any) {
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}
