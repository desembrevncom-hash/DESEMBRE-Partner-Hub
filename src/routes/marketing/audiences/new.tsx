import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Save, Users, RefreshCw, Filter, List, Loader2 } from "lucide-react";
import { applySegmentRulesToQuery, SegmentRules } from "@/lib/marketing/segmentRules";

export const Route = createFileRoute("/marketing/audiences/new")({
  component: AudienceBuilderPage,
});

function AudienceBuilderPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const [rules, setRules] = useState<SegmentRules>({
    has_email: false,
    has_phone: false,
    exclude_opt_outs: true,
    lifecycle_stages: [],
  });

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<any[]>([]);
  const [isCounting, setIsCounting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Debounce preview update
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview();
    }, 500);
    return () => clearTimeout(timer);
  }, [rules]);

  const fetchPreview = async () => {
    setIsCounting(true);
    try {
      // 1. Fetch exact count
      let countQuery = supabase.from("customers").select("*", { count: "exact", head: true });
      countQuery = applySegmentRulesToQuery(countQuery, rules);
      const { count, error: countErr } = await countQuery;
      if (countErr) throw countErr;
      
      setPreviewCount(count);

      // 2. Fetch sample (max 5)
      let sampleQuery = supabase.from("customers").select("id, facility_name, email, phone, lifecycle_stage").limit(5);
      sampleQuery = applySegmentRulesToQuery(sampleQuery, rules);
      const { data: sampleData, error: sampleErr } = await sampleQuery;
      if (sampleErr) throw sampleErr;
      
      setPreviewSample(sampleData || []);
    } catch (err: any) {
      toast.error("Lỗi khi tải preview: " + err.message);
    } finally {
      setIsCounting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên tập khách hàng");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("marketing_audiences").insert({
        name,
        description,
        rules,
        last_computed_count: previewCount || 0,
      });

      if (error) throw error;
      toast.success("Đã lưu tập khách hàng thành công!");
      navigate({ to: "/marketing/audiences" });
    } catch (err: any) {
      toast.error("Lỗi khi lưu: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLifecycleChange = (stage: string, checked: boolean) => {
    setRules((prev) => {
      const current = prev.lifecycle_stages || [];
      if (checked) return { ...prev, lifecycle_stages: [...current, stage] };
      return { ...prev, lifecycle_stages: current.filter((s) => s !== stage) };
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-indigo-500 selection:text-white">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/marketing/audiences"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                Tạo tập khách hàng mới
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-10 px-4 rounded-xl border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              onClick={() => setRules({ has_email: false, has_phone: false, exclude_opt_outs: true, lifecycle_stages: [] })}
            >
              Xóa bộ lọc
            </Button>
            <Button
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/20"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Lưu Segment
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Builder Section */}
          <div className="lg:col-span-2 space-y-6">
            <section className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="font-bold text-lg text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <List className="w-5 h-5 text-indigo-400" /> Thông tin cơ bản
              </h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-400">Tên tập khách hàng *</Label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="VD: Khách hàng tiềm năng tháng này" 
                    className="mt-1 bg-slate-950 border-slate-700 text-white focus-visible:ring-indigo-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Mô tả (Tuỳ chọn)</Label>
                  <Input 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Ghi chú về mục đích sử dụng..." 
                    className="mt-1 bg-slate-950 border-slate-700 text-white focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
            </section>

            <section className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="font-bold text-lg text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Filter className="w-5 h-5 text-indigo-400" /> Bộ lọc Audience (Segment Rules)
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Channel Filters */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Kênh liên lạc</h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="has_email" 
                      checked={rules.has_email} 
                      onCheckedChange={(c) => setRules({...rules, has_email: !!c})}
                      className="border-slate-600 data-[state=checked]:bg-indigo-500"
                    />
                    <Label htmlFor="has_email" className="text-sm text-slate-300 cursor-pointer">Bắt buộc có Email</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="has_phone" 
                      checked={rules.has_phone} 
                      onCheckedChange={(c) => setRules({...rules, has_phone: !!c})}
                      className="border-slate-600 data-[state=checked]:bg-indigo-500"
                    />
                    <Label htmlFor="has_phone" className="text-sm text-slate-300 cursor-pointer">Bắt buộc có Số điện thoại</Label>
                  </div>
                </div>

                {/* Consent Filters */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Sự đồng thuận</h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="exclude_opt_outs" 
                      checked={rules.exclude_opt_outs} 
                      onCheckedChange={(c) => setRules({...rules, exclude_opt_outs: !!c})}
                      className="border-slate-600 data-[state=checked]:bg-indigo-500"
                    />
                    <Label htmlFor="exclude_opt_outs" className="text-sm text-slate-300 cursor-pointer text-emerald-400">
                      Loại trừ người đã Opt-out (Khuyên dùng)
                    </Label>
                  </div>
                </div>

                {/* Date Filters */}
                <div className="space-y-3 md:col-span-2 border-t border-slate-800 pt-4">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Thời gian tạo (Created At)</h3>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-slate-500">Từ ngày</Label>
                      <Input 
                        type="date" 
                        value={rules.created_after || ""}
                        onChange={(e) => setRules({...rules, created_after: e.target.value})}
                        className="mt-1 bg-slate-950 border-slate-700 text-white [color-scheme:dark]"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-slate-500">Đến ngày</Label>
                      <Input 
                        type="date" 
                        value={rules.created_before || ""}
                        onChange={(e) => setRules({...rules, created_before: e.target.value})}
                        className="mt-1 bg-slate-950 border-slate-700 text-white [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                {/* Lifecycle Filters */}
                <div className="space-y-3 md:col-span-2 border-t border-slate-800 pt-4">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Vòng đời (Lifecycle Stage)</h3>
                  <div className="flex flex-wrap gap-4">
                    {["Lead", "Opportunity", "Customer", "Churned"].map(stage => (
                      <div key={stage} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`stage_${stage}`} 
                          checked={(rules.lifecycle_stages || []).includes(stage)}
                          onCheckedChange={(c) => handleLifecycleChange(stage, !!c)}
                          className="border-slate-600 data-[state=checked]:bg-indigo-500"
                        />
                        <Label htmlFor={`stage_${stage}`} className="text-sm text-slate-300 cursor-pointer">{stage}</Label>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </section>
          </div>

          {/* Preview Section */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-indigo-950/30 border border-indigo-500/20 sticky top-28">
              <h2 className="font-bold text-lg text-white flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-indigo-400" /> Live Preview
              </h2>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between mb-6">
                <span className="text-slate-400 font-medium">Khách hàng thoả mãn:</span>
                {isCounting ? (
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                ) : (
                  <span className="text-2xl font-black text-indigo-400">{previewCount ?? "~"}</span>
                )}
              </div>

              {previewSample.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Mẫu khách hàng (Tối đa 5)</h3>
                  <div className="space-y-2">
                    {previewSample.map(c => (
                      <div key={c.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm">
                        <div className="font-medium text-slate-200 line-clamp-1">{c.facility_name || "Chưa có tên"}</div>
                        <div className="text-xs text-slate-500 mt-1 flex gap-2">
                          {c.email && <span>Email</span>}
                          {c.phone && <span>SĐT</span>}
                          <span className="bg-slate-800 px-1.5 rounded">{c.lifecycle_stage || "N/A"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
