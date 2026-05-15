import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceShell } from "./WorkspaceShell";
import { WorkspaceStatCard } from "./WorkspaceStatCard";
import { WorkspaceTasksCard } from "./WorkspaceTasksCard";
import { WorkspaceNotificationsCard } from "./WorkspaceNotificationsCard";
import { WorkspaceCustomersCard } from "./WorkspaceCustomersCard";
import { 
  Users, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  LayoutDashboard,
  Plus,
  BarChart3,
  PhoneCall
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const TeleLeadWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>({
    customers: [],
    unassignedTasks: [],
    overdueTasks: [],
    notifications: [],
    loading: true
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const [customersRes, unassignedRes, overdueRes, notifsRes] = await Promise.all([
        supabase.from("customers").select("*").eq("owner_tele_id", user.id).limit(10),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").is("assigned_to", null).eq("owner_tele_id", user.id),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").eq("owner_tele_id", user.id).lt("due_at", new Date().toISOString()).neq("status", "completed"),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(5)
      ]);

      setData({
        customers: customersRes.data || [],
        unassignedTasks: unassignedRes.data || [],
        overdueTasks: overdueRes.data || [],
        notifications: notifsRes.data || [],
        loading: false
      });
    }
    fetchData();
  }, [user]);

  const stats = [
    { label: "Khách Tele quản lý", value: data.customers.length, icon: <Users className="w-5 h-5" />, color: "text-indigo-600" },
    { label: "Task chưa chia", value: data.unassignedTasks.length, icon: <AlertCircle className="w-5 h-5" />, color: "text-orange-500" },
    { label: "Task team quá hạn", value: data.overdueTasks.length, icon: <Clock className="w-5 h-5" />, color: "text-red-600" },
    { label: "Qualified (Chờ Sale)", value: data.customers.filter((c: any) => c.care_model === 'tele_qualified_then_sale').length, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-emerald-600" },
  ];

  return (
    <WorkspaceShell title="Tele Lead Workspace" icon={<LayoutDashboard className="w-6 h-6" />} loading={data.loading}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <WorkspaceStatCard key={i} {...stat} loading={data.loading} />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Button asChild size="sm" className="bg-slate-900 hover:bg-primary rounded-xl font-bold px-5 py-5 shadow-lg shadow-slate-200">
          <Link to="/customers"><Plus className="w-4 h-4 mr-2" /> Tạo task gọi khách</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-5 py-5">
          <Link to="/workspace"><Users className="w-4 h-4 mr-2" /> Chia task Telesale</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-5 py-5">
          <Link to="/customers"><PhoneCall className="w-4 h-4 mr-2" /> Mở khách Tele</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-5 py-5">
          <Link to="/marketing/reports"><BarChart3 className="w-4 h-4 mr-2" /> Báo cáo Tele</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <WorkspaceCustomersCard 
          title="Khách Tele cần xử lý" 
          customers={data.customers} 
          icon={<Users className="w-4 h-4" />} 
          color="bg-indigo-600" 
        />
        <WorkspaceTasksCard 
          title="Task team Tele" 
          tasks={[...data.unassignedTasks, ...data.overdueTasks]} 
          icon={<AlertCircle className="w-4 h-4" />} 
          color="bg-orange-600" 
        />
        <WorkspaceNotificationsCard 
          notifications={data.notifications} 
        />
        <WorkspaceCustomersCard 
          title="Khách cần chuyển Sale" 
          customers={data.customers.filter((c: any) => c.care_model === 'tele_qualified_then_sale')} 
          icon={<CheckCircle2 className="w-4 h-4" />} 
          color="bg-emerald-700" 
        />
      </div>
    </WorkspaceShell>
  );
};
