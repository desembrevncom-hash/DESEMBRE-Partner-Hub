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
  Shield, 
  TrendingUp, 
  BarChart3, 
  LayoutDashboard,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { WorkspaceCalendarCard } from "./WorkspaceCalendarCard";

export const ManagerWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>({
    customers: [],
    tasks: [],
    notifications: [],
    loading: true
  });

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const [customersRes, tasksRes, notifsRes, companyRes] = await Promise.all([
        supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone)").order("due_at", { ascending: true }).limit(5),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("company_events").select("*").order("starts_at", { ascending: true })
      ]);

      setData({
        customers: customersRes.data || [],
        tasks: tasksRes.data || [],
        notifications: notifsRes.data || [],
        companyEvents: companyRes.data || [],
        loading: false
      });
    }
    fetchData();
  }, [user, refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const stats = [
    { label: "Khách mới hệ thống", value: data.customers.length, icon: <Users className="w-5 h-5" />, color: "text-rose-600" },
    { label: "Task chờ xử lý", value: data.tasks.length, icon: <Shield className="w-5 h-5" />, color: "text-purple-600" },
    { label: "Doanh thu tháng", value: "Updating...", icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-600" },
    { label: "Tỉ lệ chốt", value: "Updating...", icon: <BarChart3 className="w-5 h-5" />, color: "text-indigo-600" },
  ];

  return (
    <WorkspaceShell title="Manager Dashboard" icon={<LayoutDashboard className="w-6 h-6" />} loading={data.loading}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <WorkspaceStatCard key={i} {...stat} loading={data.loading} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <WorkspaceTasksCard 
            title="Task hệ thống" 
            items={data.tasks} 
            icon={<Shield className="w-4 h-4" />} 
            color="bg-purple-600" 
          />
          <WorkspaceCustomersCard 
            title="Khách hàng mới" 
            customers={data.customers} 
            icon={<Users className="w-4 h-4" />} 
            color="bg-rose-600" 
          />
          <WorkspaceNotificationsCard 
            notifications={data.notifications} 
          />
        </div>

        <div className="lg:col-span-2">
          <WorkspaceCalendarCard 
            events={[
              ...(data.tasks || []).map((t: any) => ({ ...t, _ui_type: 'task' })),
              ...(data.companyEvents || []).map((c: any) => ({ ...c, _ui_type: 'company' }))
            ]} 
            onRefresh={handleRefresh}
          />
        </div>
      </div>
    </WorkspaceShell>
  );
};
