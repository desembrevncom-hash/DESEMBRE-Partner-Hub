import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Users, AlertTriangle, Clock, XCircle, ChevronRight, Activity, TrendingUp, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CustomerPreviewDrawer } from '@/components/customers/CustomerPreviewDrawer';

export const Route = createFileRoute('/admin/lead-performance')({
  component: LeadPerformanceDashboard,
});

function LeadPerformanceDashboard() {
  const { session, isAdmin, isSubAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  // States for date range filtering
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  // Drawer state
  const [previewCustomer, setPreviewCustomer] = useState<any | null>(null);

  const fetchDashboardData = async () => {
    if (!session?.user) return;
    setLoading(true);
    
    try {
      let fromDate = new Date();
      if (dateRange === '7d') fromDate.setDate(fromDate.getDate() - 7);
      else if (dateRange === '30d') fromDate.setDate(fromDate.getDate() - 30);
      else if (dateRange === '90d') fromDate.setDate(fromDate.getDate() - 90);

      const { data: result, error } = await supabase.rpc('get_lead_performance_dashboard', {
        p_from: fromDate.toISOString().split('T')[0],
        p_to: new Date().toISOString().split('T')[0]
      });

      if (error) throw error;
      setData(result);
    } catch (error: any) {
      console.error(error);
      toast.error("Lỗi khi tải dữ liệu dashboard: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      fetchDashboardData();
    }
  }, [session, isAdmin, isSubAdmin, dateRange]);

  const handleRevoke = async (customerId: string) => {
    if (!confirm("Bạn có chắc chắn muốn thu hồi khách hàng này?")) return;
    try {
      const { error } = await supabase.rpc('revoke_customer_assignment', {
        p_customer_ids: [customerId],
        p_reason: "Quá hạn chăm sóc (14 ngày)",
        p_actor_id: session?.user.id
      });
      if (error) throw error;
      toast.success("Đã thu hồi thành công!");
      fetchDashboardData();
    } catch (error: any) {
      toast.error("Lỗi thu hồi: " + error.message);
    }
  };

  const handleOpenPreview = async (customerId: string) => {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('id, name, phone, customer_channel, owner_sale_id, owner_tele_id, created_at, updated_at, deleted_at, last_contacted_at, next_follow_up_at, orders(id, total, status)')
        .eq('id', customerId)
        .single();
      if (error) throw error;
      setPreviewCustomer(customer);
    } catch (e: any) {
      toast.error("Không tải được chi tiết: " + e.message);
    }
  };

  if (!session) return null;
  if (!isAdmin && !isSubAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Truy cập bị từ chối</h2>
        <p className="text-slate-500 mt-2">Tính năng này chỉ dành cho cấp Quản lý.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Lead Performance & SLA</h1>
          <p className="text-slate-500 font-medium mt-1">Đánh giá hiệu suất chăm sóc và xử lý dữ liệu khách hàng</p>
        </div>
        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
          <button onClick={() => setDateRange('7d')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${dateRange === '7d' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>7 Ngày</button>
          <button onClick={() => setDateRange('30d')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${dateRange === '30d' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>30 Ngày</button>
          <button onClick={() => setDateRange('90d')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${dateRange === '90d' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>90 Ngày</button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-indigo-600">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="mt-4 font-medium text-indigo-600/80 animate-pulse">Đang phân tích số liệu...</p>
        </div>
      ) : data ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500">Tổng Leads mới</p>
                    <p className="text-3xl font-black text-slate-900">{data.summary.total_leads}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500">Chưa phân công</p>
                    <p className="text-3xl font-black text-slate-900">{data.summary.unassigned_leads}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500">Quá hạn (Overdue)</p>
                    <p className="text-3xl font-black text-rose-600">{data.summary.overdue_followups}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500">Rủi ro (At Risk)</p>
                    <p className="text-3xl font-black text-amber-600">{data.summary.at_risk_leads}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500">Chờ Thu Hồi</p>
                    <p className="text-3xl font-black text-red-600">{data.summary.pending_revoke}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                    <XCircle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Sale Performance */}
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" /> Hiệu suất Sale
                      </CardTitle>
                      <CardDescription>Phân tích chất lượng xử lý lead theo nhân sự Sale</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Nhân viên</th>
                        <th className="px-4 py-3 text-right">Tổng Lead</th>
                        <th className="px-4 py-3 text-right">Đang Active</th>
                        <th className="px-4 py-3 text-right">Rủi ro (30d)</th>
                        <th className="px-4 py-3 text-right">Chờ Thu Hồi</th>
                        <th className="px-4 py-3 text-right">Task Trễ</th>
                        <th className="px-4 py-3 text-right">Tương tác</th>
                        <th className="px-4 py-3 text-right">TP Score</th>
                        <th className="px-4 py-3 text-right">TP Tích cực</th>
                        <th className="px-4 py-3 text-right">Doanh thu</th>
                        <th className="px-4 py-3 text-right">Avg First Touch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.by_sale.map((sale: any) => {
                        const showLowQuality = sale.interactions_count > 0 && (sale.low_quality_touchpoints / sale.interactions_count > 0.5);
                        return (
                        <tr key={sale.user_id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {sale.name}
                            {showLowQuality && (
                              <Badge variant="outline" className="ml-2 text-[9px] text-red-600 border-red-200 bg-red-50">Low Quality</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-indigo-600">{sale.assigned_count}</td>
                          <td className="px-4 py-3 text-right text-emerald-600">{sale.active_count}</td>
                          <td className="px-4 py-3 text-right text-amber-600">{sale.at_risk_count > 0 ? sale.at_risk_count : '-'}</td>
                          <td className="px-4 py-3 text-right text-red-600 font-bold">{sale.pending_revoke_count > 0 ? sale.pending_revoke_count : '-'}</td>
                          <td className="px-4 py-3 text-right text-rose-500">{sale.overdue_tasks_count > 0 ? sale.overdue_tasks_count : '-'}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{sale.interactions_count > 0 ? sale.interactions_count : '-'}</td>
                          <td className="px-4 py-3 text-right font-bold text-indigo-600">{sale.touchpoint_score > 0 ? sale.touchpoint_score : '-'}</td>
                          <td className="px-4 py-3 text-right text-emerald-600">{sale.positive_touchpoints > 0 ? sale.positive_touchpoints : '-'}</td>
                          <td className="px-4 py-3 text-right text-slate-700 font-medium">
                            {sale.revenue_total ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(sale.revenue_total) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {sale.avg_first_touch_hours ? `${parseFloat(sale.avg_first_touch_hours).toFixed(1)}h` : '-'}
                          </td>
                        </tr>
                      )})}
                      {data.by_sale.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-4 py-8 text-center text-slate-500">Không có dữ liệu trong khoảng thời gian này</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Tele Performance */}
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-teal-500" /> Hiệu suất Tele
                      </CardTitle>
                      <CardDescription>Đánh giá tương tác và gọi điện của Tele</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Nhân viên</th>
                        <th className="px-4 py-3 text-right">Tổng Lead</th>
                        <th className="px-4 py-3 text-right">Đang Active</th>
                        <th className="px-4 py-3 text-right">Rủi ro (30d)</th>
                        <th className="px-4 py-3 text-right">Chờ Thu Hồi</th>
                        <th className="px-4 py-3 text-right">Tương tác</th>
                        <th className="px-4 py-3 text-right">TP Score</th>
                        <th className="px-4 py-3 text-right">TP Tích cực</th>
                        <th className="px-4 py-3 text-right">Avg First Touch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.by_tele.map((tele: any) => {
                        const showLowQuality = tele.interactions_count > 0 && (tele.low_quality_touchpoints / tele.interactions_count > 0.5);
                        return (
                        <tr key={tele.user_id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {tele.name}
                            {showLowQuality && (
                              <Badge variant="outline" className="ml-2 text-[9px] text-red-600 border-red-200 bg-red-50">Low Quality</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-teal-600">{tele.assigned_count}</td>
                          <td className="px-4 py-3 text-right text-emerald-600">{tele.active_count}</td>
                          <td className="px-4 py-3 text-right text-amber-600">{tele.at_risk_count > 0 ? tele.at_risk_count : '-'}</td>
                          <td className="px-4 py-3 text-right text-red-600 font-bold">{tele.pending_revoke_count > 0 ? tele.pending_revoke_count : '-'}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{tele.interactions_count > 0 ? tele.interactions_count : '-'}</td>
                          <td className="px-4 py-3 text-right font-bold text-teal-600">{tele.touchpoint_score > 0 ? tele.touchpoint_score : '-'}</td>
                          <td className="px-4 py-3 text-right text-emerald-600">{tele.positive_touchpoints > 0 ? tele.positive_touchpoints : '-'}</td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {tele.avg_first_touch_hours ? `${parseFloat(tele.avg_first_touch_hours).toFixed(1)}h` : '-'}
                          </td>
                        </tr>
                      )})}
                      {data.by_tele.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-500">Không có dữ liệu trong khoảng thời gian này</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Source Performance */}
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-500" /> Nguồn Lead
                      </CardTitle>
                      <CardDescription>Hiệu suất chuyển đổi theo từng nguồn thu thập</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Nguồn / Kênh</th>
                        <th className="px-4 py-3 text-right">Tổng Lead</th>
                        <th className="px-4 py-3 text-right">Đã phân công</th>
                        <th className="px-4 py-3 text-right">Chuyển đổi</th>
                        <th className="px-4 py-3 text-right">Tổng Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.by_source.map((source: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900 capitalize">{source.lead_source?.replace(/_/g, ' ') || 'Không rõ'}</td>
                          <td className="px-4 py-3 text-right font-medium">{source.total}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{source.assigned} ({Math.round((source.assigned/source.total)*100 || 0)}%)</td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-medium">{source.converted}</td>
                          <td className="px-4 py-3 text-right text-slate-800 font-semibold">
                            {source.revenue_total ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(source.revenue_total) : '-'}
                          </td>
                        </tr>
                      ))}
                      {data.by_source.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Không có dữ liệu trong khoảng thời gian này</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>

            <div className="space-y-6">
              {/* SLA Distribution */}
              <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg font-bold text-slate-900">Tiến độ SLA</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">On Time</p>
                          <p className="text-xs text-slate-500">Tương tác &lt; 7 ngày</p>
                        </div>
                      </div>
                      <span className="font-black text-lg text-emerald-600">{data.sla.on_time || 0}</span>
                    </div>
                    <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">Warning</p>
                          <p className="text-xs text-slate-500">Tương tác 7 - 14 ngày</p>
                        </div>
                      </div>
                      <span className="font-black text-lg text-amber-600">{data.sla.warning || 0}</span>
                    </div>
                    <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-rose-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">Overdue</p>
                          <p className="text-xs text-slate-500">&gt; 14 ngày hoặc trễ hẹn</p>
                        </div>
                      </div>
                      <span className="font-black text-lg text-rose-600">{data.sla.overdue || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Revoke Candidates */}
              <Card className="border-red-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-red-50/50 border-b border-red-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-red-900 flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-500" /> Đề xuất Thu hồi
                      </CardTitle>
                      <CardDescription className="text-red-700/70">Lead bị bỏ quên quá 14 ngày</CardDescription>
                    </div>
                    <Badge variant="destructive" className="bg-red-500">{data.revoke_candidates.length}</Badge>
                  </div>
                </CardHeader>
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {data.revoke_candidates.map((rc: any) => (
                    <div key={rc.customer_id} className="p-4 hover:bg-slate-50 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{rc.customer_name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3" /> Sale: <span className="font-medium text-slate-700">{rc.owner_sale_name}</span>
                          </p>
                        </div>
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]">
                          {rc.inactive_days} ngày Inactive
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 bg-slate-100 p-2 rounded-md mb-3 line-clamp-1 border border-slate-200">
                        {rc.reason}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full text-xs h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                          onClick={() => handleOpenPreview(rc.customer_id)}
                        >
                          Mở khách
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          className="w-full text-xs h-8 bg-red-500 hover:bg-red-600"
                          onClick={() => handleRevoke(rc.customer_id)}
                        >
                          Thu hồi
                        </Button>
                      </div>
                    </div>
                  ))}
                  {data.revoke_candidates.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium">Không có khách hàng nào chờ thu hồi</p>
                    </div>
                  )}
                </div>
              </Card>

            </div>
          </div>
        </div>
      ) : null}

      <CustomerPreviewDrawer
        customer={previewCustomer}
        open={!!previewCustomer}
        onOpenChange={(open) => !open && setPreviewCustomer(null)}
        staffMap={{}} // Minimal mockup, usually passed if needed
      />
    </div>
  );
}
