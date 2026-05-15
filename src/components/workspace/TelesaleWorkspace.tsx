import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceShell } from "./WorkspaceShell";
import { WorkspaceStatCard } from "./WorkspaceStatCard";
import { WorkspaceTasksCard } from "./WorkspaceTasksCard";
import { WorkspaceNotificationsCard } from "./WorkspaceNotificationsCard";
import { 
  Phone, 
  AlertCircle, 
  Target, 
  UserX, 
  ChevronRight,
  LayoutDashboard,
  PlayCircle,
  CheckCircle2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const TelesaleWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>({
    todayTasks: [],
    overdueTasks: [],
    interestedLeads: [],
    callbackTasks: [],
    notifications: [],
    loading: true
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const today = new Date().toISOString().split('T')[0];
      
      const [todayRes, overdueRes, interestedRes, callbackRes, notifsRes] = await Promise.all([
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").eq("assigned_to", user.id).eq("status", "pending").eq("task_type", "call"),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").eq("assigned_to", user.id).lt("due_at", new Date().toISOString()).neq("status", "completed"),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").eq("assigned_to", user.id).or('result.eq.interested,result.eq.qualified'),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").eq("assigned_to", user.id).eq("result", "call_back_later"),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(5)
      ]);

      setData({
        todayTasks: todayRes.data || [],
        overdueTasks: overdueRes.data || [],
        interestedLeads: interestedRes.data || [],
        callbackTasks: callbackRes.data || [],
        notifications: notifsRes.data || [],
        loading: false
      });
    }
    fetchData();
  }, [user]);

  const stats = [
    { label: "Cuộc gọi hôm nay", value: data.todayTasks.length, icon: <Phone className="w-5 h-5" />, color: "text-indigo-600" },
    { label: "Task quá hạn", value: data.overdueTasks.length, icon: <AlertCircle className="w-5 h-5" />, color: "text-red-600" },
    { label: "Khách quan tâm", value: data.interestedLeads.length, icon: <Target className="w-5 h-5" />, color: "text-pink-600" },
    { label: "Không nghe máy", value: 0, icon: <UserX className="w-5 h-5" />, color: "text-slate-500" },
  ];

  return (
    <WorkspaceShell title="Telesale Workspace" icon={<LayoutDashboard className="w-6 h-6" />} loading={data.loading}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <WorkspaceStatCard key={i} {...stat} loading={data.loading} />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Button size="sm" className="bg-slate-900 hover:bg-primary rounded-xl font-bold px-5 py-5 shadow-lg shadow-slate-200">
          <PlayCircle className="w-4 h-4 mr-2" /> Bắt đầu gọi
        </Button>
        <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-5 py-5">
          <CheckCircle2 className="w-4 h-4 mr-2" /> Hoàn thành task
        </Button>
        <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-5 py-5">
          <UserX className="w-4 h-4 mr-2" /> Không nghe máy
        </Button>
        <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-5 py-5">
          <ChevronRight className="w-4 h-4 mr-2" /> Cần chuyển Sale
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <WorkspaceTasksCard 
          title="Cuộc gọi hôm nay" 
          tasks={data.todayTasks} 
          icon={<Phone className="w-4 h-4" />} 
          color="bg-indigo-600" 
        />
        <WorkspaceTasksCard 
          title="Task cần xử lý" 
          tasks={data.overdueTasks} 
          icon={<AlertCircle className="w-4 h-4" />} 
          color="bg-red-600" 
        />
        <WorkspaceTasksCard 
          title="Khách quan tâm" 
          tasks={data.interestedLeads} 
          icon={<Target className="w-4 h-4" />} 
          color="bg-pink-600" 
        />
        <WorkspaceTasksCard 
          title="Lịch gọi lại" 
          tasks={data.callbackTasks} 
          icon={<Calendar className="w-4 h-4" />} 
          color="bg-slate-700" 
        />
      </div>
    </WorkspaceShell>
  );
};
