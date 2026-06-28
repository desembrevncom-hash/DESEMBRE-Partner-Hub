import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, AlertCircle, RefreshCw, Users, ShieldAlert, GitBranch, Zap, Clock, Play } from "lucide-react";

export const Route = createFileRoute("/marketing/automation/new")({
  component: AutomationCreatePage,
});

function AutomationCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("audience_member_added");
  const [audienceId, setAudienceId] = useState("");
  const [delayAmount, setDelayAmount] = useState(0);
  const [delayUnit, setDelayUnit] = useState("minutes");
  const [actionType, setActionType] = useState("create_mock_dispatch");
  
  const [audiences, setAudiences] = useState<any[]>([]);
  const [isLoadingAudiences, setIsLoadingAudiences] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAudiences();
  }, []);

  const fetchAudiences = async () => {
    try {
      const { data, error } = await supabase
        .from("marketing_audiences")
        .select("id, name, last_computed_count")
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      setAudiences(data || []);
      if (data && data.length > 0) {
        setAudienceId(data[0].id);
      }
    } catch (err: any) {
      toast.error("Lỗi khi tải tập khách hàng: " + err.message);
    } finally {
      setIsLoadingAudiences(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên Workflow");
      return;
    }
    if (!audienceId && triggerType === "audience_member_added") {
      toast.error("Vui lòng chọn một Tập khách hàng (Audience)");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("marketing_automation_workflows").insert({
        name,
        description,
        trigger_type: triggerType,
        audience_id: audienceId || null,
        delay_amount: delayAmount,
        delay_unit: delayUnit,
        action_type: actionType,
        status: "draft",
        mock_only: true, // FORCED BY REQUIREMENT
      });

      if (error) throw error;
      toast.success("Đã tạo Workflow an toàn thành công!");
      navigate({ to: "/marketing/automation" });
    } catch (err: any) {
      toast.error("Lỗi lưu workflow: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-indigo-500 selection:text-white">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/marketing/automation"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                Tạo Workflow mới
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/20"
              onClick={handleSave}
              disabled={isSaving || audiences.length === 0}
            >
              {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Lưu dưới dạng Draft
            </Button>
          </div>
        </div>
      </header>

      {/* MOCK BANNER */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 p-3 flex justify-center items-center">
        <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4" />
          MOCK ONLY / NO REAL SEND - Dữ liệu sẽ chỉ được log chứ không gửi tin nhắn thật.
        </div>
      </div>

      <main className="container mx-auto px-4 md:px-6 mt-8 max-w-4xl">
        {isLoadingAudiences ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : audiences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
            <Users className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-white">Chưa có Tập khách hàng (Audience) nào</h3>
            <p className="text-slate-400 max-w-md mt-2 mb-6">
              Bạn cần ít nhất một tập khách hàng để kích hoạt các kịch bản tự động hoá. Hãy tạo một tập khách hàng trước khi tiếp tục.
            </p>
            <Button
              asChild
              className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              <Link to="/marketing/audiences/new">Tạo Audience ngay</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Info Section */}
            <section className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="font-bold text-lg text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <GitBranch className="w-5 h-5 text-indigo-400" /> Thông tin cơ bản
              </h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-400">Tên Workflow *</Label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="VD: Chào mừng khách hàng mới tháng 11" 
                    className="mt-1 bg-slate-950 border-slate-700 text-white focus-visible:ring-indigo-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Mô tả (Tuỳ chọn)</Label>
                  <Input 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Ghi chú về luồng automation..." 
                    className="mt-1 bg-slate-950 border-slate-700 text-white focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* TRIGGER CONFIG */}
              <section className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4 md:col-span-1 flex flex-col relative before:hidden md:before:block before:absolute before:-right-3 before:top-1/2 before:w-6 before:h-0.5 before:bg-slate-700">
                <h2 className="font-bold text-base text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Zap className="w-5 h-5" /> 1. Trigger
                </h2>
                <div className="space-y-4 flex-1">
                  <div>
                    <Label className="text-slate-400 mb-1 block">Điều kiện kích hoạt</Label>
                    <select 
                      value={triggerType}
                      onChange={(e) => setTriggerType(e.target.value)}
                      className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="audience_member_added">Khách lọt vào Audience</option>
                      <option value="customer_created">Khách hàng mới được tạo</option>
                      <option value="manual_test_trigger">Kích hoạt thủ công (Test)</option>
                    </select>
                  </div>

                  {triggerType === "audience_member_added" && (
                    <div>
                      <Label className="text-slate-400 mb-1 block">Tập khách hàng (Audience)</Label>
                      <select 
                        value={audienceId}
                        onChange={(e) => setAudienceId(e.target.value)}
                        className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {audiences.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.last_computed_count} người)</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </section>

              {/* DELAY CONFIG */}
              <section className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4 md:col-span-1 flex flex-col relative before:hidden md:before:block before:absolute before:-right-3 before:top-1/2 before:w-6 before:h-0.5 before:bg-slate-700">
                <h2 className="font-bold text-base text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Clock className="w-5 h-5" /> 2. Delay
                </h2>
                <div className="space-y-4 flex-1">
                  <div>
                    <Label className="text-slate-400 mb-1 block">Chờ bao lâu?</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number"
                        min="0"
                        value={delayAmount}
                        onChange={(e) => setDelayAmount(parseInt(e.target.value) || 0)}
                        className="bg-slate-950 border-slate-700 text-white focus-visible:ring-indigo-500"
                      />
                      <select 
                        value={delayUnit}
                        onChange={(e) => setDelayUnit(e.target.value)}
                        className="h-10 px-3 rounded-md bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="minutes">Phút</option>
                        <option value="hours">Giờ</option>
                        <option value="days">Ngày</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">Ví dụ: 0 phút sẽ gửi ngay lập tức.</p>
                  </div>
                </div>
              </section>

              {/* ACTION CONFIG */}
              <section className="p-6 rounded-3xl bg-blue-950/20 border border-blue-900/50 space-y-4 md:col-span-1 flex flex-col">
                <h2 className="font-bold text-base text-blue-400 flex items-center gap-2 border-b border-blue-900/50 pb-3">
                  <Play className="w-5 h-5" /> 3. Action
                </h2>
                <div className="space-y-4 flex-1">
                  <div>
                    <Label className="text-slate-400 mb-1 block">Hành động (Mock)</Label>
                    <select 
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="create_mock_dispatch">Tạo Mock Dispatch</option>
                      <option value="add_to_mock_queue">Thêm vào Mock Queue</option>
                      <option value="log_only">Chỉ ghi Log event</option>
                    </select>
                    <p className="text-[10px] text-blue-400/70 mt-2">Tính năng đang ở chế độ MVP an toàn. Không có tin nhắn nào thực sự được gửi.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
