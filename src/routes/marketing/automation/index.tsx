import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, GitBranch, Play, Clock, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/marketing/automation/")({
  component: AutomationIndexPage,
});

function AutomationIndexPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("marketing_automation_workflows")
        .select(`*, marketing_audiences(name)`)
        .order("created_at", { ascending: false });

      if (err) throw err;
      setWorkflows(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-indigo-500 selection:text-white">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/marketing"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                <GitBranch className="w-6 h-6 text-indigo-400" />
                Marketing Automation (MVP)
              </h1>
              <p className="text-xs text-slate-400 font-medium">Safe Mode / Chế độ Mock</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/20"
            >
              <Link to="/marketing/automation/new">
                <Plus className="w-4 h-4 mr-2" /> Tạo Workflow Mới
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* WARNING BANNER */}
      <div className="bg-amber-500/10 border-y border-amber-500/20 p-3 flex justify-center items-center">
        <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-wider">
          <AlertCircle className="w-4 h-4" />
          Mọi Workflow tạo ra đều ở chế độ Mock Only - Không gửi tin nhắn thật
        </div>
      </div>

      <main className="container mx-auto px-4 md:px-6 mt-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
            Lỗi tải danh sách: {error}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <GitBranch className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-white">Chưa có Automation Workflow nào</h3>
            <p className="text-slate-400 max-w-sm mt-2 mb-6 text-sm">
              Tạo ngay một chuỗi kịch bản chăm sóc khách hàng tự động để dùng thử.
            </p>
            <Button
              asChild
              className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              <Link to="/marketing/automation/new">Bắt đầu tạo mới</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((wf) => (
              <Link to={"/marketing/automation/" + wf.id} key={wf.id} className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-all group flex flex-col h-full relative overflow-hidden block">
                <div className="absolute top-0 right-0 p-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-slate-400 group-hover:bg-slate-700 transition-colors">
                    {wf.status}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-1 pr-16 leading-tight group-hover:text-indigo-400 transition-colors">{wf.name}</h3>
                <p className="text-sm text-slate-400 mb-6 line-clamp-2 min-h-[40px]">{wf.description || "Không có mô tả"}</p>
                
                <div className="space-y-4 flex-1">
                  {/* Trigger */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Trigger</div>
                      <div className="text-sm text-slate-200 font-medium">
                        {wf.trigger_type === "customer_created" && "Khách hàng mới được tạo"}
                        {wf.trigger_type === "audience_member_added" && "Khách hàng lọt vào Audience"}
                        {wf.trigger_type === "manual_test_trigger" && "Kích hoạt thủ công (Test)"}
                      </div>
                      {wf.marketing_audiences?.name && (
                        <div className="text-xs text-indigo-400 mt-1 flex items-center gap-1">
                          ↳ Tập: {wf.marketing_audiences.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delay */}
                  <div className="flex items-start gap-3 relative before:absolute before:left-4 before:-top-4 before:bottom-0 before:w-0.5 before:bg-slate-800">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5 z-10 group-hover:bg-amber-500/20 transition-colors">
                      <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Delay</div>
                      <div className="text-sm text-slate-200 font-medium">
                        Chờ {wf.delay_amount} {wf.delay_unit}
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Play className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Action (MOCK)</div>
                      <div className="text-sm text-slate-200 font-medium">
                        {wf.action_type === "create_mock_dispatch" && "Tạo Mock Dispatch"}
                        {wf.action_type === "add_to_mock_queue" && "Thêm vào Mock Queue"}
                        {wf.action_type === "log_only" && "Chỉ ghi Log"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-500">
                    {new Date(wf.created_at).toLocaleDateString('vi-VN')}
                  </div>
                  {wf.mock_only && (
                    <div className="text-[10px] font-bold text-amber-500 uppercase bg-amber-500/10 px-2 py-1 rounded">
                      Safe Mode
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
