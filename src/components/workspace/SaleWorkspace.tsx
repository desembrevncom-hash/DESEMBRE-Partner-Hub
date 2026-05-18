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
  Plus, 
  LayoutDashboard,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

import { WorkspaceCalendarCard } from "./WorkspaceCalendarCard";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";

export const SaleWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>({
    tasks: [],
    appointments: [],
    notifications: [],
    customers: [],
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
      
      const startOfTodayStr = startOfToday.toISOString();
      const endOfTodayStr = endOfToday.toISOString();
      
      const [tasksRes, personalRes, companyRes, notifsRes, customersRes] = await Promise.all([
        supabase.from("customer_tasks")
          .select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)")
          .eq("assigned_to", user.id)
          .eq("status", "pending")
          .lte("due_at", endOfTodayStr),
        supabase.from("calendar_events")
          .select("*")
          .eq("assigned_sale_id", user.id)
          .gte("starts_at", startOfTodayStr)
          .lte("starts_at", endOfTodayStr)
          .order("starts_at", { ascending: true }),
        supabase.from("company_events").select("*").order("starts_at", { ascending: true }),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("customers").select("*").eq("owner_sale_id", user.id).or(`next_follow_up_at.lte.${new Date().toISOString()},next_follow_up_at.is.null`).limit(10)
      ]);

      setData({
        tasks: tasksRes.data || [],
        appointments: personalRes.data || [],
        companyEvents: companyRes.data || [],
        notifications: notifsRes.data || [],
        customers: customersRes.data || [],
        loading: false
      });
    }
    fetchData();
  }, [user, refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const stats = [
    { label: "Lead mới cần gọi", value: data.tasks.filter((t: any) => t.task_type === 'call').length, icon: <Phone className="w-5 h-5" />, color: "text-blue-600" },
    { label: "Follow-up hôm nay", value: data.customers.length, icon: <Clock className="w-5 h-5" />, color: "text-amber-500" },
    { label: "Khách cần check-in", value: data.tasks.filter((t: any) => t.task_type === 'visit').length, icon: <UserCheck className="w-5 h-5" />, color: "text-emerald-600" },
    { label: "Báo giá chưa chốt", value: data.tasks.filter((t: any) => t.task_type === 'quotation').length, icon: <FileText className="w-5 h-5" />, color: "text-slate-800" },
  ];

  return (
    <WorkspaceShell title="Sales Workspace" icon={<LayoutDashboard className="w-6 h-6" />} loading={data.loading}>
      {/* HEADER SECTION: 4 STATS + STACKED BUTTONS */}
      <div className="flex flex-wrap lg:flex-nowrap gap-4 mb-8 items-stretch">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-[4]">
          {stats.map((stat, i) => (
            <WorkspaceStatCard key={i} {...stat} loading={data.loading} />
          ))}
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
          <Button asChild size="sm" className="bg-slate-900 hover:bg-primary rounded-xl font-bold flex-1 shadow-lg shadow-slate-200">
            <Link to="/orders/new"><Plus className="w-4 h-4 mr-2" /> Tạo đơn mới</Link>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white border-slate-200 hover:bg-slate-50 rounded-xl font-bold flex-1"
            onClick={() => setIsAddCustomerOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2 text-primary" /> Thêm khách hàng
          </Button>
        </div>
      </div>

      {/* 2-COLUMN LAYOUT (LEFT: 1, RIGHT: 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: LISTS (1 part) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <WorkspaceTasksCard 
            title="Việc hôm nay" 
            items={[...(data.tasks || []), ...(data.appointments || [])]} 
            icon={<Zap className="w-4 h-4" />} 
            color="bg-blue-600" 
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

        {/* RIGHT COLUMN: CALENDAR (2 parts) */}
        <div className="lg:col-span-2">
          <WorkspaceCalendarCard 
            events={[
              ...(data.tasks || []).map((t: any) => ({ ...t, _ui_type: 'task' })), 
              ...(data.appointments || []).map((a: any) => ({ ...a, _ui_type: 'personal' })),
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
