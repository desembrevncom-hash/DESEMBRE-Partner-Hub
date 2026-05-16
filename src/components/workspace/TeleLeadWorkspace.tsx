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
  PhoneCall
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

import { WorkspaceCalendarCard } from "./WorkspaceCalendarCard";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";

export const TeleLeadWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>({
    customers: [],
    unassignedLeads: [],
    overdueTasks: [],
    notifications: [],
    telesaleStaff: [],
    loading: true
  });
  const [isAssigning, setIsAssigning] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const [customersRes, unassignedRes, overdueRes, companyRes, notifsRes, staffRolesRes] = await Promise.all([
        supabase.from("customers").select("*").eq("owner_tele_id", user.id).limit(10),
        supabase.from("customers").select("*").is("owner_tele_id", null).eq("lifecycle_stage", "new_lead").order("created_at", { ascending: false }),
        supabase.from("customer_tasks").select("*, customer:customers(name, facility_name, phone), lead:leads(name, facility_name, phone)").eq("owner_tele_id", user.id).lt("due_at", new Date().toISOString()).neq("status", "completed"),
        supabase.from("company_events").select("*").order("starts_at", { ascending: true }),
        supabase.from("notifications").select("*").eq("recipient_user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("user_roles").select("user_id").eq("role", "telesale")
      ]);

      let staffList: any[] = [];
      if (staffRolesRes.data && staffRolesRes.data.length > 0) {
        const ids = staffRolesRes.data.map(r => r.user_id);
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
        staffList = profiles || [];
      }

      setData({
        customers: customersRes.data || [],
        unassignedLeads: unassignedRes.data || [],
        overdueTasks: overdueRes.data || [],
        companyEvents: companyRes.data || [],
        notifications: notifsRes.data || [],
        telesaleStaff: staffList,
        loading: false
      });
    }
    fetchData();
  }, [user, refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleAssign = async (leadId: string, leadName: string, staffId: string, staffName: string) => {
    setIsAssigning(true);
    try {
      const { error: updateError } = await supabase
        .from("customers")
        .update({ owner_tele_id: staffId, lifecycle_stage: 'assigned' })
        .eq("id", leadId);

      if (updateError) throw updateError;

      await supabase.from("notifications").insert({
        recipient_user_id: staffId,
        title: "Lead mới được gán",
        message: `Bạn vừa được gán lead mới: ${leadName}`,
        type: "lead_assigned"
      });

      toast.success(`Đã gán ${leadName} cho ${staffName}`);
      handleRefresh();
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const stats = [
    { label: "Khách Tele quản lý", value: data.customers.length, icon: <Users className="w-5 h-5" />, color: "text-indigo-600" },
    { label: "Lead chưa chia", value: data.unassignedLeads.length, icon: <AlertCircle className="w-5 h-5" />, color: "text-orange-500" },
    { label: "Task team quá hạn", value: data.overdueTasks.length, icon: <Clock className="w-5 h-5" />, color: "text-red-600" },
    { label: "Qualified (Chờ Sale)", value: data.customers.filter((c: any) => c.care_model === 'tele_qualified_then_sale').length, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-emerald-600" },
  ];

  return (
    <WorkspaceShell title="Tele Lead Workspace" icon={<LayoutDashboard className="w-6 h-6" />} loading={data.loading}>
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
          <Button asChild variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-slate-50 rounded-xl font-bold flex-1">
            <Link to="/customers"><PhoneCall className="w-4 h-4 mr-2" /> Mở khách Tele</Link>
          </Button>
        </div>
      </div>

      {/* 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="bg-slate-900 p-4 text-white">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" /> Hàng đợi Lead mới
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {data.unassignedLeads.length > 0 ? (
                data.unassignedLeads.map((lead: any) => (
                  <div key={lead.id} className="p-4 flex flex-col gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{lead.facility_name || lead.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{lead.city || "Toàn quốc"}</p>
                    </div>
                    <select 
                       className="h-8 rounded-lg border-slate-200 text-[10px] font-black uppercase px-2 w-full outline-none"
                       onChange={(e) => {
                          const staff = data.telesaleStaff.find((s: any) => s.id === e.target.value);
                          if (staff) handleAssign(lead.id, lead.facility_name || lead.name, staff.id, staff.full_name || staff.email);
                       }}
                       disabled={isAssigning}
                    >
                       <option value="">Gán Telesale...</option>
                       {data.telesaleStaff.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                       ))}
                    </select>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">Trống hàng đợi</div>
              )}
            </div>
          </div>
          
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
          <WorkspaceCalendarCard 
            events={[
              ...(data.overdueTasks || []).map((t: any) => ({ ...t, _ui_type: 'task' })),
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
