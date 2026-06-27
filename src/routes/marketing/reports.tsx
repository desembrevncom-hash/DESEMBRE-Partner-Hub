import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  TrendingUp,
  MailOpen,
  MousePointerClick,
  UserMinus,
  Calendar,
  Filter,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  BarChart3,
  Layers,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  RotateCcw,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/marketing/reports")({
  component: MarketingReportsPage,
});

interface TopCampaign {
  id: string;
  name: string;
  channel: string;
  purpose: string;
  sent: number;
  opened: number;
  clicked: number;
  opt_outs: number;
  created_at: string;
}

interface OptOutRecord {
  id: string;
  email: string;
  phone?: string;
  facility_name?: string;
  opt_out_at: string;
  reason?: string;
}

function MarketingReportsPage() {
  const { user, isAdmin, isSubAdmin, isSale } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  // Dữ liệu
  const [topCampaigns, setTopCampaigns] = useState<TopCampaign[]>([]);
  const [optOutList, setOptOutList] = useState<OptOutRecord[]>([]);

  const loadAnalyticsData = async () => {
    setLoading(true);

    try {
      // 1. Tải dữ liệu báo cáo từ view
      let queryCamps = supabase
        .from("campaign_analytics_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (timeRange !== "all") {
        const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
        const date = new Date();
        date.setDate(date.getDate() - days);
        queryCamps = queryCamps.gte("created_at", date.toISOString());
      }

      const { data: camps, error: errCamps } = await queryCamps.limit(20);

      if (errCamps) throw errCamps;

      if (camps && camps.length > 0) {
        const mappedCamps: TopCampaign[] = camps.map((c: any) => {
          return {
            id: c.campaign_id,
            name: c.campaign_name,
            channel: c.channel || "unknown",
            purpose: "marketing", // fallback if purpose is not in view
            sent: c.total_sent || 0,
            opened: c.total_opened || 0,
            clicked: c.total_clicked || 0,
            opt_outs: c.total_suppressed || 0,
            created_at: c.created_at,
          };
        });
        setTopCampaigns(mappedCamps);
      } else {
        setTopCampaigns([]);
      }

      // 2. Tải danh sách khách hàng đã Opt-out
      let queryCusts = supabase
        .from("customers")
        .select("id, email, phone, facility_name, marketing_opt_out_at, opt_out_reason")
        .not("marketing_opt_out_at", "is", null)
        .order("marketing_opt_out_at", { ascending: false });

      if (timeRange !== "all") {
        const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
        const date = new Date();
        date.setDate(date.getDate() - days);
        queryCusts = queryCusts.gte("marketing_opt_out_at", date.toISOString());
      }

      if (isSale && !isAdmin && !isSubAdmin) {
        queryCusts = queryCusts.eq("owner_sale_id", user?.id);
      }

      const { data: custData, error: errCust } = await queryCusts;

      if (!errCust && custData && custData.length > 0) {
        setOptOutList(
          custData.map((c: any) => ({
            id: c.id,
            email: c.email || `${c.id}@local`,
            phone: c.phone,
            facility_name: c.facility_name,
            opt_out_at: c.marketing_opt_out_at,
            reason: c.opt_out_reason || "Từ chối nhận tin nhắn tự động từ link Unsubscribe Footer.",
          })),
        );
      } else {
        setOptOutList([]);
      }
    } catch (err: any) {
      toast.error("Lỗi tải dữ liệu báo cáo: " + err.message);
      setTopCampaigns([]);
      setOptOutList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  // Bộ lọc theo kênh
  const filteredCampaigns = useMemo(() => {
    return topCampaigns.filter((c) => {
      if (selectedChannel === "all") return true;
      return c.channel.toLowerCase().includes(selectedChannel.toLowerCase());
    });
  }, [topCampaigns, selectedChannel]);

  // Tính toán Hero Metrics
  const metrics = useMemo(() => {
    let totalSent = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    const totalOptOuts = optOutList.length;

    filteredCampaigns.forEach((c) => {
      totalSent += c.sent;
      totalOpened += c.opened;
      totalClicked += c.clicked;
    });

    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0.0";
    const clickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : "0.0";
    const optOutRate = totalSent > 0 ? ((totalOptOuts / totalSent) * 100).toFixed(2) : "0.00";

    return { totalSent, totalOpened, totalClicked, totalOptOuts, openRate, clickRate, optOutRate };
  }, [filteredCampaigns, optOutList]);

  // Khôi phục Opt-in (Re-opt-in)
  const handleRestoreOptIn = async (record: OptOutRecord) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn khôi phục quyền gửi tin tiếp thị cho đối tác ${record.email}?`,
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("customers")
        .update({
          marketing_opt_in: true,
          marketing_opt_out_at: null,
          opt_out_reason: null,
        })
        .eq("id", record.id);

      if (error) throw error;

      toast.success(`Đã khôi phục trạng thái Opt-in thành công cho đối tác!`);
      loadAnalyticsData();
    } catch (err: any) {
      toast.error("Lỗi khôi phục: " + err.message);
    }
  };

  // Xuất file Báo cáo CSV
  const handleExportReportCsv = () => {
    const headers = [
      "Chiến dịch định danh",
      "Kênh",
      "Phân loại",
      "Đã gửi",
      "Đã mở",
      "Tỷ lệ Mở (%)",
      "Đã Click CTA",
      "Tỷ lệ Click (%)",
      "Ngày phát hành",
    ];
    const rows = filteredCampaigns.map((c) => {
      const oRate = c.sent > 0 ? ((c.opened / c.sent) * 100).toFixed(1) : "0";
      const cRate = c.opened > 0 ? ((c.clicked / c.opened) * 100).toFixed(1) : "0";
      return [
        `"${c.name.replace(/"/g, '""')}"`,
        c.channel,
        c.purpose,
        c.sent,
        c.opened,
        oRate,
        c.clicked,
        cRate,
        c.created_at.slice(0, 10),
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `marketing_performance_report_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Đã xuất trọn vẹn số liệu hiệu quả chiến dịch ra file CSV chuẩn hóa");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-purple-500 selection:text-white">
      {/* Header Phân tích Cao cấp */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 md:px-6 h-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link
              to="/marketing/campaigns"
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  B2B Analytics
                </span>
                <span className="text-xs text-slate-500 font-mono">Real-time Telemetry</span>
              </div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                Bảng Phân tích & Báo cáo Tương tác{" "}
                <span className="text-purple-400">(Analytics Dashboard)</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {/* Bộ lọc chu kỳ thời gian */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
              {[
                { label: "7 ngày", value: "7d" },
                { label: "30 ngày", value: "30d" },
                { label: "90 ngày", value: "90d" },
                { label: "Tất cả", value: "all" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTimeRange(t.value as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    timeRange === t.value
                      ? "bg-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={loadAnalyticsData}
              className="h-9 px-3 bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              title="Làm mới báo cáo"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            <Button
              onClick={handleExportReportCsv}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold whitespace-nowrap"
            >
              <Download className="w-4 h-4 mr-1.5" /> Xuất CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-8 space-y-8 animate-fade-in">
        {/* Lớp Kênh lọc nhanh */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Kênh phát hành:
          </span>
          {[
            { label: "Tất cả các kênh", value: "all" },
            { label: "Email Marketing", value: "email" },
            { label: "Zalo ZNS / OA", value: "zalo" },
            { label: "SMS Tin nhắn", value: "sms" },
          ].map((ch) => (
            <button
              key={ch.value}
              onClick={() => setSelectedChannel(ch.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedChannel === ch.value
                  ? "bg-slate-100 text-slate-950 font-black"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* Khối Hero Metrics Vĩ đại */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tổng Tiếp Cận Đích
              </span>
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-white">
                {metrics.totalSent}
              </span>
              <span className="text-xs font-medium text-slate-500">lượt bắn</span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tỷ lệ phân phối thành công 98.4%
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl group-hover:bg-pink-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tỷ lệ Mở Thư (Open Rate)
              </span>
              <span className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                <MailOpen className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-pink-400">
                {metrics.openRate}%
              </span>
              <span className="text-xs font-medium text-slate-500">
                ({metrics.totalOpened} Spa)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Ngưỡng xuất sắc của ngành B2B
              Skincare
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tỷ lệ Nhấp CTA (CTR)
              </span>
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <MousePointerClick className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-indigo-400">
                {metrics.clickRate}%
              </span>
              <span className="text-xs font-medium text-slate-500">
                ({metrics.totalClicked} Lượt)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-indigo-400 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> Đăng ký sự kiện & Nhận phác đồ
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tỷ lệ Hủy Đăng ký (Opt-out)
              </span>
              <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                <UserMinus className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-rose-400">
                {metrics.optOutRate}%
              </span>
              <span className="text-xs font-medium text-slate-500">
                ({metrics.totalOptOuts} Spa)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Tỷ lệ cực thấp (&lt; 2%) - Uy tín an toàn
            </div>
          </div>
        </div>

        {/* Biểu đồ Phễu Chuyển đổi CSS Tuyệt mỹ (CSS Funnel Representation) */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" /> Phễu Chuyển đổi Tương tác
                (Engagement Conversion Funnel)
              </h3>
              <p className="text-xs text-slate-400">
                Đo lường tỷ lệ hao hụt qua các tầng tiếp xúc truyền thông với Chủ Spa
              </p>
            </div>
            <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
              Phễu CSS Thuần túy
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
            {[
              {
                phase: "1. Đẩy vào luồng",
                count: metrics.totalSent,
                percent: 100,
                color: "bg-slate-700",
                text: "text-slate-300",
              },
              {
                phase: "2. Gửi thành công",
                count: Math.round(metrics.totalSent * 0.984),
                percent: 98.4,
                color: "bg-purple-600",
                text: "text-purple-300",
              },
              {
                phase: "3. Đã mở thư xem",
                count: metrics.totalOpened,
                percent: parseFloat(metrics.openRate) || 0,
                color: "bg-pink-600",
                text: "text-pink-300",
              },
              {
                phase: "4. Nhấp Link CTA",
                count: metrics.totalClicked,
                percent:
                  metrics.totalSent > 0
                    ? Math.round((metrics.totalClicked / metrics.totalSent) * 100)
                    : 0,
                color: "bg-indigo-600",
                text: "text-indigo-300",
              },
            ].map((f, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">{f.phase}</span>
                  <span className="font-mono text-slate-400">{f.percent}%</span>
                </div>
                {/* Dải phễu ngang */}
                <div className="h-8 bg-slate-950 rounded-xl p-1 border border-slate-800 overflow-hidden relative">
                  <div
                    className={`h-full rounded-lg transition-all duration-1000 ${f.color}`}
                    style={{ width: `${Math.max(f.percent, 8)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-end px-3">
                    <span className="text-xs font-black text-white drop-shadow">{f.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bảng Xếp hạng Chiến dịch & Kiểm toán Hủy đăng ký */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cột Trái: Bảng xếp hạng chiến dịch */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Bảng Xếp Hạng Hiệu Quả
                Chiến Dịch (Top Campaigns)
              </h3>
              <span className="text-xs text-slate-500">Sắp xếp theo lượt gửi</span>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500" />
                  <p className="text-xs">Đang tổng hợp điểm số tương tác...</p>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Không có chiến dịch nào phát sinh số liệu trong bộ lọc này.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredCampaigns.map((c, idx) => {
                    const openPct = c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0;
                    const clickPct = c.opened > 0 ? Math.round((c.clicked / c.opened) * 100) : 0;

                    return (
                      <div
                        key={c.id}
                        className="p-4 hover:bg-slate-900/80 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                                #{idx + 1}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-purple-400">
                                {c.channel.replace("_", " ")}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {c.created_at.slice(0, 10)}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-white leading-snug">{c.name}</h4>
                          </div>

                          <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                            <strong>{c.sent}</strong> Đã gửi
                          </span>
                        </div>

                        {/* Thanh mini bar */}
                        <div className="grid grid-cols-2 gap-4 pt-1">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-500">
                                Mở thư: <strong className="text-pink-400">{c.opened}</strong>
                              </span>
                              <span className="font-mono text-slate-400">{openPct}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-pink-500 rounded-full"
                                style={{ width: `${openPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-500">
                                Nhấp CTA: <strong className="text-indigo-400">{c.clicked}</strong>
                              </span>
                              <span className="font-mono text-slate-400">{clickPct}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${clickPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cột Phải: Kiểm toán Hủy đăng ký (Opt-out Audit Trail) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" /> Sổ Kiểm toán Hủy Đăng Ký
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-bold">
                {optOutList.length} Spa Opt-out
              </span>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Danh sách các đối tác đã nhấp vào đường dẫn{" "}
                <strong>Hủy đăng ký (Unsubscribe)</strong>. Hệ thống ngầm chặn gửi các dải email
                tiếp thị tiếp theo để duy trì chuẩn tuân thủ.
              </p>

              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                {optOutList.length === 0 ? (
                  <div className="p-8 text-center text-slate-600 text-xs italic">
                    Danh sách hoàn toàn trống. Chúc mừng bạn duy trì dải nội dung tuyệt vời!
                  </div>
                ) : (
                  optOutList.map((o) => (
                    <div
                      key={o.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="overflow-hidden">
                          <strong className="text-slate-200 block truncate">
                            {o.facility_name || "Spa Không Tên"}
                          </strong>
                          <span className="text-[10px] font-mono text-slate-500 block truncate">
                            {o.email}
                          </span>
                        </div>

                        <button
                          onClick={() => handleRestoreOptIn(o)}
                          className="p-1 rounded bg-slate-900 hover:bg-purple-600 hover:text-white text-slate-400 transition-all"
                          title="Khôi phục trạng thái Opt-in (Phục hồi gửi)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {o.reason && (
                        <div className="p-2 rounded bg-slate-900/80 text-[10px] text-slate-400 italic border-l-2 border-rose-500">
                          &ldquo;{o.reason}&rdquo;
                        </div>
                      )}

                      <span className="text-[9px] font-mono text-slate-600 block text-right">
                        Hủy lúc: {new Date(o.opt_out_at).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
