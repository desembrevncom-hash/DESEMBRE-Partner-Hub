import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceShell } from "./WorkspaceShell";
import { WorkspaceStatCard } from "./WorkspaceStatCard";
import { WorkspaceTasksCard } from "./WorkspaceTasksCard";
import { WorkspaceAppointmentsCard } from "./WorkspaceAppointmentsCard";
import { WorkspaceNotificationsCard } from "./WorkspaceNotificationsCard";
import { WorkspaceCustomersCard } from "./WorkspaceCustomersCard";
import { 
  Phone, 
  Clock, 
  UserCheck, 
  FileText, 
  Target, 
  Plus, 
  Users, 
  Calendar,
  LayoutDashboard,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const SaleWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>({
    tasks: [],
    appointments: [],
    notifications: [],
    customers: [],
    loading: true
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const [tasksRes, appointmentsRes, notifsRes, customersRes] = await Promise.all([
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").eq("assigned_to", user.id).eq("status", "pending"),
        supabase.from("calendar_events").select("*").eq("user_id", user.id).gte("start_time", new Date().toISOString()).order("start_time", { ascending: true }).limit(5),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("customers").select("*").eq("owner_sale_id", user.id).or(`next_follow_up_at.lte.${new Date().toISOString()},next_follow_up_at.is.null`).limit(10)
      ]);

      setData({
        tasks: tasksRes.data || [],
        appointments: appointmentsRes.data || [],
        notifications: notifsRes.data || [],
        customers: customersRes.data || [],
        loading: false
      });
    }
    fetchData();
  }, [user]);

  const stats = [
    { label: "Lead mới cần gọi", value: data.tasks.filter((t: any) => t.task_type === 'call').length, icon: <Phone className="w-5 h-5" />, color: "text-blue-600" },
    { label: "Follow-up hôm nay", value: data.customers.length, icon: <Clock className="w-5 h-5" />, color: "text-amber-500" },
    { label: "Khách cần check-in", value: data.tasks.filter((t: any) => t.task_type === 'visit').length, icon: <UserCheck className="w-5 h-5" />, color: "text-emerald-600" },
    { label: "Báo giá chưa chốt", value: data.tasks.filter((t: any) => t.task_type === 'quotation').length, icon: <FileText className="w-5 h-5" />, color: "text-slate-800" },
  ];

  return (
    <WorkspaceShell title="Sales Workspace" icon={<LayoutDashboard className="w-6 h-6" />} loading={data.loading}>
      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <WorkspaceStatCard key={i} {...stat} loading={data.loading} />
        ))}
      </div>

      {/* QUICK ACTIONS */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Button asChild size="sm" className="bg-slate-900 hover:bg-primary rounded-xl font-bold px-5 py-5 shadow-lg shadow-slate-200">
          <Link to="/orders/new"><Plus className="w-4 h-4 mr-2" /> Tạo đơn mới</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-5 py-5">
          <Link to="/customers"><Plus className="w-4 h-4 mr-2" /> Thêm khách hàng</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-5 py-5">
          <Link to="/calendar"><Calendar className="w-4 h-4 mr-2" /> Mở lịch biểu</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-5 py-5">
          <Link to="/customers"><Users className="w-4 h-4 mr-2" /> Khách của tôi</Link>
        </Button>
      </div>

      {/* CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <WorkspaceTasksCard 
          title="Việc hôm nay" 
          tasks={data.tasks} 
          icon={<Zap className="w-4 h-4" />} 
          color="bg-blue-600" 
        />
        <WorkspaceAppointmentsCard 
          appointments={data.appointments} 
        />
        <WorkspaceCustomersCard 
          title="Khách cần chăm sóc" 
          customers={data.customers} 
          icon={<UserCheck className="w-4 h-4" />} 
          color="bg-emerald-600" 
        />
        <WorkspaceNotificationsCard 
          notifications={data.notifications} 
        />
      </div>
    </WorkspaceShell>
  );
};
