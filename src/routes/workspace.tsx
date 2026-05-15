import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Phone, 
  UserCheck, 
  FileText, 
  Target, 
  Calendar,
  Users,
  LayoutDashboard,
  Loader2,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  getTaskTypeLabel, 
  getTaskStatusLabel, 
  getTaskPriorityLabel, 
  isTaskOverdue 
} from "@/lib/tasks";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export const Route = createFileRoute("/workspace")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { user, isSale, isTeleLead, isAdmin, isSubAdmin } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Giả định role Telesale dựa trên role tele_lead nếu chưa có role riêng biệt rõ ràng trong useAuth
  // Hoặc dùng isTeleLead làm đại diện cho Tele workflow
  const isTelesale = !isSale && !isAdmin && !isSubAdmin; 

  useEffect(() => {
    async function fetchTasks() {
      if (!user) return;
      setLoading(true);
      
      const { data, error } = await supabase
        .from("customer_tasks")
        .select(`
          *,
          customer:customers(name, facility_name, phone),
          lead:leads(name, facility_name, phone)
        `)
        .order("due_at", { ascending: true });

      if (error) {
        console.error("Error fetching tasks:", error);
      } else {
        setTasks(data || []);
      }
      setLoading(false);
    }
    fetchTasks();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (isAdmin || isSubAdmin) return <ManagerWorkspace tasks={tasks} />;
  if (isTeleLead) return <TeleLeadWorkspace tasks={tasks} />;
  if (isSale) return <SaleWorkspace tasks={tasks} />;
  
  return <TelesaleWorkspace tasks={tasks} />;
}

// --- SUB-COMPONENTS FOR EACH ROLE ---

function TaskList({ title, tasks, icon: Icon, color }: { title: string; tasks: any[]; icon: any; color: string }) {
  return (
    <Card className="border-slate-200/60 shadow-sm overflow-hidden hover:shadow-md transition-all rounded-2xl">
      <CardHeader className={`${color} py-4 px-5 border-b border-white/10`}>
        <CardTitle className="text-sm font-black flex items-center gap-2 text-white uppercase tracking-wider">
          <Icon className="w-4 h-4" />
          {title}
          <Badge variant="secondary" className="ml-auto bg-white/20 text-white border-none text-[10px]">
            {tasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {tasks.length > 0 ? (
            tasks.map(task => (
              <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">
                      {task.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      {task.customer?.facility_name || task.lead?.facility_name || "Khách hàng tự do"} 
                      <span className="mx-1.5 opacity-30">|</span>
                      {task.customer?.name || task.lead?.name || "N/A"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary mt-1" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-200">
                      {getTaskTypeLabel(task.task_type)}
                    </Badge>
                    {isTaskOverdue(task.due_at, task.status) && (
                      <Badge className="bg-red-50 text-red-600 border-red-100 text-[9px] font-bold">Quá hạn</Badge>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {task.due_at ? format(new Date(task.due_at), "HH:mm · dd/MM", { locale: vi }) : "N/A"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Không có công việc</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkspaceLayout({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <header className="bg-white border-b border-slate-200/60 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Icon className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">{title}</h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
            <Calendar className="w-4 h-4" />
            {format(new Date(), "eeee, dd MMMM yyyy", { locale: vi })}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function SaleWorkspace({ tasks }: { tasks: any[] }) {
  const needsCall = tasks.filter(t => t.status === 'pending' && t.task_type === 'call');
  const followUpToday = tasks.filter(t => t.status === 'pending' && t.due_at && format(new Date(t.due_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'));
  const checkIn = tasks.filter(t => t.task_type === 'visit');
  const quotations = tasks.filter(t => t.task_type === 'quotation' && t.status !== 'completed');

  return (
    <WorkspaceLayout title="Sale Workspace" icon={Target}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <TaskList title="Lead/Task cần gọi" tasks={needsCall} icon={Phone} color="bg-blue-600" />
        <TaskList title="Follow-up hôm nay" tasks={followUpToday} icon={Clock} color="bg-amber-500" />
        <TaskList title="Khách cần check-in" tasks={checkIn} icon={UserCheck} color="bg-emerald-600" />
        <TaskList title="Báo giá chưa chốt" tasks={quotations} icon={FileText} color="bg-slate-800" />
      </div>
    </WorkspaceLayout>
  );
}

function TelesaleWorkspace({ tasks }: { tasks: any[] }) {
  const todayCalls = tasks.filter(t => t.status === 'pending' && t.task_type === 'call');
  const overdue = tasks.filter(t => isTaskOverdue(t.due_at, t.status));
  const interested = tasks.filter(t => t.priority === 'high' || t.priority === 'urgent');
  const handoff = tasks.filter(t => t.task_type === 'onboarding' && t.status !== 'completed');

  return (
    <WorkspaceLayout title="Telesale Workspace" icon={Phone}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <TaskList title="Cuộc gọi hôm nay" tasks={todayCalls} icon={Phone} color="bg-indigo-600" />
        <TaskList title="Task quá hạn" tasks={overdue} icon={AlertCircle} color="bg-red-600" />
        <TaskList title="Khách quan tâm (VIP)" tasks={interested} icon={Target} color="bg-pink-600" />
        <TaskList title="Cần chuyển Sale" tasks={handoff} icon={ChevronRight} color="bg-slate-700" />
      </div>
    </WorkspaceLayout>
  );
}

function TeleLeadWorkspace({ tasks }: { tasks: any[] }) {
  const unassigned = tasks.filter(t => !t.assigned_to);
  const teamOverdue = tasks.filter(t => isTaskOverdue(t.due_at, t.status));
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const readyToHandoff = tasks.filter(t => t.task_type === 'quotation' || t.task_type === 'follow_up');

  return (
    <WorkspaceLayout title="Tele Lead Workspace" icon={Users}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <TaskList title="Task chưa chia" tasks={unassigned} icon={AlertCircle} color="bg-orange-600" />
        <TaskList title="Task team quá hạn" tasks={teamOverdue} icon={Clock} color="bg-red-700" />
        <TaskList title="Đang xử lý" tasks={inProgress} icon={Loader2} color="bg-blue-500" />
        <TaskList title="Qualified (Chờ Sale)" tasks={readyToHandoff} icon={CheckCircle2} color="bg-emerald-700" />
      </div>
    </WorkspaceLayout>
  );
}

function ManagerWorkspace({ tasks }: { tasks: any[] }) {
  const allPending = tasks.filter(t => t.status === 'pending');
  const allOverdue = tasks.filter(t => isTaskOverdue(t.due_at, t.status));
  const allHighPriority = tasks.filter(t => t.priority === 'high' || t.priority === 'urgent');

  return (
    <WorkspaceLayout title="Manager Workspace" icon={LayoutDashboard}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TaskList title="Tất cả Task chưa xong" tasks={allPending} icon={Clock} color="bg-slate-900" />
        <TaskList title="Tất cả Task quá hạn" tasks={allOverdue} icon={AlertCircle} color="bg-red-600" />
        <TaskList title="Việc khẩn cấp hệ thống" tasks={allHighPriority} icon={Target} color="bg-purple-700" />
      </div>
    </WorkspaceLayout>
  );
}
