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
  Plus,
  AlertTriangle,
  MapPin,
  Settings2,
  Activity,
  Target,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { WorkspaceCalendarCard } from "./WorkspaceCalendarCard";
import { RoutingAlertsWidget } from "@/components/customers/RoutingAlertsWidget";

export const ManagerWorkspace: React.FC = () => {
  const { user, isAdminOrSubAdmin } = useAuth();
  const [data, setData] = useState<any>({
    customers: [],
    tasks: [],
    notifications: [],
    reclaimCount: 0,
    loading: true
  });

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const [customersRes, tasksRes, notifsRes, companyRes, reclaimRes] = await Promise.all([
        supabase.from("customers").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone)").order("due_at", { ascending: true }).limit(5),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("company_events").select("*").order("starts_at", { ascending: true }),
        supabase.from("customers").select("id").in("ownership_status", ["at_risk", "reclaimable"]).is("deleted_at", null)
      ]);

      setData({
        customers: customersRes.data || [],
        tasks: tasksRes.data || [],
        notifications: notifsRes.data || [],
        companyEvents: companyRes.data || [],
        reclaimCount: reclaimRes.data?.length || 0,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Liên kết nhanh quản trị</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdminOrSubAdmin && (
            <>
              <Link to="/admin/crm-ops">
                <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 text-[10px] font-black uppercase h-9 px-3 rounded-xl flex items-center gap-1.5 shadow-sm">
                  <Activity className="w-3.5 h-3.5" /> CRM OPS CENTER
                </Button>
              </Link>
              <Link to="/reports/routing">
                <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-black uppercase h-9 px-3 rounded-xl flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> PHÂN TUYẾN
                </Button>
              </Link>
              <Link to="/admin/reclamation">
                <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-black uppercase h-9 px-3 rounded-xl flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-rose-600" /> THU HỒI
                </Button>
              </Link>
              <Link to="/admin/users">
                <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-black uppercase h-9 px-3 rounded-xl flex items-center gap-1.5">
                  <UsersRound className="w-3.5 h-3.5 text-blue-600" /> NHÂN SỰ
                </Button>
              </Link>
            </>
          )}
          <Link to="/admin/hub">
            <Button size="sm" className="bg-slate-900 text-white hover:bg-black text-[11px] font-black uppercase h-9 px-5 rounded-xl flex items-center gap-2 shadow-lg shadow-slate-200 ml-2">
              <Settings2 className="w-4 h-4" /> ADMIN CONTROL HUB
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <RoutingAlertsWidget />
      </div>

      {data.reclaimCount > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 rounded-2xl border border-red-200 p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-650 shrink-0 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-black text-red-900 uppercase tracking-wide">Yêu cầu thu hồi cần xử lý</h4>
              <p className="text-[11px] font-bold text-slate-600 mt-0.5">
                Có <span className="text-red-600 font-extrabold">{data.reclaimCount}</span> khách hàng đang trong trạng thái cảnh báo hoặc quá hạn chăm sóc.
              </p>
            </div>
          </div>
          <Link to="/admin/reclamation">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider h-9 px-4">
              Xử lý ngay
            </Button>
          </Link>
        </div>
      )}

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
            onRefresh={handleRefresh}
          />
          <WorkspaceCustomersCard 
            title="Khách hàng mới" 
            customers={data.customers} 
            icon={<Users className="w-4 h-4" />} 
            color="bg-rose-600" 
          />
          <WorkspaceNotificationsCard 
            notifications={data.notifications} 
            onRefresh={handleRefresh}
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
