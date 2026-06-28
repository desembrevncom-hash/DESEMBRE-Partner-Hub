import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Play, AlertCircle, Clock, Zap, GitBranch, History, Loader2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/marketing/automation/$id")({
  component: AutomationDetailPage,
});

function AutomationDetailPage() {
  const { id } = Route.useParams();
  const [workflow, setWorkflow] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isMockRunning, setIsMockRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflow();
    fetchEvents();
  }, [id]);

  const fetchWorkflow = async () => {
    try {
      const { data, error: err } = await supabase
        .from("marketing_automation_workflows")
        .select(`*, marketing_audiences(name)`)
        .eq("id", id)
        .single();
        
      if (err) throw err;
      setWorkflow(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async () => {
    setIsEventsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("marketing_automation_events")
        .select("*")
        .eq("workflow_id", id)
        .order("created_at", { ascending: false });
        
      if (err) throw err;
      setEvents(data || []);
    } catch (err: any) {
      toast.error("Lỗi tải lịch sử event: " + err.message);
    } finally {
      setIsEventsLoading(false);
    }
  };

  const handleRunMockTest = async () => {
    if (!workflow || !workflow.mock_only) return;
    
    setIsMockRunning(true);
    try {
      const payload = {
        source: "manual_mock_runner",
        workflow_name: workflow.name,
        trigger_type: workflow.trigger_type,
        action_type: workflow.action_type,
        audience_id: workflow.audience_id,
        mock_only: true,
        note: "Manual mock test run from M14 UI"
      };

      const { error: err } = await supabase
        .from("marketing_automation_events")
        .insert({
          workflow_id: id,
          event_type: "manual_mock_run",
          payload,
          status: "mock_logged"
        });

      if (err) throw err;
      toast.success("Chạy thử Mock Test thành công!");
      await fetchEvents(); // refresh list
    } catch (err: any) {
      toast.error("Lỗi khi chạy mock test: " + err.message);
    } finally {
      setIsMockRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-400">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-lg text-white font-bold mb-2">Lỗi tải Workflow</p>
        <p>{error || "Workflow không tồn tại"}</p>
        <Button asChild className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Link to="/marketing/automation">Quay lại danh sách</Link>
        </Button>
      </div>
    );
  }

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
                Chi tiết Workflow
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  SAFE MODE
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  MOCK ONLY
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  NO REAL SEND
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MOCK BANNER */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 p-3 flex justify-center items-center">
        <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-wider text-center">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          This only logs a mock event. No message will be sent.
        </div>
      </div>

      <main className="container mx-auto px-4 md:px-6 mt-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Info & Runner */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
              <h2 className="text-2xl font-bold text-white mb-2">{workflow.name}</h2>
              <p className="text-sm text-slate-400 mb-6">{workflow.description || "Không có mô tả"}</p>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <span className="text-sm text-slate-500">Trạng thái</span>
                  <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs font-bold uppercase">{workflow.status}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <span className="text-sm text-slate-500">Ngày tạo</span>
                  <span className="text-sm text-slate-300">{new Date(workflow.created_at).toLocaleDateString("vi-VN")}</span>
                </div>
              </div>

              <div className="mt-8">
                <Button 
                  onClick={handleRunMockTest}
                  disabled={!workflow.mock_only || isMockRunning}
                  className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg shadow-amber-900/20 transition-all text-base"
                >
                  {isMockRunning ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 mr-2 fill-white" />
                  )}
                  Run Mock Test
                </Button>
                <p className="text-[11px] text-center text-slate-500 mt-3 font-medium">
                  Sẽ insert 1 event mock_logged vào database.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-5">
              <h3 className="font-bold text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" /> Cấu hình Workflow
              </h3>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Trigger</div>
                  <div className="text-sm text-slate-200 font-medium">
                    {workflow.trigger_type}
                  </div>
                  {workflow.marketing_audiences?.name && (
                    <div className="text-xs text-indigo-400 mt-1 flex items-center gap-1">
                      ↳ Tập: {workflow.marketing_audiences.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 relative before:absolute before:left-4 before:-top-4 before:bottom-0 before:w-0.5 before:bg-slate-800">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5 z-10">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Delay</div>
                  <div className="text-sm text-slate-200 font-medium">
                    Chờ {workflow.delay_amount} {workflow.delay_unit}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Play className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Action</div>
                  <div className="text-sm text-slate-200 font-medium">
                    {workflow.action_type}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Events History */}
          <div className="lg:col-span-2">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 min-h-[500px]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" /> Lịch sử Events
                </h3>
                <span className="text-xs font-medium bg-slate-800 text-slate-300 px-3 py-1 rounded-full">
                  {events.length} records
                </span>
              </div>

              {isEventsLoading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <History className="w-12 h-12 text-slate-700 mb-4" />
                  <p className="text-slate-400 font-medium">Chưa có sự kiện nào.</p>
                  <p className="text-slate-500 text-sm mt-1">Bấm "Run Mock Test" để tạo log thử nghiệm.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((ev) => (
                    <div key={ev.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row gap-4 sm:items-center">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-200">{ev.event_type}</span>
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] uppercase font-bold rounded">
                            {ev.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono line-clamp-1">
                          payload: {JSON.stringify(ev.payload)}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 shrink-0">
                        {new Date(ev.created_at).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
