import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAudienceStats } from "@/lib/marketing/segmentRules";
import {
  Megaphone,
  ArrowLeft,
  Save,
  Users,
  Target,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/marketing/campaigns/new")({
  beforeLoad: ({ context }) => {
    const { auth } = context as any;
    if (auth && (auth.isSale || auth.isTele || auth.isTeleLead)) {
      throw redirect({ to: "/marketing" });
    }
  },
  component: NewCampaignPage,
});

function NewCampaignPage() {
  const navigate = useNavigate();
  const { user, isSale, isTele, isTeleLead } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      name: "",
      segment_id: "",
      intended_channel: "export_only",
      objective: "",
      message_content: "",
      notes: "",
      status: "draft"
    }
  });

  const selectedSegmentId = watch("segment_id");

  const { data: segments, isLoading: loadingSegments } = useQuery({
    queryKey: ["marketing-segments-for-campaign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_segments")
        .select("*")
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: matchedCount, isLoading: evaluatingCount } = useQuery({
    queryKey: ["evaluate-segment", selectedSegmentId],
    queryFn: async () => {
      if (!selectedSegmentId || !segments) return 0;
      const segment = segments.find(s => s.id === selectedSegmentId);
      if (!segment) return 0;

      const { data: customers, error } = await supabase.from("customers").select("*");
      if (error) throw error;

      if (!customers) return 0;
      const stats = getAudienceStats(customers, segment.filter_rules_json as any);
      return stats.matched_customers;
    },
    enabled: !!selectedSegmentId && !!segments
  });

  if (isSale || isTele || isTeleLead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Truy cập bị từ chối</h2>
        <Button asChild className="mt-6 rounded-xl font-bold bg-slate-900 text-white">
          <Link to="/marketing">Quay lại Marketing Hub</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = async (data: any) => {
    if (!user) return;
    
    const segment = segments?.find(s => s.id === data.segment_id);
    if (!segment) {
      toast.error("Vui lòng chọn nhóm khách hàng hợp lệ");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const count = matchedCount || 0;

      const { data: newCampaign, error } = await supabase
        .from("marketing_campaigns")
        .insert({
          name: data.name,
          objective: data.objective,
          segment_id: segment.id,
          segment_name_snapshot: segment.name,
          segment_rules_snapshot_json: segment.filter_rules_json,
          intended_channel: data.intended_channel,
          message_content: data.message_content,
          notes: data.notes,
          status: data.status,
          audience_snapshot_count: count,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Đã tạo chiến dịch thành công");
      navigate({ to: `/marketing/campaigns/${newCampaign.id}` });
    } catch (e: any) {
      console.error(e);
      toast.error("Lỗi khi tạo chiến dịch: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-3xl">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-slate-100">
              <Link to="/marketing/campaigns">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Tạo chiến dịch</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-amber-800">Module này chỉ lập kế hoạch và xuất tệp</h4>
            <p className="text-xs font-medium text-amber-700 mt-1">
              Chưa gửi chiến dịch tự động. Tệp khách hàng sẽ được snapshot (chụp) ngay lúc này để giữ nguyên điều kiện lọc khi xuất Excel sau này.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="rounded-[24px] border-none shadow-sm">
            <CardContent className="p-8 space-y-6">
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tên chiến dịch <span className="text-rose-500">*</span>
                </Label>
                <Input 
                  {...register("name", { required: true, minLength: 1 })} 
                  placeholder="VD: Khuyến mãi tết 2026..." 
                  className="rounded-xl border-slate-200"
                />
                {errors.name && <p className="text-[10px] font-bold text-rose-500">Tên chiến dịch là bắt buộc</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nhóm khách hàng (Segment) <span className="text-rose-500">*</span>
                </Label>
                {loadingSegments ? (
                  <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center px-3">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />
                    <span className="text-sm text-slate-500">Đang tải segment...</span>
                  </div>
                ) : (
                  <Select 
                    value={selectedSegmentId} 
                    onValueChange={(val) => setValue("segment_id", val, { shouldValidate: true })}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200">
                      <SelectValue placeholder="Chọn nhóm khách hàng đã lưu" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {segments?.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.segment_id && <p className="text-[10px] font-bold text-rose-500">Vui lòng chọn nhóm khách hàng</p>}
                
                {selectedSegmentId && (
                  <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-700 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Khách hàng khớp điều kiện (Snapshot)
                    </span>
                    {evaluatingCount ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    ) : (
                      <span className="text-sm font-black text-indigo-700">{matchedCount?.toLocaleString('vi-VN')}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Kênh dự kiến <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={watch("intended_channel")} 
                  onValueChange={(val) => setValue("intended_channel", val)}
                >
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Chọn kênh" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="call">Telesale (Call)</SelectItem>
                    <SelectItem value="zalo_manual">Zalo (Thủ công)</SelectItem>
                    <SelectItem value="email_manual">Email (Thủ công)</SelectItem>
                    <SelectItem value="facebook_manual">Facebook (Thủ công)</SelectItem>
                    <SelectItem value="export_only">Chỉ xuất tệp (Export Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Trạng thái <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={watch("status")} 
                  onValueChange={(val) => setValue("status", val)}
                >
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="draft">Bản nháp (Draft)</SelectItem>
                    <SelectItem value="ready_for_export">Sẵn sàng xuất tệp (Ready)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-none shadow-sm">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mục tiêu chiến dịch
                </Label>
                <Textarea 
                  {...register("objective")} 
                  placeholder="VD: Tăng tỷ lệ mua lại sản phẩm kem chống nắng..."
                  className="rounded-xl border-slate-200 min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nội dung nháp
                </Label>
                <Textarea 
                  {...register("message_content")} 
                  placeholder="Soạn nội dung dự kiến sẽ gửi..."
                  className="rounded-xl border-slate-200 min-h-[120px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Ghi chú nội bộ
                </Label>
                <Textarea 
                  {...register("notes")} 
                  placeholder="Ghi chú thêm cho team..."
                  className="rounded-xl border-slate-200 min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" asChild className="rounded-xl font-bold h-12 px-6">
              <Link to="/marketing/campaigns">Hủy</Link>
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || evaluatingCount}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 px-8 shadow-lg shadow-indigo-200 transition-all hover:scale-105"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <Save className="w-5 h-5 mr-2" /> Lưu bản nháp
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
