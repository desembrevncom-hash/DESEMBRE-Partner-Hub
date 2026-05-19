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
  LayoutDashboard,
  PlayCircle,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

import { WorkspaceCalendarCard } from "./WorkspaceCalendarCard";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";

export const TelesaleWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>({
    allTasks: [],
    todayTasks: [],
    overdueTasks: [],
    interestedLeads: [],
    callbackTasks: [],
    companyEvents: [],
    notifications: [],
    loading: true
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      
      const [allTasksRes, interestedRes, callbackRes, companyRes, notifsRes] = await Promise.all([
        supabase.from("customer_tasks")
          .select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)")
          .eq("assigned_to", user.id)
          .eq("status", "pending")
          .eq("task_type", "call"),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").eq("assigned_to", user.id).or('result.eq.interested,result.eq.qualified'),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").eq("assigned_to", user.id).eq("result", "call_back_later"),
        supabase.from("company_events").select("*").order("starts_at", { ascending: true }),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(5)
      ]);

      const allTasks = allTasksRes.data || [];
      
      const todayTasks = allTasks.filter((t: any) => {
        if (!t.due_at) return false;
        const dueTime = new Date(t.due_at).getTime();
        return dueTime >= startOfToday.getTime() && dueTime <= endOfToday.getTime();
      });

      const overdueTasks = allTasks.filter((t: any) => {
        if (!t.due_at) return false;
        const dueTime = new Date(t.due_at).getTime();
        return dueTime < startOfToday.getTime();
      });

      setData({
        allTasks,
        todayTasks,
        overdueTasks,
        interestedLeads: interestedRes.data || [],
        callbackTasks: callbackRes.data || [],
        companyEvents: companyRes.data || [],
        notifications: notifsRes.data || [],
        loading: false
      });
    }
    fetchData();
  }, [user, refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const stats = [
    { label: "Cuộc gọi hôm nay", value: data.todayTasks.length, icon: <Phone className="w-5 h-5" />, color: "text-indigo-600" },
    { label: "Task quá hạn", value: data.overdueTasks.length, icon: <AlertCircle className="w-5 h-5" />, color: "text-red-600" },
    { label: "Khách quan tâm", value: data.interestedLeads.length, icon: <Target className="w-5 h-5" />, color: "text-pink-600" },
    { label: "Không nghe máy", value: 0, icon: <UserX className="w-5 h-5" />, color: "text-slate-500" },
  ];

  return (
    <WorkspaceShell title="Telesale Workspace" icon={<LayoutDashboard className="w-6 h-6" />} loading={data.loading}>
      {/* HEADER SECTION: 4 STATS + STACKED BUTTONS */}
      <div className="flex flex-wrap lg:flex-nowrap gap-4 mb-8 items-stretch">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-[4]">
          {stats.map((stat, i) => (
            <WorkspaceStatCard key={i} {...stat} loading={data.loading} />
          ))}
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
          <Button 
            size="sm" 
            className="bg-slate-900 hover:bg-primary rounded-xl font-bold flex-1 shadow-lg shadow-slate-200"
            onClick={() => setIsAddCustomerOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> Thêm khách hàng
          </Button>
          <Button variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-slate-50 rounded-xl font-bold flex-1">
            <UserX className="w-4 h-4 mr-2" /> Không nghe máy
          </Button>
        </div>
      </div>

      {/* 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <WorkspaceTasksCard 
            title="Việc hôm nay" 
            items={[...(data.todayTasks || []), ...(data.overdueTasks || [])]} 
            icon={<Phone className="w-4 h-4" />} 
            color="bg-indigo-600" 
            onRefresh={handleRefresh}
          />
          <WorkspaceTasksCard 
            title="Khách quan tâm" 
            items={data.interestedLeads} 
            icon={<Target className="w-4 h-4" />} 
            color="bg-pink-600" 
            onRefresh={handleRefresh}
          />
          <WorkspaceNotificationsCard 
            notifications={data.notifications} 
          />
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2">
          <WorkspaceCalendarCard 
            events={[
              ...(data.allTasks || []).map((t: any) => ({ ...t, _ui_type: 'task' })), 
              ...(data.companyEvents || []).map((c: any) => ({ ...c, _ui_type: 'company' }))
            ]} 
            onRefresh={handleRefresh}
          />
        </div>
      </div>

      <AddCustomerDialog 
        open={isAddCustomerOpen} 
        onOpenChange={setIsAddCustomerOpen} 
        onSuccess={handleRefresh}
      />
    </WorkspaceShell>
  );
};
