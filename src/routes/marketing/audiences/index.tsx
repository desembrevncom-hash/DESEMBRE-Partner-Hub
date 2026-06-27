import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, Plus, ArrowLeft, Loader2, Target, Calendar } from "lucide-react";

export const Route = createFileRoute("/marketing/audiences/")({
  component: AudienceListPage,
});

function AudienceListPage() {
  const [audiences, setAudiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAudiences();
  }, []);

  const fetchAudiences = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("marketing_audiences")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAudiences(data || []);
    } catch (err: any) {
      toast.error("Lỗi khi tải danh sách phân tập: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-purple-500 selection:text-white">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/marketing"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Targeting
                </span>
              </div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                Audience Segments
              </h1>
            </div>
          </div>

          <Button
            asChild
            className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            <Link to="/marketing/audiences/new">
              <Plus className="w-4 h-4 mr-2" /> Tạo tập khách hàng
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Danh sách phân tập mục tiêu
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Quản lý các tệp khách hàng được lưu trữ sẵn cho chiến dịch
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-sm">Đang tải danh sách phân tập...</p>
          </div>
        ) : audiences.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800 border-dashed space-y-4">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Chưa có tập khách hàng nào</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Tạo tập khách hàng bằng cách lọc từ cơ sở dữ liệu hiện tại để dễ dàng tiếp cận đúng người, đúng thời điểm.
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-4 bg-slate-900 border-slate-700 text-white hover:bg-slate-800"
            >
              <Link to="/marketing/audiences/new">Bắt đầu tạo Segment</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {audiences.map((aud) => (
              <div
                key={aud.id}
                className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 transition-all space-y-4 group cursor-pointer"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-bold text-slate-100 text-lg leading-tight group-hover:text-indigo-400 transition-colors">
                      {aud.name}
                    </h3>
                    {aud.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{aud.description}</p>
                    )}
                  </div>
                  <div className="bg-slate-800/80 px-2 py-1 rounded-lg text-center flex-shrink-0">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Quy mô</span>
                    <span className="block font-mono text-indigo-400 font-bold">
                      {aud.last_computed_count || "~"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(aud.created_at).toLocaleDateString("vi-VN")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
