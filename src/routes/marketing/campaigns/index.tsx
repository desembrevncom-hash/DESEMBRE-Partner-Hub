import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Megaphone,
  Plus,
  AlertTriangle,
  FileSpreadsheet,
  Archive,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/marketing/campaigns/")({
  beforeLoad: ({ context }) => {
    const { auth } = context as any;
    if (auth && (auth.isSale || auth.isTele || auth.isTeleLead)) {
      throw redirect({ to: "/marketing" });
    }
  },
  component: MarketingCampaignsPage,
});

function MarketingCampaignsPage() {
  const { isSale, isTele, isTeleLead } = useAuth();
  const [showArchived, setShowArchived] = useState(false);

  if (isSale || isTele || isTeleLead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Truy cập bị từ chối</h2>
        <p className="text-slate-500 mt-2 font-medium max-w-md">
          Tính năng lập kế hoạch chiến dịch hiện chỉ dành cho Admin và Sub-admin. Vui lòng liên hệ quản lý để được hỗ trợ.
        </p>
        <Button asChild className="mt-6 rounded-xl font-bold bg-slate-900 text-white">
          <Link to="/marketing">Quay lại Marketing Hub</Link>
        </Button>
      </div>
    );
  }

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["marketing-campaigns", showArchived],
    queryFn: async () => {
      let query = supabase
        .from("marketing_campaigns")
        .select(`
          id, name, objective, intended_channel, status, audience_snapshot_count, created_at,
          marketing_segments(name)
        `)
        .order("created_at", { ascending: false });

      if (!showArchived) {
        query = query.neq("status", "archived");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Quản lý chiến dịch</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                Chiến dịch nháp & Lập kế hoạch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowArchived(!showArchived)}
              className="rounded-xl border-slate-200 font-bold text-xs h-10 px-5"
            >
              <Archive className="w-4 h-4 mr-2" /> 
              {showArchived ? "Ẩn chiến dịch lưu trữ" : "Xem chiến dịch lưu trữ"}
            </Button>
            <Button
              asChild
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-xs h-10 px-6 shadow-lg shadow-indigo-200 transition-all hover:scale-105"
            >
              <Link to="/marketing/campaigns/new">
                <Plus className="w-4 h-4 mr-2" /> Tạo chiến dịch
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-amber-800">Cảnh báo tính năng</h4>
            <p className="text-xs font-medium text-amber-700 mt-1">
              Module này chỉ lập kế hoạch và xuất tệp, chưa gửi chiến dịch tự động. Mọi chiến dịch được tạo ở đây chỉ mang tính chất nháp (Draft) và dùng để trích xuất dữ liệu Excel thủ công.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-8 py-5 text-left">Tên chiến dịch</th>
                  <th className="px-8 py-5 text-left">Nhóm khách hàng</th>
                  <th className="px-8 py-5 text-center">Kênh dự kiến</th>
                  <th className="px-8 py-5 text-center">Số lượng</th>
                  <th className="px-8 py-5 text-center">Trạng thái</th>
                  <th className="px-8 py-5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-10 text-center text-slate-400 font-medium">
                      Đang tải danh sách...
                    </td>
                  </tr>
                ) : campaigns?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-10 text-center text-slate-400 font-medium">
                      Không có chiến dịch nào.
                    </td>
                  </tr>
                ) : (
                  campaigns?.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-8 py-5">
                        <Link to={`/marketing/campaigns/${camp.id}`} className="block">
                          <p className="text-[14px] font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {camp.name}
                          </p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1">
                            {new Date(camp.created_at).toLocaleDateString("vi-VN")}
                          </p>
                        </Link>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-[12px] font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
                          {camp.marketing_segments?.name || "Không rõ"}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <Badge variant="outline" className="rounded-lg bg-indigo-50 text-indigo-600 border-indigo-100 font-bold text-[10px] uppercase">
                          {camp.intended_channel.replace('_manual', '').replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-8 py-5 text-center font-black text-pink-600">
                        {camp.audience_snapshot_count.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-8 py-5 text-center">
                        <Badge 
                          variant="outline" 
                          className={`rounded-lg font-bold text-[10px] uppercase ${
                            camp.status === 'archived' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                            camp.status === 'ready_for_export' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            'bg-amber-50 text-amber-600 border-amber-200'
                          }`}
                        >
                          {camp.status}
                        </Badge>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="rounded-xl hover:bg-indigo-50 hover:text-indigo-600 font-bold text-xs"
                        >
                          <Link to={`/marketing/campaigns/${camp.id}`}>
                            Chi tiết <ChevronRight className="w-4 h-4 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
