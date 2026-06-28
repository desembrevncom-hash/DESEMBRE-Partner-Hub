// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  Rocket,
  Target,
  Users,
  Zap,
  TrendingUp,
  Calendar,
  Search,
  Filter,
  ShieldCheck,
  Plus,
  BarChart3,
  Globe,
  Facebook,
  MessageCircle,
  Award,
  ChevronRight,
  ArrowUpRight,
  MousePointer2,
  Megaphone,
  AlertTriangle,
  Shield,
  XCircle,
  X,
  LayoutTemplate,
  Server,
  Workflow,
  History,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/marketing/")({
  component: MarketingDashboardPage,
});

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

interface SenderWarning {
  type: "error" | "warning";
  message: string;
  link?: string;
}

function MarketingDashboardPage() {
  const { user, isAdmin, isSubAdmin, isSale } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [acquisitionTrend, setAcquisitionTrend] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [senderWarnings, setSenderWarnings] = useState<SenderWarning[]>([]);
  const [showSenderStrip, setShowSenderStrip] = useState(true);

  const [totalLeads, setTotalLeads] = useState(0);
  const [interestedLeads, setInterestedLeads] = useState(0);

  useEffect(() => {
    fetchMarketingData();
    if (isAdmin || isSubAdmin) fetchSenderHealth();
  }, [isAdmin, isSubAdmin]);

  const fetchMarketingData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Lead Sources (Nếu là Sale, ta đếm khách hàng của chính Sale đó theo source)
      let querySource = supabase.from("customers").select("lead_source, id");
      if (isSale && !isAdmin && !isSubAdmin) {
        querySource = querySource.eq("owner_sale_id", user?.id);
      }
      const { data: sourceCusts } = await querySource;

      if (sourceCusts && sourceCusts.length > 0) {
        const counts: Record<string, number> = {};
        sourceCusts.forEach((c) => {
          const src = c.lead_source || "Tự khai thác / Khác";
          counts[src] = (counts[src] || 0) + 1;
        });
        const mappedSources = Object.keys(counts)
          .map((k) => ({
            name: k,
            value: Math.round((counts[k] / sourceCusts.length) * 100),
          }))
          .sort((a, b) => b.value - a.value);
        setSourceData(mappedSources);
      } else {
        setSourceData([
          { name: "Facebook Ads", value: 45 },
          { name: "Workshop Hà Nội", value: 30 },
          { name: "Zalo OA", value: 15 },
          { name: "Referral", value: 10 },
        ]);
      }

      // 2. Tải số lượng Leads thực tế
      let queryCust = supabase.from("customers").select("id", { count: "exact" });
      if (isSale && !isAdmin && !isSubAdmin) {
        queryCust = queryCust.eq("owner_sale_id", user?.id);
      }
      const { count: custCount } = await queryCust;
      setTotalLeads(custCount || 0);

      // 3. Tải số lượng khách hàng quan tâm
      let queryInterested = supabase
        .from("customers")
        .select("id", { count: "exact" })
        .in("lifecycle_stage", ["opportunity", "customer", "promoter"]);
      if (isSale && !isAdmin && !isSubAdmin) {
        queryInterested = queryInterested.eq("owner_sale_id", user?.id);
      }
      const { count: interestedCount } = await queryInterested;
      setInterestedLeads(interestedCount || 0);

      // 4. Fetch Acquisition Trend (Last 6 months) từ DB thật
      const trendData = [];
      const now = new Date();
      let totalLeadsInTrend = 0;
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const monthLabel = `T${d.getMonth() + 1}`;

        let q1 = supabase
          .from("customers")
          .select("id", { count: "exact" })
          .gte("created_at", start)
          .lte("created_at", end);
        let q2 = supabase
          .from("customers")
          .select("id", { count: "exact" })
          .in("lifecycle_stage", ["opportunity", "customer", "promoter"])
          .gte("created_at", start)
          .lte("created_at", end);

        if (isSale && !isAdmin && !isSubAdmin) {
          q1 = q1.eq("owner_sale_id", user?.id);
          q2 = q2.eq("owner_sale_id", user?.id);
        }

        const { count: c1 } = await q1;
        const { count: c2 } = await q2;

        totalLeadsInTrend += c1 || 0;
        trendData.push({
          month: monthLabel,
          leads: c1 || 0,
          conversion: c2 || 0,
        });
      }

      if (totalLeadsInTrend > 0) {
        setAcquisitionTrend(trendData);
      } else {
        setAcquisitionTrend([
          { month: "T1", leads: 40, conversion: 12 },
          { month: "T2", leads: 55, conversion: 18 },
          { month: "T3", leads: 48, conversion: 15 },
          { month: "T4", leads: 70, conversion: 22 },
          { month: "T5", leads: 85, conversion: 28 },
          { month: "T6", leads: 110, conversion: 35 },
        ]);
      }

      // 5. Active Campaigns từ database
      let queryCamps = supabase
        .from("marketing_campaigns")
        .select("*, message_templates(channel, purpose)")
        .in("status", ["approved", "sending", "paused"])
        .order("created_at", { ascending: false });

      if (isSale && !isAdmin && !isSubAdmin) {
        queryCamps = queryCamps.eq("created_by", user?.id);
      }

      const { data: dbCamps } = await queryCamps.limit(5);
      if (dbCamps && dbCamps.length > 0) {
        setCampaigns(
          dbCamps.map((c: any) => {
            const m = c.metrics || { total_targets: 0, sent: 0 };
            return {
              id: c.id,
              name: c.name,
              type: c.message_templates?.channel || "email",
              leads: m.total_targets || 0,
              spend: m.sent ? (m.sent * 80).toLocaleString("vi-VN") + "đ" : "0đ",
              status: c.status,
            };
          }),
        );
      } else {
        setCampaigns([
          {
            id: "1",
            name: "Chiến dịch gửi phác đồ cá nhân",
            type: "email",
            leads: 125,
            spend: "10Kđ",
            status: "active",
          },
          {
            id: "2",
            name: "Zalo chăm sóc khách hàng cũ",
            type: "zalo",
            leads: 45,
            spend: "3.6Kđ",
            status: "paused",
          },
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Sender Health Fetch ───────────────────────────────────────────────────
  const fetchSenderHealth = async () => {
    try {
      const warnings: SenderWarning[] = [];

      // Check business senders
      const { data: biz } = await supabase
        .from("sender_accounts")
        .select("id, name, provider, channel, is_active, health_status, daily_usage, daily_limit");

      if (biz) {
        const noActiveBiz = biz.filter((s: any) => s.is_active).length === 0;
        if (noActiveBiz) {
          warnings.push({
            type: "error",
            message: "Không có Business Sender nào đang hoạt động",
            link: "/admin/sender-accounts",
          });
        }
        biz.forEach((s: any) => {
          if (s.is_active && s.health_status === "error") {
            warnings.push({
              type: "error",
              message: `Sender lỗi: ${s.name} (${s.provider || s.channel})`,
              link: "/admin/sender-accounts",
            });
          } else if (s.is_active && s.health_status === "warning") {
            warnings.push({
              type: "warning",
              message: `Sender cảnh báo: ${s.name}`,
              link: "/admin/sender-accounts",
            });
          }
          const usage = s.daily_usage || 0;
          const limit = s.daily_limit || 500;
          if (limit > 0 && usage / limit > 0.85) {
            warnings.push({
              type: "warning",
              message: `Quota cao: ${s.name} — ${usage}/${limit} (${Math.round((usage / limit) * 100)}%)`,
              link: "/admin/sender-accounts",
            });
          }
        });
      }

      // Check personal senders — disconnected accounts
      const { data: personal } = await supabase
        .from("user_communication_accounts")
        .select("id, platform, account_name, is_active, health_status");

      if (personal) {
        const disconnected = personal.filter(
          (a: any) =>
            a.health_status === "error" || (!a.is_active && a.health_status !== "unknown"),
        );
        if (disconnected.length > 0) {
          warnings.push({
            type: "warning",
            message: `${disconnected.length} tài khoản cá nhân cần kiểm tra lại kết nối`,
            link: "/admin/sender-accounts",
          });
        }
      }

      setSenderWarnings(warnings);
    } catch (e) {
      console.error("Sender health check failed:", e);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      {/* HEADER */}
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-600 flex items-center justify-center text-white shadow-lg shadow-pink-200">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Marketing Hub</h1>
              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest flex items-center gap-1">
                <Zap className="w-3 h-3 fill-pink-500" /> Lead Acquisition & ROI
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <Button
              asChild
              className="rounded-xl bg-pink-600 hover:bg-pink-700 font-black text-xs h-10 px-6 shadow-lg shadow-pink-200 transition-all hover:scale-105 whitespace-nowrap flex-shrink-0"
            >
              <Link to="/marketing/campaigns" search={{ new: "true" }}>
                <Plus className="w-4 h-4 mr-2" /> Tạo chiến dịch mới
              </Link>
            </Button>
          </div>
        </div>
        
        {/* SUB-NAVIGATION BAR */}
        <div className="container mx-auto px-4 pb-4 max-w-7xl">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 overflow-x-auto pb-1 scrollbar-hide">
            {/* Group 1: Core */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" asChild className="rounded-xl border-slate-200 font-bold text-xs h-9 px-4">
                <Link to="/marketing/audiences">
                  <Users className="w-3.5 h-3.5 mr-2" /> Audience Builder
                </Link>
              </Button>
              <Button variant="outline" asChild className="rounded-xl border-slate-200 font-bold text-xs h-9 px-4">
                <Link to="/marketing/campaigns">Quản lý chiến dịch</Link>
              </Button>
              <Button variant="outline" asChild className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs h-9 px-4 gap-2">
                <Link to="/marketing/templates">
                  <LayoutTemplate className="w-3.5 h-3.5" /> Template Library
                </Link>
              </Button>
            </div>

            {/* Group 2 & 3: Readiness & Accounts (Admin Only) */}
            {(isAdmin || isSubAdmin) && (
              <>
                <div className="w-px h-6 bg-slate-200 hidden md:block"></div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" asChild className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold text-xs h-9 px-4 gap-2">
                    <Link to="/marketing/senders">
                      <Server className="w-3.5 h-3.5" /> Sender Readiness
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-xs h-9 px-4 gap-2">
                    <Link to="/marketing/readiness">
                      <AlertTriangle className="w-3.5 h-3.5" /> Marketing Readiness
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="rounded-xl border-cyan-200 text-cyan-700 hover:bg-cyan-50 font-bold text-xs h-9 px-4 gap-2">
                    <Link to="/marketing/providers/readiness">
                      <Server className="w-3.5 h-3.5" /> Provider Readiness (M6)
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs h-9 px-4 gap-2">
                    <Link to="/marketing/send-control">
                      <Rocket className="w-3.5 h-3.5" /> M9 Send Control
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold text-xs h-9 px-4 gap-2">
                    <Link to="/marketing/consent">
                      <ShieldCheck className="w-3.5 h-3.5" /> Consent Registry (M8)
                    </Link>
                  </Button>
                </div>
                
                <div className="w-px h-6 bg-slate-200 hidden md:block"></div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" asChild className="rounded-xl border-violet-200 text-violet-600 hover:bg-violet-50 font-bold text-xs h-9 px-4 gap-2">
                    <Link to="/admin/sender-accounts">
                      <Shield className="w-3.5 h-3.5" /> Sender Accounts
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* M11-M16 Safe Foundation */}
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 mt-3 scrollbar-hide">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg border border-slate-200 mr-1 flex-shrink-0">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Safe Foundation</span>
            </div>
            
            <Button variant="outline" asChild className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-4 gap-2 flex-shrink-0">
              <Link to="/marketing/reports">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-500" /> Analytics (M11)
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-4 gap-2 flex-shrink-0">
              <Link to="/marketing/audiences">
                <Users className="w-3.5 h-3.5 text-blue-500" /> Audiences (M12)
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-4 gap-2 flex-shrink-0">
              <Link to="/marketing/automation">
                <Workflow className="w-3.5 h-3.5 text-violet-500" /> Automation (M13/M14)
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-4 gap-2 flex-shrink-0">
              <Link to="/marketing/automation/events">
                <History className="w-3.5 h-3.5 text-emerald-500" /> QA Events (M15)
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="rounded-xl border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold text-xs h-9 px-4 gap-2 flex-shrink-0">
              <Link to="/marketing/safety">
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" /> Ops Safety (M16)
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* SENDER HEALTH STRIP — admin/subadmin only */}
        {(isAdmin || isSubAdmin) && showSenderStrip && senderWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-amber-800 uppercase tracking-wider">
                  Sender Health Warnings
                </span>
                <Badge className="bg-amber-200 text-amber-800 border-none text-[10px] font-black">
                  {senderWarnings.length}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/admin/sender-accounts"
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition-colors"
                >
                  Xem chi tiết <ChevronRight className="w-3 h-3" />
                </Link>
                <button
                  onClick={() => setShowSenderStrip(false)}
                  className="text-amber-400 hover:text-amber-700 transition-colors"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-amber-100">
              {senderWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  {w.type === "error" ? (
                    <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium text-slate-700 flex-1">{w.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            title="Tổng khách hàng của tôi"
            value={totalLeads.toLocaleString("vi-VN")}
            trend="+12%"
            isUp={true}
            icon={Users}
            color="pink"
          />
          <KpiCard
            title="Chi phí ước lượng"
            value="0đ"
            trend="0%"
            isUp={true}
            icon={Target}
            color="indigo"
          />
          <KpiCard
            title="Tỷ lệ quan tâm thực tế"
            value={
              totalLeads > 0 ? ((interestedLeads / totalLeads) * 100).toFixed(1) + "%" : "0.0%"
            }
            trend="+1.5%"
            isUp={true}
            icon={MousePointer2}
            color="emerald"
          />
          <KpiCard
            title="Ngân sách đã dùng"
            value="0đ"
            trend="0%"
            isUp={false}
            icon={Zap}
            color="amber"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ACQUISITION TREND */}
          <Card className="lg:col-span-2 rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black text-slate-900 tracking-tight">
                  Tăng trưởng Lead & Chuyển đổi
                </CardTitle>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  So sánh số lượng Lead và số đơn hàng chốt được theo tháng
                </p>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-pink-50 text-pink-600 border-none">Lead</Badge>
                <Badge className="bg-emerald-50 text-emerald-600 border-none">Đơn hàng</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={acquisitionTrend}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="#ec4899"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#colorLeads)"
                    />
                    <Area
                      type="monotone"
                      dataKey="conversion"
                      stroke="#10b981"
                      strokeWidth={3}
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* LEAD SOURCE PIE */}
          <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 pb-0">
              <CardTitle className="text-lg font-black text-slate-900 tracking-tight">
                Cơ cấu Nguồn Lead
              </CardTitle>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Nguồn khách hàng hiệu quả nhất
              </p>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-3">
                {sourceData.map((source, idx) => (
                  <div key={source.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      ></div>
                      <span className="text-xs font-bold text-slate-700">{source.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-900">{source.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ACTIVE CAMPAIGNS LIST */}
          <Card className="lg:col-span-3 rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between border-b border-slate-50">
              <div>
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">
                  Danh sách chiến dịch nháp
                </CardTitle>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Kế hoạch chiến dịch đang chuẩn bị
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-indigo-500">
                Xem tất cả <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      <th className="px-8 py-4 text-left">Chiến dịch</th>
                      <th className="px-8 py-4 text-center">Loại hình</th>
                      <th className="px-8 py-4 text-center">Số Lead</th>
                      <th className="px-8 py-4 text-center">Ngân sách <Badge variant="outline" className="ml-1 text-[10px] text-red-500 border-red-200">Demo / Mock Data</Badge></th>
                      <th className="px-8 py-4 text-center">Trạng thái</th>
                      <th className="px-8 py-4 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {campaigns.map((camp) => (
                      <tr key={camp.id} className="hover:bg-slate-50/50 transition-all group">
                        <td className="px-8 py-5">
                          <p className="text-[13px] font-black text-slate-900">{camp.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                            ID: {camp.id}
                          </p>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <Badge
                            variant="outline"
                            className="rounded-lg bg-indigo-50 text-indigo-600 border-indigo-100 font-bold text-[10px] uppercase"
                          >
                            {camp.type}
                          </Badge>
                        </td>
                        <td className="px-8 py-5 text-center font-black text-pink-600">
                          {camp.leads}
                        </td>
                        <td className="px-8 py-5 text-center font-black text-slate-900">
                          {camp.spend}
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${camp.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}
                            ></div>
                            <span
                              className={`text-[11px] font-black uppercase ${camp.status === "active" ? "text-emerald-600" : "text-slate-400"}`}
                            >
                              {camp.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl hover:bg-pink-50 hover:text-pink-600"
                          >
                            <ArrowUpRight className="w-5 h-5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}

function KpiCard({ title, value, trend, isUp, icon: Icon, color }: any) {
  const colorClasses: any = {
    pink: "bg-pink-50 text-pink-600 border-pink-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };

  return (
    <Card className="rounded-[28px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all group-hover:rotate-6 ${colorClasses[color]}`}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div
            className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${isUp ? "text-emerald-600 bg-emerald-50" : "text-rose-500 bg-rose-50"}`}
          >
            {isUp ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <TrendingUp className="w-3 h-3 rotate-180" />
            )}
            {trend}
          </div>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-1">{value}</h3>
      </CardContent>
    </Card>
  );
}
