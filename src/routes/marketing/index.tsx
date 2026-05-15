import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
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
  Plus,
  BarChart3,
  Globe,
  Facebook,
  MessageCircle,
  Award,
  ChevronRight,
  ArrowUpRight,
  MousePointer2,
  Megaphone
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/marketing/")({
  component: MarketingDashboardPage,
});

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

function MarketingDashboardPage() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [acquisitionTrend, setAcquisitionTrend] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    fetchMarketingData();
  }, []);

  const fetchMarketingData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Lead Sources (Mocking logic for now since we need to join customers & campaigns)
      const mockSources = [
        { name: 'Facebook Ads', value: 45 },
        { name: 'Workshop Hà Nội', value: 30 },
        { name: 'Zalo OA', value: 15 },
        { name: 'Referral', value: 10 }
      ];
      setSourceData(mockSources);

      // 2. Fetch Acquisition Trend (Last 6 months)
      const mockTrend = [
        { month: 'T1', leads: 40, conversion: 12 },
        { month: 'T2', leads: 55, conversion: 18 },
        { month: 'T3', leads: 48, conversion: 15 },
        { month: 'T4', leads: 70, conversion: 22 },
        { month: 'T5', leads: 85, conversion: 28 },
        { month: 'T6', leads: 110, conversion: 35 }
      ];
      setAcquisitionTrend(mockTrend);

      // 3. Active Campaigns
      const mockCampaigns = [
        { id: '1', name: 'Workshop Trị Nám - Tháng 6', type: 'event', leads: 125, spend: '15.5M', status: 'active' },
        { id: '2', name: 'FB Ads - Brand Awareness', type: 'ads', leads: 240, spend: '22M', status: 'active' },
        { id: '3', name: 'Chiến dịch Chăm sóc Đại lý Cũ', type: 'zalo', leads: 45, spend: '2M', status: 'paused' }
      ];
      setCampaigns(mockCampaigns);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
          <div className="flex items-center gap-3">
             <Button variant="outline" asChild className="rounded-xl border-slate-200 font-bold text-xs h-10 px-5">
                <Link to="/marketing/campaigns">Quản lý Dispatcher</Link>
             </Button>
             <Button className="rounded-xl bg-pink-600 hover:bg-pink-700 font-black text-xs h-10 px-6 shadow-lg shadow-pink-200 transition-all hover:scale-105">
                <Plus className="w-4 h-4 mr-2" /> Tạo chiến dịch mới
             </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <KpiCard 
             title="Tổng Lead tháng này" 
             value="385" 
             trend="+24%" 
             isUp={true} 
             icon={Users} 
             color="pink" 
           />
           <KpiCard 
             title="Chi phí/Lead (CPL)" 
             value="145K" 
             trend="-12%" 
             isUp={true} 
             icon={Target} 
             color="indigo" 
           />
           <KpiCard 
             title="Tỷ lệ quan tâm" 
             value="18.5%" 
             trend="+2.1%" 
             isUp={true} 
             icon={MousePointer2} 
             color="emerald" 
           />
           <KpiCard 
             title="Ngân sách đã dùng" 
             value="42.8M" 
             trend="+5%" 
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
                    <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Tăng trưởng Lead & Chuyển đổi</CardTitle>
                    <p className="text-xs text-slate-400 font-medium mt-1">So sánh số lượng Lead và số đơn hàng chốt được theo tháng</p>
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
                                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Area type="monotone" dataKey="leads" stroke="#ec4899" strokeWidth={4} fillOpacity={1} fill="url(#colorLeads)" />
                          <Area type="monotone" dataKey="conversion" stroke="#10b981" strokeWidth={3} fill="transparent" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </CardContent>
           </Card>

           {/* LEAD SOURCE PIE */}
           <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-0">
                 <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Cơ cấu Nguồn Lead</CardTitle>
                 <p className="text-xs text-slate-400 font-medium mt-1">Nguồn khách hàng hiệu quả nhất</p>
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
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
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
                    <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Chiến dịch đang chạy</CardTitle>
                    <p className="text-xs text-slate-400 font-medium mt-1">Đo lường hiệu quả thời gian thực</p>
                 </div>
                 <Button variant="ghost" size="sm" className="text-xs font-bold text-indigo-500">Xem tất cả <ChevronRight className="w-4 h-4 ml-1" /></Button>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                       <thead>
                          <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                             <th className="px-8 py-4 text-left">Chiến dịch</th>
                             <th className="px-8 py-4 text-center">Loại hình</th>
                             <th className="px-8 py-4 text-center">Số Lead</th>
                             <th className="px-8 py-4 text-center">Ngân sách</th>
                             <th className="px-8 py-4 text-center">Trạng thái</th>
                             <th className="px-8 py-4 text-right">Hành động</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 font-medium">
                          {campaigns.map(camp => (
                             <tr key={camp.id} className="hover:bg-slate-50/50 transition-all group">
                                <td className="px-8 py-5">
                                   <p className="text-[13px] font-black text-slate-900">{camp.name}</p>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">ID: {camp.id}</p>
                                </td>
                                <td className="px-8 py-5 text-center">
                                   <Badge variant="outline" className="rounded-lg bg-indigo-50 text-indigo-600 border-indigo-100 font-bold text-[10px] uppercase">
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
                                      <div className={`w-2 h-2 rounded-full ${camp.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                      <span className={`text-[11px] font-black uppercase ${camp.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                         {camp.status}
                                      </span>
                                   </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                   <Button variant="ghost" size="icon" className="rounded-xl hover:bg-pink-50 hover:text-pink-600">
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
    pink: 'bg-pink-50 text-pink-600 border-pink-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100'
  };

  return (
    <Card className="rounded-[28px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all group">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all group-hover:rotate-6 ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
             </div>
             <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${isUp ? 'text-emerald-600 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>
                {isUp ? <ArrowUpRight className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                {trend}
             </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-1">{value}</h3>
       </CardContent>
    </Card>
  );
}
