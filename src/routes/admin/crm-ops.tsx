import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCustomerConversationState } from "@/lib/customerConversationState";
import { getStaleSignals } from "@/lib/operationalRules";
import { getInterventions, OperationalIntervention } from "@/lib/operationalInterventions";
import { OperationalSuggestionCard } from "@/components/admin/OperationalSuggestionCard";
import { getStaffDisplayName, buildStaffMap } from "@/lib/staffDisplay";
import { useBatchMode } from "@/hooks/useBatchMode";
import { useAuth } from "@/hooks/useAuth";
import { getRecommendedAssignee, distributeEvenly } from "@/lib/dispatchRecommendation";
import { BatchActionBar, BatchAction } from "@/components/crm/BatchActionBar";
import { Checkbox } from "@/components/ui/checkbox";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";
import { SafeCustomerImportDialog } from "@/components/customers/SafeCustomerImportDialog";
import { BatchReviewDialog } from "@/components/customers/BatchReviewDialog";
import { AssignStaffDialog } from "@/components/customers/AssignStaffDialog";
import { createNotification } from "@/lib/notifications";
import { toast } from "sonner";
import { 
  Activity, ShieldAlert, BarChart3, AlertCircle, AlertOctagon, 
  UserMinus, Flame, Clock, CheckCircle2, ChevronRight, UserCircle,
  Bell as BellIcon, Zap, Inbox, Plus, ArrowRight, Tag, Sparkles, PhoneOff, FileSpreadsheet, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { vi } from "date-fns/locale";

export const Route = createFileRoute("/admin/crm-ops")({
  component: CRMOpsWorkspace,
});

// Source label logic for Incoming Leads Queue
function getLeadSource(customer: any): { label: string; color: string; icon: string } {
  const ageHours = differenceInHours(new Date(), new Date(customer.created_at));
  const channel = customer.customer_channel || '';
  const isAutoChannel = ['facebook', 'google', 'tiktok', 'website', 'zalo_oa'].includes(channel.toLowerCase());
  if (ageHours < 2) return { label: 'Vừa tạo', color: 'emerald', icon: '🟢' };
  if (ageHours < 24) return { label: 'Hôm nay', color: 'blue', icon: '🔵' };
  if (isAutoChannel) return { label: 'Auto / Import', color: 'purple', icon: '🤖' };
  return { label: 'Thủ công', color: 'slate', icon: '✏️' };
}

function CRMOpsWorkspace() {
  const { user, isAdminOrSubAdmin } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [intakeFilter, setIntakeFilter] = useState<'all' | 'overdue24h'>('all');
  const [manualAssignCustomer, setManualAssignCustomer] = useState<any | null>(null);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [recentSyncLogs, setRecentSyncLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [custRes, staffRes, batchRes, logRes] = await Promise.all([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*'),
        supabase.from('customer_import_batches').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('crm_sync_logs').select('*').order('created_at', { ascending: false }).limit(5)
      ]);
      
      if (custRes.data) setCustomers(custRes.data);
      if (staffRes.data) setStaffProfiles(staffRes.data);
      if (batchRes.data) setRecentBatches(batchRes.data);
      if (logRes && logRes.data) setRecentSyncLogs(logRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const staffMap = useMemo(() => buildStaffMap(staffProfiles), [staffProfiles]);

  // Aggregations
  const stats = useMemo(() => {
    let active = 0, overdue = 0, unassigned = 0, dead = 0;
    const teamStats: Record<string, { total: number, hot: number, overdue: number }> = {};
    const stageStats: Record<string, { total: number, overdue: number, totalDays: number }> = {};
    const exceptionQueue: any[] = [];
    const dispatchQueue: any[] = [];

    const interventions = getInterventions(customers, staffMap);

    customers.forEach(c => {
      const state = getCustomerConversationState(c);
      const signals = getStaleSignals(c);
      const stage = c.lifecycle_stage || 'new';
      const isClosed = stage === 'won' || stage === 'lost' || stage === 'customer';

      if (!isClosed) active++;
      if (state.urgency === 'overdue') overdue++;
      if (!c.owner_sale_id && !c.owner_tele_id && !isClosed) {
        unassigned++;
        dispatchQueue.push(c);
      }
      
      const isDead = signals.some(s => s.signal === 'lead_dead' || s.signal === 'forgotten');
      if (isDead) dead++;

      if (signals.length > 0 || state.urgency === 'overdue') {
        if (!isClosed) exceptionQueue.push({ customer: c, signals, state });
      }

      // Team Heatmap
      const ownerId = c.owner_sale_id || c.owner_tele_id;
      if (ownerId && !isClosed) {
        if (!teamStats[ownerId]) teamStats[ownerId] = { total: 0, hot: 0, overdue: 0 };
        teamStats[ownerId].total++;
        if (state.temperature === 'HOT') teamStats[ownerId].hot++;
        if (state.urgency === 'overdue') teamStats[ownerId].overdue++;
      }

      // Stage Pressure
      if (!isClosed) {
        if (!stageStats[stage]) stageStats[stage] = { total: 0, overdue: 0, totalDays: 0 };
        stageStats[stage].total++;
        if (state.urgency === 'overdue') stageStats[stage].overdue++;
        const daysInStage = differenceInDays(new Date(), new Date(c.created_at)); 
        stageStats[stage].totalDays += daysInStage;
      }
    });

    return { active, overdue, unassigned, dead, teamStats, stageStats, exceptionQueue, dispatchQueue, interventions };
  }, [customers, staffMap]);

  const handleAssignCustomers = async (assignments: Record<string, string>) => {
    try {
      const updates = Object.entries(assignments).map(([customerId, staffId]) => {
        return supabase.from('customers').update({ owner_sale_id: staffId }).eq('id', customerId);
      });
      await Promise.all(updates);

      // Activity log (handoff) + Notification to assignee — both fire-and-forget
      Object.entries(assignments).forEach(([customerId, staffId]) => {
        const staffName = getStaffDisplayName(staffId, staffMap);
        const customer = customers.find(c => c.id === customerId);
        const customerName = customer?.facility_name || customer?.name || customerId;

        // Activity: keep existing handoff log
        supabase.from('customer_activities').insert({
          customer_id: customerId,
          type: 'handoff',
          activity_type: 'handoff',
          title: 'Được bàn giao (Dispatch Intelligence)',
          content: `Hệ thống đã phân tuyến cho ${staffName} dựa trên Capacity. Assigned by: ${user?.email || 'Admin'}.`,
          created_by: user?.id
        }).then(({ error }: { error: any }) => {
          if (error) console.warn('[crm-ops] handoff activity insert failed:', error.message);
        });

        // Notification: direct insert, no side-effects from createLeadAssignedAutomation
        createNotification({
          recipient_user_id: staffId,
          title: `Lead mới được giao: ${customerName}`,
          message: `Bạn vừa nhận lead "${customerName}" từ CRM Ops Center. Hãy liên hệ sớm nhất có thể.`,
          type: 'lead_assigned',
          priority: 'high',
          entity_type: 'customer',
          entity_id: customerId,
          action_url: `/customers/${customerId}`,
          created_by: user?.id,
        }).then(({ error }: { error: any }) => {
          if (error) console.warn('[crm-ops] notification insert failed:', error.message);
        });
      });

      const count = Object.keys(assignments).length;
      toast.success(`Đã phân tuyến ${count} lead thành công ⚡`);
      setCustomers(prev => prev.map(c => assignments[c.id] ? { ...c, owner_sale_id: assignments[c.id] } : c));
    } catch (e: any) {
      console.error(e);
      toast.error('Lỗi phân tuyến: ' + e.message);
    }
  };

  const handleSyncMirror = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-crm-to-google-sheets');
      
      if (error) {
        // Supabase invoke throws generic message if non-200. Try to extract backend message
        let errMsg = error.message;
        let step = "";
        let details = "";
        if (error.context && typeof error.context.json === 'function') {
           try {
             const errData = await error.context.json();
             if (errData.error) errMsg = errData.error;
             if (errData.step) step = errData.step;
             if (errData.details) details = errData.details;
           } catch(e) {}
        }
        throw new Error(step ? `[Step: ${step}] ${errMsg}${details ? ' - ' + details : ''}` : errMsg);
      }
      
      toast.success(data?.message || 'Đồng bộ Google Sheet thành công!');
      
      // Reload log
      const { data: newLogs } = await supabase.from('crm_sync_logs').select('*').order('created_at', { ascending: false }).limit(5);
      if (newLogs) setRecentSyncLogs(newLogs);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi đồng bộ Google Sheet');
    } finally {
      setSyncing(false);
    }
  };

  const { 
    selectedIds: dispatchSelected, 
    toggleSelection: toggleDispatch, 
    clearSelection: clearDispatch 
  } = useBatchMode(stats.dispatchQueue);

  const { 
    selectedIds: recoverySelected, 
    toggleSelection: toggleRecovery, 
    clearSelection: clearRecovery 
  } = useBatchMode(stats.exceptionQueue.map(q => q.customer));

  const dispatchActions: BatchAction[] = [
    { id: 'distribute', label: 'Phân bổ đều ⚡', icon: Activity, onClick: () => { 
      const assignments = distributeEvenly(dispatchSelected, stats.teamStats);
      handleAssignCustomers(assignments);
      clearDispatch(); 
    } }
  ];

  const recoveryActions: BatchAction[] = [
    { id: 'reassign', label: 'Re-assign', icon: UserCircle, onClick: () => { toast.info('Tính năng Re-assign đang phát triển'); clearRecovery(); } },
    { id: 'mark_monitored', label: 'Đã nhắc nhở', icon: CheckCircle2, onClick: () => { toast.success('Đã đánh dấu theo dõi các lead được chọn'); clearRecovery(); } },
    { id: 'ping_sale', label: 'Ping Sale', icon: BellIcon, onClick: () => { toast.success('Đã gửi Ping cảnh báo cho Sale phụ trách'); clearRecovery(); } }
  ];

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Đang tải Operations Workspace...</div>;
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen p-6 pb-20 font-sans antialiased">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                🎛️ Admin · Điều phối hệ thống
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-600" />
              CRM Ops Center
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Tiếp nhận · Phân tuyến · Giải nghẽn toàn hệ thống
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdminOrSubAdmin && (
              <Button
                variant="outline"
                className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-black text-xs h-10 px-5 flex items-center gap-2"
                onClick={() => setIsBulkImportOpen(true)}
              >
                <FileSpreadsheet className="w-4 h-4" /> Nhập Lead Excel
              </Button>
            )}
            <Button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-xs h-10 px-5 shadow-lg shadow-indigo-200 text-white flex items-center gap-2"
              onClick={() => setIsAddLeadOpen(true)}
            >
              <Plus className="w-4 h-4" /> Tạo Lead mới
            </Button>
            <Button variant="outline" className="bg-white" onClick={() => window.location.reload()}>
              Làm mới
            </Button>
          </div>
        </div>

        {/* ─── SECTION 0: INCOMING LEADS QUEUE (Intake) ─── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Inbox className="w-5 h-5 text-indigo-500" />
              Khách Mới Đổ Về (Incoming)
              <Badge className="ml-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-100 font-black text-xs">
                {stats.dispatchQueue.length}
              </Badge>
            </h2>
            <div className="flex items-center gap-2">
              {/* 24h filter toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setIntakeFilter('all')}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    intakeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setIntakeFilter('overdue24h')}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 ${
                    intakeFilter === 'overdue24h' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  ⚠️ Chờ quá 24h
                  {intakeFilter !== 'overdue24h' && (
                    <span className="bg-rose-100 text-rose-600 px-1.5 rounded-full font-black">
                      {stats.dispatchQueue.filter(c => differenceInHours(new Date(), new Date(c.created_at)) > 24).length}
                    </span>
                  )}
                </button>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chờ phân tuyến · Chưa có chủ</span>
            </div>
          </div>

          {stats.dispatchQueue.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="font-bold text-slate-700">Queue trống — Tất cả lead đã được phân tuyến!</p>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-4"
                onClick={() => setIsAddLeadOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Tạo Lead mới
              </Button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Source summary strip */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-100 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                {(() => {
                  const sources = stats.dispatchQueue.reduce((acc: Record<string, number>, c: any) => {
                    const src = getLeadSource(c).label;
                    acc[src] = (acc[src] || 0) + 1;
                    return acc;
                  }, {});
                  return Object.entries(sources).map(([label, count]) => (
                    <span key={label} className="text-slate-500">{label}: <span className="text-slate-800 font-black">{count}</span></span>
                  ));
                })()}
                <span className="ml-auto text-slate-400">Tổng: <span className="text-indigo-600 font-black">{stats.dispatchQueue.length} leads</span></span>
              </div>

              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold w-10"></th>
                    <th className="px-4 py-3 font-bold">Lead</th>
                    <th className="px-4 py-3 font-bold">Nguồn</th>
                    <th className="px-4 py-3 font-bold">Chờ</th>
                    <th className="px-4 py-3 font-bold">💡 Đề xuất</th>
                    <th className="px-4 py-3 font-bold text-right">Phân tuyến</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const filtered = intakeFilter === 'overdue24h'
                      ? stats.dispatchQueue.filter((c: any) => differenceInHours(new Date(), new Date(c.created_at)) > 24)
                      : stats.dispatchQueue;
                    const shown = filtered.slice(0, 10);
                    return shown.map((customer: any) => {
                      const suggestion = getRecommendedAssignee(customer, stats.teamStats, staffMap);
                      const source = getLeadSource(customer);
                      const waitHours = differenceInHours(new Date(), new Date(customer.created_at));
                      const isUrgent = waitHours > 24;
                      const missingContact = !customer.phone && !customer.email;
                      return (
                        <tr key={customer.id} className={`hover:bg-slate-50 transition-colors ${dispatchSelected.includes(customer.id) ? 'bg-indigo-50/50' : ''}`}>
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={dispatchSelected.includes(customer.id)}
                              onCheckedChange={() => toggleDispatch(customer.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {customer.name || customer.facility_name || 'Không rõ tên'}
                              {missingContact && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  <PhoneOff className="w-2.5 h-2.5" /> Thiếu liên hệ
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                              {customer.phone || customer.email || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              source.color === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
                              source.color === 'blue' ? 'bg-blue-50 text-blue-700' :
                              source.color === 'purple' ? 'bg-purple-50 text-purple-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {source.icon} {source.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold ${isUrgent ? 'text-rose-600' : 'text-slate-500'}`}>
                              {waitHours < 1 ? '< 1 giờ' : waitHours < 24 ? `${waitHours} giờ` : `${Math.floor(waitHours/24)} ngày`}
                              {isUrgent && ' ⚠️'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {suggestion ? (
                              <div className="text-xs">
                                <span className="font-bold text-indigo-700">{suggestion.displayName}</span>
                                <div className="text-[10px] text-slate-400 mt-0.5">{suggestion.reason}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Team đang Overloaded</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs font-bold"
                              onClick={() => setManualAssignCustomer(customer)}
                            >
                              Chia thủ công
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                              disabled={!suggestion}
                              onClick={() => { if(suggestion) handleAssignCustomers({ [customer.id]: suggestion.staffId }); }}
                            >
                              Gán ngay ⚡
                            </Button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                  {stats.dispatchQueue.length > 10 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-center text-xs font-bold text-indigo-600">
                        + {stats.dispatchQueue.length - 10} lead nữa — xem thêm bên dưới (Dispatch Queue)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 1: Health Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Khách Đang Chăm (Active)
            </div>
            <div className="text-3xl font-black text-slate-900">{stats.active}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-sm font-bold text-amber-500 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Quá Hạn (SLA Overdue) <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 ml-1">HARDCODED</Badge>
            </div>
            <div className="text-3xl font-black text-amber-600">{stats.overdue}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-sm font-bold text-rose-500 mb-2 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" /> Bỏ Quên / Đóng Băng <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 ml-1">HARDCODED</Badge>
            </div>
            <div className="text-3xl font-black text-rose-600">{stats.dead}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2">
              <UserMinus className="w-4 h-4" /> Khách Chưa Chia (Unassigned)
            </div>
            <div className="text-3xl font-black text-slate-700">{stats.unassigned}</div>
          </div>
        </div>

        {/* Section 1.5: Intervention Queue */}
        {stats.interventions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Operational Intervention Queue
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.interventions.map(intv => (
                <OperationalSuggestionCard 
                  key={intv.id} 
                  intervention={intv} 
                  onAction={(i) => {
                    if (i.targetId && (i.type === 'SILENT_VIP' || i.type === 'STALE_QUOTE')) {
                      navigate({ to: '/customers/$customerId', params: { customerId: i.targetId } });
                    } else {
                      toast.info(`Tính năng đang được phát triển: ${i.suggestedAction}`);
                    }
                  }} 
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Section 2: Team Heatmap */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> Tải Công Việc Sale (Heatmap)
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Nhân viên</th>
                    <th className="px-4 py-3 font-bold text-right">Đang giữ</th>
                    <th className="px-4 py-3 font-bold text-right">Capacity % <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 ml-1">HARDCODED</Badge></th>
                    <th className="px-4 py-3 font-bold text-right">HOT</th>
                    <th className="px-4 py-3 font-bold text-right">Quá hạn SLA</th>
                    <th className="px-4 py-3 font-bold text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(stats.teamStats)
                    .sort((a, b) => b[1].overdue - a[1].overdue)
                    .map(([id, s]) => {
                      const capacityPct = Math.round((s.total / 30) * 100);
                      const isOverloaded = capacityPct >= 100;
                      const isBusy = capacityPct >= 70 && capacityPct < 100;
                      return (
                        <tr key={id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                            <UserCircle className="w-5 h-5 text-slate-400" />
                            {getStaffDisplayName(id, staffMap)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">{s.total} / 30</td>
                          <td className="px-4 py-3">
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                              <div className={`h-1.5 rounded-full ${isOverloaded ? 'bg-rose-500' : isBusy ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(capacityPct, 100)}%` }}></div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-orange-600">{s.hot}</td>
                          <td className="px-4 py-3 text-right font-black text-rose-600">{s.overdue}</td>
                          <td className="px-4 py-3 text-center">
                            {isOverloaded ? (
                              <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Overloaded</Badge>
                            ) : isBusy ? (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Busy</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Healthy</Badge>
                            )}
                          </td>
                        </tr>
                      );
                  })}
                  {Object.keys(stats.teamStats).length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-400">Chưa có dữ liệu phân công</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Stage Pressure */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" /> Phân Bổ Theo Giai Đoạn (Pipeline)
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-4 space-y-4">
              {Object.entries(stats.stageStats)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([stage, s]) => {
                  const avgDays = s.total > 0 ? Math.round(s.totalDays / s.total) : 0;
                  return (
                    <div key={stage} className="flex flex-col gap-1.5 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 uppercase text-xs tracking-wider">{stage.replace(/_/g, ' ')}</span>
                        <span className="font-black text-slate-900">{s.total} leads</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-500">Lưu kho: {avgDays} ngày</span>
                        <span className="text-rose-500">{s.overdue} nghẽn (SLA)</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div 
                          className="h-full bg-indigo-500" 
                          style={{ width: `${Math.min(100, (s.total / Math.max(1, stats.active)) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  );
              })}
              {Object.keys(stats.stageStats).length === 0 && (
                <div className="text-center text-slate-400 py-4">Không có lead active</div>
              )}
            </div>
          </div>

        </div>

        {/* Sections 4 & 5: Exception Queues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Section 5: Recovery Queue */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" /> Cần Can Thiệp Khẩn Cấp (Recovery)
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-bold w-10"></th>
                    <th className="px-4 py-3 font-bold">Khách hàng</th>
                    <th className="px-4 py-3 font-bold">Risk Signal</th>
                    <th className="px-4 py-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.exceptionQueue.sort((a, b) => b.signals.length - a.signals.length).map(({customer, signals, state}) => (
                    <tr key={customer.id} className={`hover:bg-slate-50 ${recoverySelected.includes(customer.id) ? 'bg-indigo-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <Checkbox 
                          checked={recoverySelected.includes(customer.id)}
                          onCheckedChange={() => toggleRecovery(customer.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{customer.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                          {customer.owner_sale_id ? getStaffDisplayName(customer.owner_sale_id, staffMap) : 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {state.urgency === 'overdue' && <Badge variant="outline" className="bg-rose-50 text-rose-600 border-none px-1.5 py-0 w-fit">Overdue SLA</Badge>}
                          {signals.map((sig: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="bg-amber-50 text-amber-700 border-none px-1.5 py-0 w-fit truncate max-w-[150px]">
                              {sig.message}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs font-bold text-indigo-600"
                          onClick={() => navigate({ to: '/customers/$customerId', params: { customerId: customer.id } })}
                        >
                          Xử lý <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {stats.exceptionQueue.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-emerald-500 font-medium flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5"/> Mọi thứ đang hoạt động tốt</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Dispatch Queue */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-slate-500" /> Hàng Đợi Chia Khách (Dispatch Queue)
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-bold w-10"></th>
                    <th className="px-4 py-3 font-bold">Lead</th>
                    <th className="px-4 py-3 font-bold">Đã chờ</th>
                    <th className="px-4 py-3 font-bold">💡 Đề xuất (AI Ops)</th>
                    <th className="px-4 py-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.dispatchQueue.map((customer) => {
                    const suggestion = getRecommendedAssignee(customer, stats.teamStats, staffMap);
                    return (
                    <tr key={customer.id} className={`hover:bg-slate-50 ${dispatchSelected.includes(customer.id) ? 'bg-indigo-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <Checkbox 
                          checked={dispatchSelected.includes(customer.id)}
                          onCheckedChange={() => toggleDispatch(customer.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{customer.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase mt-0.5 truncate max-w-[150px]">{customer.phone || customer.email || 'Không rõ kênh'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {differenceInDays(new Date(), new Date(customer.created_at))} ngày
                      </td>
                      <td className="px-4 py-3">
                        {suggestion ? (
                          <div className="text-xs">
                            <span className="font-bold text-indigo-700">{suggestion.displayName}</span>
                            <div className="text-[10px] text-slate-500 mt-0.5">{suggestion.reason}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Team đang Overloaded</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs font-bold" onClick={() => setManualAssignCustomer(customer)}>
                          Chia thủ công
                        </Button>
                        <Button variant="default" size="sm" className="h-7 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!suggestion} onClick={() => { if(suggestion) handleAssignCustomers({ [customer.id]: suggestion.staffId }) }}>
                          Gán ngay ⚡
                        </Button>
                      </td>
                    </tr>
                  )})}
                  {stats.dispatchQueue.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium">Không có lead cần phân bổ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Section 6: Lịch sử Import */}
        {isAdminOrSubAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-500" /> Lịch sử Import / Import Staging
              </h2>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">File Name</th>
                    <th className="px-4 py-3 font-bold">Ngày tạo</th>
                    <th className="px-4 py-3 font-bold">Tổng</th>
                    <th className="px-4 py-3 font-bold text-emerald-600">Valid</th>
                    <th className="px-4 py-3 font-bold text-rose-600">Invalid</th>
                    <th className="px-4 py-3 font-bold text-amber-600">Dup</th>
                    <th className="px-4 py-3 font-bold text-indigo-600">Inserted</th>
                    <th className="px-4 py-3 font-bold text-slate-500">Skipped</th>
                    <th className="px-4 py-3 font-bold text-rose-700">Failed</th>
                    <th className="px-4 py-3 font-bold text-center">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBatches.map((batch) => (
                    <React.Fragment key={batch.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[200px]" title={batch.file_name}>
                          {batch.file_name}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {format(new Date(batch.created_at), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">{batch.total_rows || 0}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">{batch.valid_rows || 0}</td>
                        <td className="px-4 py-3 font-bold text-rose-600">{batch.invalid_rows || 0}</td>
                        <td className="px-4 py-3 font-bold text-amber-600">{batch.duplicate_rows || 0}</td>
                        <td className="px-4 py-3 font-bold text-indigo-600">{batch.inserted_rows || 0}</td>
                        <td className="px-4 py-3 font-bold text-slate-500">{batch.skipped_rows || 0}</td>
                        <td className="px-4 py-3 font-bold text-rose-700">{batch.failed_rows || 0}</td>
                        <td className="px-4 py-3 text-center">
                          {batch.status === 'completed' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none border-none">Completed</Badge>
                          ) : batch.status === 'processing' ? (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 shadow-none border-none">Processing</Badge>
                          ) : batch.status === 'staging' || batch.status === 'pending' ? (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 shadow-none border-none">Staging</Badge>
                          ) : batch.status === 'failed' ? (
                            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 shadow-none border-none">Failed</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 shadow-none border-none">{batch.status}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            onClick={() => setReviewBatchId(batch.id)}
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                      {batch.status === 'failed' && batch.error_message && (
                        <tr className="bg-rose-50/50">
                          <td colSpan={11} className="px-4 py-2 text-xs text-rose-600 font-mono">
                            <span className="font-bold">Error:</span> {batch.error_message}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {recentBatches.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">Không có dữ liệu import gần đây.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 7: Google Sheet Mirror */}
        {isAdminOrSubAdmin && (
          <div className="space-y-4 pb-8">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" /> CRM Mirror Sheet
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Đồng bộ dữ liệu sang Google Sheet</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-xl">
                  Tính năng này đẩy dữ liệu CRM (Read-only) lên Google Sheet giúp Ban Giám đốc quan sát trực quan.
                  Chỉ có thể đồng bộ 1 chiều từ hệ thống ra file Excel/Sheet.
                </p>
                <div className="mt-6 flex flex-col gap-4">
                  {recentSyncLogs.length === 0 ? (
                    <div className="text-sm text-slate-500 italic">Chưa từng đồng bộ.</div>
                  ) : (
                    <div className="space-y-3 max-w-2xl">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lịch sử 5 lần đồng bộ gần nhất</div>
                      {recentSyncLogs.map((log, index) => {
                        const durationStr = log.completed_at ? ` (Mất ${Math.round((new Date(log.completed_at).getTime() - new Date(log.created_at).getTime()) / 1000)}s)` : '';
                        return (
                          <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-600">
                                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')} {durationStr}
                                </span>
                                {log.status === 'success' ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Success</Badge>
                                ) : log.status === 'failed' ? (
                                  <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none">Failed</Badge>
                                ) : log.status === 'processing' ? (
                                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Processing</Badge>
                                ) : (
                                  <span className="text-slate-400 font-medium">N/A</span>
                                )}
                              </div>
                              {index === 0 && log.metadata?.service_account && (
                                <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
                                  {log.metadata.service_account}
                                </span>
                              )}
                            </div>
                            
                            {log.status === 'failed' && log.error_message && (
                              <div className="text-rose-600 text-xs bg-rose-50/50 p-2 rounded font-mono truncate hover:text-wrap" title={log.error_message}>
                                {log.error_message}
                              </div>
                            )}

                            {log.status === 'success' && log.metadata?.row_counts && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {Object.entries(log.metadata.row_counts).map(([tab, count]) => (
                                  <div key={tab} className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px]">
                                    <span className="text-slate-500">{tab.replace(/_/g, ' ')}:</span>
                                    <span className="font-bold text-emerald-600">{count !== undefined && count !== null ? String(count) : 'N/A'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 shrink-0">
                <Button 
                  onClick={handleSyncMirror} 
                  disabled={syncing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-8 shadow-sm"
                >
                  {syncing ? (
                    <><Activity className="w-4 h-4 mr-2 animate-spin" /> Đang đồng bộ...</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-2" /> Sync Now</>
                  )}
                </Button>
                {recentSyncLogs[0]?.metadata?.spreadsheet_id ? (
                  <Button variant="outline" className="font-bold text-slate-700 w-full" onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${recentSyncLogs[0].metadata.spreadsheet_id}`, '_blank')}>
                    Mở Google Sheet <ExternalLink className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="text-slate-400 w-full">
                    Chưa cấu hình Sheet
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
      <BatchActionBar selectedIds={dispatchSelected} actions={dispatchActions} onClear={clearDispatch} />
      <BatchActionBar selectedIds={recoverySelected} actions={recoveryActions} onClear={clearRecovery} />

      {/* Lead Intake Dialog — creates lead → drops into Intake Queue */}
      <AddCustomerDialog
        open={isAddLeadOpen}
        onOpenChange={setIsAddLeadOpen}
        onSuccess={() => {
          setIsAddLeadOpen(false);
          // Re-fetch data so the new lead appears in Incoming Queue
          const fetchData = async () => {
            const [custRes, staffRes] = await Promise.all([
              supabase.from('customers').select('*').order('created_at', { ascending: false }),
              supabase.from('profiles').select('*')
            ]);
            if (custRes.data) setCustomers(custRes.data);
            if (staffRes.data) setStaffProfiles(staffRes.data);
          };
          fetchData();
        }}
      />

      {/* Safe Customer Import Dialog */}
      <SafeCustomerImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onReviewBatch={(id) => setReviewBatchId(id)}
      />

      {/* Batch Review Dialog */}
      <BatchReviewDialog
        batchId={reviewBatchId}
        onOpenChange={(open) => { if (!open) setReviewBatchId(null); }}
        onConfirmSuccess={async () => {
          // Re-fetch everything
          const [custRes, staffRes, batchRes] = await Promise.all([
            supabase.from('customers').select('*').order('created_at', { ascending: false }),
            supabase.from('profiles').select('*'),
            supabase.from('customer_import_batches').select('*').order('created_at', { ascending: false }).limit(5)
          ]);
          if (custRes.data) setCustomers(custRes.data);
          if (staffRes.data) setStaffProfiles(staffRes.data);
          if (batchRes.data) setRecentBatches(batchRes.data);
        }}
      />

      <AssignStaffDialog
        isOpen={!!manualAssignCustomer}
        onClose={() => setManualAssignCustomer(null)}
        customer={manualAssignCustomer}
        onSuccess={() => {
          const fetchData = async () => {
            const [custRes, staffRes] = await Promise.all([
              supabase.from('customers').select('*').order('created_at', { ascending: false }),
              supabase.from('profiles').select('*')
            ]);
            if (custRes.data) setCustomers(custRes.data);
            if (staffRes.data) setStaffProfiles(staffRes.data);
          };
          fetchData();
        }}
      />
    </div>
  );
}
