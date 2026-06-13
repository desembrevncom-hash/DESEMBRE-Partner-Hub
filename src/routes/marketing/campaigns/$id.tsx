import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { evaluateAudience } from "@/lib/marketing/segmentRules";
import { downloadCustomerExport } from "@/lib/customers/customerExportBuilder";
import {
  Megaphone,
  ArrowLeft,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Archive,
  Calendar,
  Users,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/marketing/campaigns/$id")({
  beforeLoad: ({ context }) => {
    const { auth } = context as any;
    if (auth && (auth.isSale || auth.isTele || auth.isTeleLead)) {
      throw redirect({ to: "/marketing" });
    }
  },
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, isSale, isTele, isTeleLead } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const { data: campaign, isLoading, refetch } = useQuery({
    queryKey: ["marketing-campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select(`
          *,
          created_by_user:created_by (email),
          archived_by_user:archived_by (email)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    }
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

  const handleExport = async () => {
    if (!campaign?.segment_rules_snapshot_json) return;
    try {
      setIsExporting(true);
      toast.info("Đang xử lý dữ liệu xuất Excel...");
      
      const { data: customers, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      
      const matched = evaluateAudience(customers || [], campaign.segment_rules_snapshot_json as any);
      
      if (matched.length === 0) {
        toast.warning("Không có khách hàng nào khớp với điều kiện lọc (Snapshot).");
        return;
      }
      
      const customFileName = `Campaign_${campaign.name}_${new Date().toISOString().slice(0, 10)}.xlsx`.replace(/\s+/g, '_');
      await downloadCustomerExport(matched, "segment", customFileName);
      toast.success(`Đã xuất thành công ${matched.length} khách hàng.`);
    } catch (e: any) {
      console.error(e);
      toast.error("Lỗi khi xuất tệp: " + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchive = async () => {
    if (!user || !campaign) return;
    if (!confirm("Bạn có chắc chắn muốn lưu trữ chiến dịch này?")) return;

    try {
      setIsArchiving(true);
      const { error } = await supabase
        .from("marketing_campaigns")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .eq("id", campaign.id);

      if (error) throw error;
      toast.success("Đã lưu trữ chiến dịch.");
      refetch();
    } catch (e: any) {
      console.error(e);
      toast.error("Lỗi khi lưu trữ: " + e.message);
    } finally {
      setIsArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-2xl font-black text-slate-900">Không tìm thấy chiến dịch</h2>
        <Button asChild className="mt-4 rounded-xl">
          <Link to="/marketing/campaigns">Quay lại</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-4xl">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-slate-100">
              <Link to="/marketing/campaigns">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">{campaign.name}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            {campaign.status !== "archived" && (
              <Button
                variant="outline"
                onClick={handleArchive}
                disabled={isArchiving}
                className="rounded-xl border-slate-200 font-bold text-xs hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
              >
                {isArchiving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
                Lưu trữ chiến dịch
              </Button>
            )}
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-200 transition-all hover:scale-105"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              Xuất tệp Excel
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-amber-800">Module này chỉ lập kế hoạch và xuất tệp</h4>
            <p className="text-xs font-medium text-amber-700 mt-1">
              Chưa gửi chiến dịch tự động. Tệp khách hàng xuất ra sẽ dựa trên điều kiện của nhóm khách hàng <strong>{campaign.segment_name_snapshot}</strong> đã được chụp lại lúc tạo chiến dịch.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="rounded-[24px] border-none shadow-sm">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-500" />
                  Mục tiêu & Nội dung
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mục tiêu</h4>
                  <p className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {campaign.objective || <span className="text-slate-400 italic">Không có mục tiêu cụ thể</span>}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nội dung nháp</h4>
                  <div className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap min-h-[100px]">
                    {campaign.message_content || <span className="text-slate-400 italic">Chưa soạn nội dung</span>}
                  </div>
                </div>
                {campaign.notes && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ghi chú nội bộ</h4>
                    <p className="text-sm font-medium text-slate-700 bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 whitespace-pre-wrap">
                      {campaign.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[24px] border-none shadow-sm">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-pink-500" />
                  Thông tin chung
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Trạng thái</h4>
                  <Badge 
                    variant="outline" 
                    className={`rounded-lg font-bold text-[11px] uppercase ${
                      campaign.status === 'archived' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                      campaign.status === 'ready_for_export' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                      'bg-amber-50 text-amber-600 border-amber-200'
                    }`}
                  >
                    {campaign.status}
                  </Badge>
                </div>
                
                <div className="pt-2 border-t border-slate-50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Kênh dự kiến</h4>
                  <Badge variant="outline" className="rounded-lg bg-indigo-50 text-indigo-600 border-indigo-100 font-bold text-[11px] uppercase">
                    {campaign.intended_channel.replace('_manual', '').replace('_', ' ')}
                  </Badge>
                </div>

                <div className="pt-2 border-t border-slate-50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ngày tạo</h4>
                  <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {new Date(campaign.created_at).toLocaleDateString("vi-VN")}
                  </div>
                </div>

                {campaign.archived_at && (
                  <div className="pt-2 border-t border-slate-50">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ngày lưu trữ</h4>
                    <div className="flex items-center gap-2 text-sm font-black text-slate-500">
                      <Archive className="w-4 h-4" />
                      {new Date(campaign.archived_at).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-none shadow-sm bg-gradient-to-br from-indigo-50 to-white border border-indigo-50">
              <CardContent className="p-6">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Tệp khách hàng
                </h4>
                <p className="text-sm font-bold text-indigo-900 mb-4">
                  {campaign.segment_name_snapshot}
                </p>
                <div className="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số lượng Snapshot</p>
                  <p className="text-3xl font-black text-indigo-600 tracking-tighter">
                    {campaign.audience_snapshot_count.toLocaleString("vi-VN")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
