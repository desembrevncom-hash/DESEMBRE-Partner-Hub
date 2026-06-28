import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, History, Filter, AlertCircle, RefreshCw, Eye, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/marketing/automation/events")({
  component: QAEventsConsolePage,
});

function QAEventsConsolePage() {
  const [events, setEvents] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterWorkflow, setFilterWorkflow] = useState<string>("");
  const [filterEventType, setFilterEventType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Modal State
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  useEffect(() => {
    fetchWorkflows();
    fetchEvents();
  }, [filterWorkflow, filterEventType, filterStatus]);

  const fetchWorkflows = async () => {
    try {
      const { data, error: err } = await supabase
        .from("marketing_automation_workflows")
        .select("id, name")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setWorkflows(data || []);
    } catch (e) {
      console.error("Lỗi tải workflows", e);
    }
  };

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("marketing_automation_events")
        .select(`*, marketing_automation_workflows(name)`)
        .order("created_at", { ascending: false });

      if (filterWorkflow) query = query.eq("workflow_id", filterWorkflow);
      if (filterEventType) query = query.eq("event_type", filterEventType);
      if (filterStatus) query = query.eq("status", filterStatus);

      const { data, error: err } = await query;
      if (err) throw err;
      setEvents(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setFilterWorkflow("");
    setFilterEventType("");
    setFilterStatus("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-indigo-500 selection:text-white">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/marketing/automation"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                <History className="w-6 h-6 text-amber-500" />
                QA Console: Automation Events
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  READ ONLY
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  NO REAL SEND
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={fetchEvents}
              variant="outline"
              className="h-10 px-4 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all bg-slate-900"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Làm mới
            </Button>
          </div>
        </div>
      </header>

      {/* MOCK BANNER */}
      <div className="bg-amber-500/10 border-y border-amber-500/20 p-3 flex justify-center items-center">
        <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-wider text-center">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Đây là màn hình QA Read-only. Dữ liệu từ các lượt chạy Mock Test. Không có tính năng gửi lại.
        </div>
      </div>

      <main className="container mx-auto px-4 md:px-6 mt-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* LEFT: Filters */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
              <h2 className="font-bold text-white flex items-center gap-2 mb-4 pb-4 border-b border-slate-800">
                <Filter className="w-4 h-4 text-indigo-400" /> Bộ lọc
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Workflow</label>
                  <select 
                    value={filterWorkflow}
                    onChange={(e) => setFilterWorkflow(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Tất cả Workflows</option>
                    {workflows.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Event Type</label>
                  <select 
                    value={filterEventType}
                    onChange={(e) => setFilterEventType(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Tất cả loại</option>
                    <option value="manual_mock_run">manual_mock_run</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="mock_logged">mock_logged</option>
                  </select>
                </div>

                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="w-full h-10 mt-4 rounded-xl border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT: Data List */}
          <div className="lg:col-span-3">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 min-h-[500px]">
              {isLoading ? (
                <div className="flex justify-center items-center h-40">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
                  <History className="w-16 h-16 text-slate-700 mb-4" />
                  <h3 className="text-lg font-bold text-white">Chưa có Mock Event nào</h3>
                  <p className="text-slate-400 mt-2 text-sm">Thử chạy Run Mock Test trong chi tiết Workflow trước.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="pb-3 font-medium px-4">Thời gian</th>
                        <th className="pb-3 font-medium px-4">Event Type</th>
                        <th className="pb-3 font-medium px-4">Workflow Name</th>
                        <th className="pb-3 font-medium px-4">Status</th>
                        <th className="pb-3 font-medium px-4 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map(ev => (
                        <tr key={ev.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                          <td className="py-4 px-4 text-slate-300 font-mono text-xs whitespace-nowrap">
                            {new Date(ev.created_at).toLocaleString("vi-VN")}
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-mono text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded text-xs">
                              {ev.event_type}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-200">
                            <div className="line-clamp-1 max-w-[200px]" title={ev.marketing_automation_workflows?.name}>
                              {ev.marketing_automation_workflows?.name || "Unknown"}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] uppercase font-bold rounded">
                              {ev.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedEvent(ev)}
                              className="h-8 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 rounded-lg"
                            >
                              <Eye className="w-4 h-4 mr-1.5" /> Xem
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* MODAL: Event Detail */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" /> Event Detail
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Event ID</div>
                  <div className="text-sm font-mono text-slate-300">{selectedEvent.id}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time</div>
                  <div className="text-sm text-slate-300">{new Date(selectedEvent.created_at).toLocaleString("vi-VN")}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Event Type</div>
                  <div className="text-sm font-mono text-indigo-400">{selectedEvent.event_type}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</div>
                  <div className="text-sm text-amber-500 font-bold">{selectedEvent.status}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Workflow</div>
                  <div className="text-sm text-slate-300">{selectedEvent.marketing_automation_workflows?.name || selectedEvent.workflow_id}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payload (JSON)</div>
                <pre className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs font-mono text-green-400 overflow-x-auto">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
