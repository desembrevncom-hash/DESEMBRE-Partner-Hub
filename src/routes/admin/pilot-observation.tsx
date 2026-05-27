import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Eye, Bug, AlertTriangle, AlertCircle, MessageSquarePlus, Clock, ArrowRight, ListFilter, Activity, LayoutDashboard, Search, MousePointer2 } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export const Route = createFileRoute("/admin/pilot-observation")({
  component: PilotObservationDashboard,
});

function PilotObservationDashboard() {
  const { isAdmin, isSubAdmin } = useAuth();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin && !isSubAdmin) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const [metricRes, feedbackRes] = await Promise.all([
          supabase.from('pilot_usage_metrics').select('*, auth_users:user_id(email)').order('created_at', { ascending: false }).limit(1000),
          supabase.from('pilot_feedback_logs').select('*, auth_users:user_id(email)').order('created_at', { ascending: false }).limit(500)
        ]);

        if (metricRes.data) setMetrics(metricRes.data);
        if (feedbackRes.data) setFeedbacks(feedbackRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin, isSubAdmin]);

  if (!isAdmin && !isSubAdmin) {
    return <div className="p-8 text-center text-slate-500 font-bold">Bạn không có quyền truy cập trang này.</div>;
  }

  // Aggregations
  const totalDrags = metrics.filter(m => m.action_key === 'kanban_drag');
  const dragSuccess = totalDrags.filter(m => m.metric_data?.success === true).length;
  const dragSuccessRate = totalDrags.length ? Math.round((dragSuccess / totalDrags.length) * 100) : 0;

  const quickLogs = metrics.filter(m => m.action_key === 'quick_log').length;
  const searches = metrics.filter(m => m.action_key === 'search').length;
  
  const filterCounts = metrics.filter(m => m.action_key === 'filter_apply').reduce((acc: any, curr) => {
    const f = curr.metric_data?.filterId;
    if (f) acc[f] = (acc[f] || 0) + 1;
    return acc;
  }, {});
  const topFilters = Object.entries(filterCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

  const bugFeedbacks = feedbacks.filter(f => f.feedback_type === 'bug').length;
  const slowFeedbacks = feedbacks.filter(f => f.feedback_type === 'slow').length;
  const confusingFeedbacks = feedbacks.filter(f => f.feedback_type === 'confusing').length;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-8">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
          <Eye className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pilot Observation</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">Dữ liệu hành vi & UX thật</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold">Đang tải dữ liệu quan sát...</div>
      ) : (
        <>
          {/* Top Aggregates */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                   <MousePointer2 className="w-4 h-4" />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Kéo thả thành công</span>
                </div>
                <div className="text-3xl font-black text-slate-900">{dragSuccessRate}%</div>
                <div className="text-xs text-slate-400 font-medium mt-1">Trên tổng {totalDrags.length} lượt kéo</div>
             </div>
             
             <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                   <Activity className="w-4 h-4" />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Tần suất Quick Log</span>
                </div>
                <div className="text-3xl font-black text-indigo-600">{quickLogs}</div>
                <div className="text-xs text-slate-400 font-medium mt-1">Lượt log kết quả nhanh</div>
             </div>

             <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                   <Search className="w-4 h-4" />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Lượt tìm kiếm</span>
                </div>
                <div className="text-3xl font-black text-slate-900">{searches}</div>
                <div className="text-xs text-slate-400 font-medium mt-1">Đã debounce 800ms</div>
             </div>

             <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                   <MessageSquarePlus className="w-4 h-4" />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Góp ý từ người dùng</span>
                </div>
                <div className="flex gap-2 text-sm font-bold mt-2">
                   <span className="text-rose-500 bg-rose-50 px-2 rounded-lg">{bugFeedbacks} Bugs</span>
                   <span className="text-amber-500 bg-amber-50 px-2 rounded-lg">{slowFeedbacks} Chậm</span>
                   <span className="text-slate-500 bg-slate-100 px-2 rounded-lg">{confusingFeedbacks} Rối</span>
                </div>
                <div className="text-xs text-slate-400 font-medium mt-auto">Tổng: {feedbacks.length} feedbacks</div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Filters */}
            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
               <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                 <ListFilter className="w-4 h-4 text-indigo-500" /> Top Bộ lọc được dùng nhiều nhất
               </h3>
               <div className="space-y-3">
                 {topFilters.length === 0 && <p className="text-sm text-slate-400">Chưa có dữ liệu</p>}
                 {topFilters.map(([f, count]: any) => (
                   <div key={f} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <span className="text-xs font-bold text-slate-700 capitalize">{f.replace('_', ' ')}</span>
                      <span className="text-xs font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{count} lần</span>
                   </div>
                 ))}
               </div>
            </div>

            {/* Recent Feedbacks */}
            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
               <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2 shrink-0">
                 <AlertCircle className="w-4 h-4 text-rose-500" /> Báo cáo lỗi & Góp ý gần đây
               </h3>
               <div className="space-y-3 overflow-y-auto pr-2 no-scrollbar">
                 {feedbacks.length === 0 && <p className="text-sm text-slate-400">Chưa có góp ý nào</p>}
                 {feedbacks.map(f => (
                   <div key={f.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-2">
                           {f.feedback_type === 'bug' && <span className="text-[10px] font-black text-rose-600 bg-rose-100 px-2 py-1 rounded-lg uppercase">Bug</span>}
                           {f.feedback_type === 'slow' && <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-1 rounded-lg uppercase">Chậm</span>}
                           {f.feedback_type === 'confusing' && <span className="text-[10px] font-black text-slate-600 bg-slate-200 px-2 py-1 rounded-lg uppercase">Rối</span>}
                           {f.feedback_type === 'missing_feature' && <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-2 py-1 rounded-lg uppercase">Thiếu tính năng</span>}
                           <span className="text-[10px] font-medium text-slate-400">{f.auth_users?.email}</span>
                         </div>
                         <span className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(f.created_at), 'HH:mm dd/MM', { locale: vi })}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">{f.feedback_note}</p>
                      {f.page_key && <p className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded inline-block mt-2">📍 {f.page_key}</p>}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
