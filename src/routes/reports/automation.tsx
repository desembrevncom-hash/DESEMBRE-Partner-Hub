import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  CheckSquare, 
  Bell, 
  ArrowLeft, 
  RefreshCw,
  Info,
  Calendar,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/automation")({
  component: AutomationReportPage,
});

function AutomationReportPage() {
  const { user, isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [kpis, setKpis] = useState({
    runsToday: 0,
    success: 0,
    partialFailed: 0,
    failed: 0,
    tasksToday: 0,
    notificationsToday: 0,
  });
  const [logs, setLogs] = useState<any[]>([]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const isoStart = startOfDay.toISOString();

      // Fetch logs of today
      const { data: logsData, error: logsErr } = await supabase
        .from("automation_logs")
        .select(`
          id,
          automation_type,
          status,
          error_message,
          metadata,
          created_at,
          customer_id,
          lead_id,
          customer:customers(facility_name, name),
          lead:leads(name)
        `)
        .gte("created_at", isoStart)
        .order("created_at", { ascending: false });

      if (logsErr) throw logsErr;

      const runsToday = logsData?.length || 0;
      const success = logsData?.filter(l => l.status === "success").length ?? 0;
      const partialFailed = logsData?.filter(l => l.status === "partial_failed").length ?? 0;
      const failed = logsData?.filter(l => l.status !== "success" && l.status !== "partial_failed").length ?? 0;

      // Count tasks created today automatically (assigned_by is null)
      const { data: tasksData, error: tasksErr } = await supabase
        .from("customer_tasks")
        .select("id")
        .gte("created_at", isoStart)
        .is("assigned_by", null);
      if (tasksErr) throw tasksErr;
      const tasksToday = tasksData?.length ?? 0;

      // Count notifications created today automatically (created_by is null)
      const { data: notifsData, error: notifsErr } = await supabase
        .from("notifications")
        .select("id")
        .gte("created_at", isoStart)
        .is("created_by", null);
      if (notifsErr) throw notifsErr;
      const notificationsToday = notifsData?.length ?? 0;

      setKpis({
        runsToday,
        success,
        partialFailed,
        failed,
        tasksToday,
        notificationsToday
      });

      setLogs(logsData || []);
    } catch (err: any) {
      console.error("Automation Report fetch error:", err);
      toast.error("Không thể tải báo cáo tự động hóa: " + (err.message || err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isManager) return;
    fetchData();
  }, [isManager]);

  if (!isManager) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-500">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Không có quyền truy cập</h2>
          <p className="text-slate-500 text-sm">
            Trang này chỉ dành cho tài khoản Admin và Sub Admin quản trị hệ thống.
          </p>
          <Link to="/">
            <Button className="mt-2 rounded-xl text-xs font-black uppercase bg-slate-950 hover:bg-slate-900 px-6">
              Quay lại Trang chủ
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-xl border border-slate-100 hover:bg-slate-50">
                <ArrowLeft className="w-4 h-4 text-slate-650" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900">Báo cáo Sức khỏe Tự động hóa</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
                Automation Health & Execution Monitor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <KpiCard 
                title="Yêu cầu Automation chạy hôm nay" 
                value={kpis.runsToday} 
                icon={Cpu} 
                color="indigo" 
                desc="Tổng số luồng automation được kích hoạt hôm nay"
              />
              <KpiCard 
                title="Automation Thành công" 
                value={kpis.success} 
                icon={CheckCircle2} 
                color="emerald" 
                desc="Số luồng hoàn thành toàn bộ các bước an toàn"
              />
              <KpiCard 
                title="Lỗi một phần (Warning)" 
                value={kpis.partialFailed} 
                icon={AlertTriangle} 
                color="orange" 
                desc="Một số bước phụ (Task/Noti/Activity) thất bại nhưng không crash"
              />
              <KpiCard 
                title="Automation Thất bại" 
                value={kpis.failed} 
                icon={XCircle} 
                color="rose" 
                desc="Luồng chạy lỗi toàn phần hoặc gặp ngoại lệ"
              />
              <KpiCard 
                title="Task tự động tạo hôm nay" 
                value={kpis.tasksToday} 
                icon={CheckSquare} 
                color="blue" 
                desc="Số việc làm/nhắc nhở tự sinh từ hệ thống CRM"
              />
              <KpiCard 
                title="Notification tự động hôm nay" 
                value={kpis.notificationsToday} 
                icon={Bell} 
                color="pink" 
                desc="Số thông báo gửi cho nhân viên do hệ thống tự sinh"
              />
            </div>

            {/* Execution logs */}
            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Chi tiết thực thi hôm nay</CardTitle>
                  <p className="text-slate-500 text-xs mt-1 font-medium">
                    Danh sách các tiến trình automation chạy trong ngày hôm nay
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 border-y border-slate-100 uppercase text-[9px] font-black text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-6 py-4 whitespace-nowrap">Thời gian</th>
                        <th className="px-6 py-4 whitespace-nowrap">Loại Automation</th>
                        <th className="px-6 py-4 whitespace-nowrap">Đối tượng liên quan</th>
                        <th className="px-6 py-4 whitespace-nowrap">Trạng thái</th>
                        <th className="px-6 py-4 whitespace-nowrap">Chi tiết lỗi</th>
                        <th className="px-6 py-4 whitespace-nowrap text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.map((log) => {
                        const date = new Date(log.created_at);
                        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const dateStr = date.toLocaleDateString();

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-650">
                              <span className="font-bold text-slate-900 block">{timeStr}</span>
                              <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{dateStr}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap font-black text-slate-800">
                              <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 text-[10px] font-bold">
                                {log.automation_type}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {log.customer ? (
                                <Link 
                                  to={`/customers/${log.customer_id}`} 
                                  className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                                >
                                  {log.customer.facility_name || log.customer.name}
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              ) : log.lead ? (
                                <span className="font-bold text-slate-700">
                                  {log.lead.name} <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 ml-1">Lead</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Không có</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {log.status === "success" ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-none hover:bg-emerald-50 shadow-none font-black px-2.5 py-1">
                                  Thành công
                                </Badge>
                              ) : log.status === "partial_failed" ? (
                                <Badge className="bg-orange-50 text-orange-700 border-none hover:bg-orange-50 shadow-none font-black px-2.5 py-1">
                                  Lỗi một phần
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-50 text-rose-700 border-none hover:bg-rose-50 shadow-none font-black px-2.5 py-1">
                                  Lỗi
                                </Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-medium max-w-xs truncate" title={log.error_message}>
                              {log.error_message ? (
                                <span className="text-rose-600 font-semibold">{log.error_message}</span>
                              ) : (
                                <span className="text-slate-400 italic">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                                className="h-7 px-3 rounded-lg text-[9px] font-black uppercase text-indigo-650 hover:bg-indigo-50"
                              >
                                <Info className="w-3 h-3 mr-1" /> Inspect
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-bold text-sm">
                            Hôm nay chưa ghi nhận luồng chạy automation nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Inspect Modal/Drawer */}
            {selectedLog && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Chi tiết thực thi Automation</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-widest">{selectedLog.id}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setSelectedLog(null)} 
                      className="rounded-xl border border-slate-150 h-8 px-3 text-[10px] font-bold text-slate-500"
                    >
                      Đóng
                    </Button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Loại Automation</span>
                        <span className="font-bold text-slate-900 mt-1 block">{selectedLog.automation_type}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Thời gian chạy</span>
                        <span className="font-bold text-slate-900 mt-1 block">
                          {new Date(selectedLog.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Trạng thái</span>
                        <span className="mt-1 block">
                          {selectedLog.status === "success" ? (
                            <Badge className="bg-emerald-100 text-emerald-700 shadow-none font-bold">Thành công</Badge>
                          ) : selectedLog.status === "partial_failed" ? (
                            <Badge className="bg-orange-100 text-orange-700 shadow-none font-bold">Lỗi một phần</Badge>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-700 shadow-none font-bold">Thất bại</Badge>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Khách hàng / Lead</span>
                        <span className="font-bold text-slate-900 mt-1 block">
                          {selectedLog.customer
                            ? `${selectedLog.customer.facility_name || selectedLog.customer.name} (Khách)`
                            : selectedLog.lead
                            ? `${selectedLog.lead.name} (Lead)`
                            : "Không xác định"}
                        </span>
                      </div>
                    </div>

                    {selectedLog.error_message && (
                      <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                        <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider block mb-1">
                          Thông tin lỗi
                        </span>
                        <p className="font-mono text-rose-600 whitespace-pre-wrap">{selectedLog.error_message}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                        Metadata & Trạng thái các bước (Steps)
                      </span>
                      {selectedLog.metadata ? (
                        <pre className="bg-slate-900 text-slate-200 p-4 rounded-2xl overflow-x-auto font-mono text-[10px] leading-relaxed max-h-60">
                          {JSON.stringify(selectedLog.metadata, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-slate-400 italic">Không có dữ liệu metadata bổ sung.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color, desc }: any) {
  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    indigo: {
      bg: "bg-indigo-50/50 hover:bg-indigo-50",
      icon: "bg-indigo-100 text-indigo-600 border-indigo-200",
      border: "border-indigo-100/50",
    },
    emerald: {
      bg: "bg-emerald-50/50 hover:bg-emerald-50",
      icon: "bg-emerald-100 text-emerald-600 border-emerald-200",
      border: "border-emerald-100/50",
    },
    orange: {
      bg: "bg-orange-50/50 hover:bg-orange-50",
      icon: "bg-orange-100 text-orange-650 border-orange-200",
      border: "border-orange-100/50",
    },
    rose: {
      bg: "bg-rose-50/50 hover:bg-rose-50",
      icon: "bg-rose-100 text-rose-600 border-rose-200",
      border: "border-rose-100/50",
    },
    blue: {
      bg: "bg-blue-50/50 hover:bg-blue-50",
      icon: "bg-blue-100 text-blue-600 border-blue-200",
      border: "border-blue-100/50",
    },
    pink: {
      bg: "bg-pink-50/50 hover:bg-pink-50",
      icon: "bg-pink-100 text-pink-600 border-pink-200",
      border: "border-pink-100/50",
    },
  };

  const currentTheme = colorMap[color] || colorMap.indigo;

  return (
    <Card 
      className={`rounded-[28px] border border-slate-100 shadow-sm overflow-hidden bg-white transition-all duration-300 hover:shadow-md group`}
      title={desc}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-355 group-hover:scale-110 ${currentTheme.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-normal">
          {title}
        </p>
        <div className="flex items-baseline gap-1.5 mt-2">
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
            {value}
          </h3>
        </div>
        <p className="text-[9px] text-slate-400 font-medium mt-1.5 line-clamp-1">
          {desc}
        </p>
      </CardContent>
    </Card>
  );
}
