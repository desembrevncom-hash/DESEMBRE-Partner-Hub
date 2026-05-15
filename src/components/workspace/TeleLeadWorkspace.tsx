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

import { WorkspaceCalendarCard } from "./WorkspaceCalendarCard";

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
      {/* HEADER SECTION: STATS + ACTIONS */}
      <div className="flex flex-wrap items-stretch gap-3 mb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          {stats.map((stat, i) => (
            <WorkspaceStatCard key={i} {...stat} loading={data.loading} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="bg-slate-900 hover:bg-primary rounded-xl font-bold px-4 h-full shadow-lg shadow-slate-200">
            <Link to="/customers"><Plus className="w-4 h-4 mr-2" /> Tạo task gọi khách</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold px-4 h-full">
            <Link to="/customers"><PhoneCall className="w-4 h-4 mr-2" /> Mở khách Tele</Link>
          </Button>
        </div>
      </div>

      {/* 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <WorkspaceTasksCard 
            title="Việc hôm nay" 
            items={[...(data.unassignedTasks || []), ...(data.overdueTasks || [])]} 
            icon={<AlertCircle className="w-4 h-4" />} 
            color="bg-orange-600" 
          />
          <WorkspaceCustomersCard 
            title="Khách Tele cần xử lý" 
            customers={data.customers} 
            icon={<Users className="w-4 h-4" />} 
            color="bg-indigo-600" 
          />
          <WorkspaceNotificationsCard 
            notifications={data.notifications} 
          />
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2">
          <WorkspaceCalendarCard events={[...(data.unassignedTasks || []), ...(data.overdueTasks || [])]} />
        </div>
      </div>
    </WorkspaceShell>
  );
};
