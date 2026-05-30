// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Target, 
  MapPin, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Calendar,
  LayoutDashboard,
  FileText,
  Zap,
  MoreVertical,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SALES_PIPELINE_STAGES, mapLegacyStageToNew } from "@/lib/salesPipeline";
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";

export const Route = createFileRoute("/reports/")({
  component: AdminAnalyticsPage,
});

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function AdminAnalyticsPage() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [cityData, setCityData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeLeads: 0,
    conversionRate: 0,
    avgOrderValue: 0
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders for Revenue Trend
      const { data: orders } = await supabase
        .from("orders")
        .select("total, created_at, status")
        .neq("status", "cancelled");

      // 2. Fetch Customers for Funnel & Regions
      const { data: customers } = await supabase
        .from("customers")
        .select("lifecycle_stage, city, owner_sale_id, owner_tele_id");

      // Process Revenue Trend (Last 30 days)
      const days = eachDayOfInterval({
        start: subMonths(new Date(), 1),
        end: new Date()
      });

      const trend = days.map(day => {
        const dayOrders = orders?.filter(o => isSameDay(new Date(o.created_at), day)) || [];
        return {
          date: format(day, "dd/MM"),
          revenue: dayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
          orders: dayOrders.length
        };
      });
      setRevenueData(trend);

      // Process Funnel Data
      const funnel = SALES_PIPELINE_STAGES.map(stage => ({
        name: stage.label,
        count: customers?.filter(c => mapLegacyStageToNew(c.lifecycle_stage) === stage.value).length || 0
      }));
      setFunnelData(funnel);

      // Process City Distribution
      const cities: any = {};
      customers?.forEach(c => {
        const city = c.city || "Khác";
        cities[city] = (cities[city] || 0) + 1;
      });
      setCityData(Object.entries(cities).map(([name, value]) => ({ name, value })).sort((a: any, b: any) => b.value - a.value).slice(0, 5));

      // Stats
      const totalRev = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      setStats({
        totalRevenue: totalRev,
        activeLeads: customers?.filter(c => {
          const mapped = mapLegacyStageToNew(c.lifecycle_stage);
          return mapped === 'lead_new' || mapped === 'lead_received';
        }).length || 0,
        conversionRate: customers?.length ? Math.round((customers.filter(c => mapLegacyStageToNew(c.lifecycle_stage) === 'purchased').length / customers.length) * 100) : 0,
        avgOrderValue: orders?.length ? Math.round(totalRev / orders.length) : 0
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <TrendingUp className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-xl font-black text-slate-900">Báo cáo Chiến lược</h1>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                   <Zap className="w-3 h-3 fill-indigo-500" /> Admin Intelligence Hub
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" className="rounded-xl border-slate-200 font-bold text-xs h-10 px-5">
                <Calendar className="w-4 h-4 mr-2 text-slate-400" /> 30 ngày qua
             </Button>
             <Button className="rounded-xl bg-slate-900 hover:bg-black font-black text-xs h-10 px-6 shadow-lg shadow-slate-200 transition-all hover:scale-105">
                <Filter className="w-4 h-4 mr-2" /> Lọc nâng cao
             </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* TOP KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <KpiCard 
             title="Doanh thu thuần" 
             value={`${(stats.totalRevenue / 1000000).toFixed(1)}M`} 
             subValue="VNĐ"
             trend="+15.2%"
             isUp={true}
             icon={ShoppingBag}
             color="indigo"
           />
           <KpiCard 
             title="Lead đang xử lý" 
             value={stats.activeLeads} 
             trend="+8"
             isUp={true}
             icon={Users}
             color="emerald"
           />
           <KpiCard 
             title="Tỷ lệ chốt đơn" 
             value={`${stats.conversionRate}%`} 
             trend="-1.5%"
             isUp={false}
             icon={Target}
             color="amber"
           />
           <KpiCard 
             title="Giá trị đơn TB" 
             value={`${(stats.avgOrderValue / 1000000).toFixed(1)}M`} 
             trend="+4.2%"
             isUp={true}
             icon={Zap}
             color="purple"
           />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* REVENUE TREND CHART */}
           <Card className="lg:col-span-2 rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
                 <div>
                    <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Xu hướng Doanh thu</CardTitle>
                    <p className="text-xs text-slate-400 font-medium mt-1">Biến động doanh số 30 ngày gần nhất</p>
                 </div>
                 <Badge variant="secondary" className="bg-slate-50 text-slate-500 rounded-lg px-3 py-1 font-bold">LIVE</Badge>
              </CardHeader>
              <CardContent className="p-8">
                 <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={revenueData}>
                          <defs>
                             <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }}
                            formatter={(value: any) => [new Intl.NumberFormat('vi-VN').format(value) + 'đ', 'Doanh thu']}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </CardContent>
           </Card>

           {/* CITY DISTRIBUTION */}
           <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-0">
                 <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Khu vực trọng điểm</CardTitle>
                 <p className="text-xs text-slate-400 font-medium mt-1">Top 5 tỉnh thành nhiều khách hàng nhất</p>
              </CardHeader>
              <CardContent className="p-8">
                 <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                            data={cityData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                             {cityData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                          </Pie>
                          <Tooltip />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="mt-4 space-y-3">
                    {cityData.map((city, idx) => (
                       <div key={city.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                             <span className="text-xs font-bold text-slate-700">{city.name}</span>
                          </div>
                          <span className="text-xs font-black text-slate-900">{city.value} KH</span>
                       </div>
                    ))}
                 </div>
              </CardContent>
           </Card>

           {/* SALES FUNNEL */}
           <Card className="lg:col-span-2 rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-0">
                 <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Phễu bán hàng (Sales Funnel)</CardTitle>
                 <p className="text-xs text-slate-400 font-medium mt-1">Phân bổ khách hàng qua 12 giai đoạn Pipeline</p>
              </CardHeader>
              <CardContent className="p-8">
                 <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={funnelData} layout="vertical" margin={{ left: 40 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} width={120} />
                          <Tooltip 
                             cursor={{fill: '#f8fafc'}}
                             contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={20}>
                             {funnelData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index > 6 ? '#10b981' : '#6366f1'} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </CardContent>
           </Card>

           {/* TOP PERFORMERS (SKELETON/MOCK) */}
           <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
                 <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Top Sale Team</CardTitle>
                 <Button variant="ghost" size="icon" className="text-slate-300"><MoreVertical className="w-5 h-5" /></Button>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 {[
                    { name: 'Nguyễn Văn A', role: 'Senior Sale', revenue: '450M', avatar: 'A' },
                    { name: 'Trần Thị B', role: 'Telesale', revenue: '320M', avatar: 'B' },
                    { name: 'Lê Văn C', role: 'Sale', revenue: '280M', avatar: 'C' },
                 ].map((staff, idx) => (
                    <div key={staff.name} className="flex items-center justify-between group">
                       <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black border transition-all group-hover:scale-105 ${idx === 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                             {staff.avatar}
                          </div>
                          <div>
                             <p className="text-[13px] font-black text-slate-900">{staff.name}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{staff.role}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-sm font-black text-slate-900">{staff.revenue}</p>
                          <Badge variant="outline" className="text-[9px] border-emerald-100 text-emerald-600 bg-emerald-50">+5.2%</Badge>
                       </div>
                    </div>
                 ))}
                 <Button variant="ghost" className="w-full rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 mt-4">
                    Xem toàn bộ bảng xếp hạng <ChevronRight className="w-4 h-4 ml-1" />
                 </Button>
              </CardContent>
           </Card>
        </div>
      </main>
    </div>
  );
}

function KpiCard({ title, value, subValue, trend, isUp, icon: Icon, color }: any) {
  const colorClasses: any = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100'
  };

  return (
    <Card className="rounded-[28px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all group">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all group-hover:rotate-6 ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
             </div>
             <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${isUp ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trend}
             </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <div className="flex items-baseline gap-1 mt-1">
             <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3>
             {subValue && <span className="text-xs font-bold text-slate-400 uppercase">{subValue}</span>}
          </div>
       </CardContent>
    </Card>
  );
}
