import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { 
  TrendingUp, 
  Users, 
  Package, 
  Zap, 
  ChevronRight, 
  Activity, 
  Target, 
  Calendar,
  Sparkles,
  ArrowUpRight,
  LayoutDashboard,
  ShieldCheck,
  Bell,
  Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const REVENUE_DATA = [
  { name: 'T2', value: 45000000 },
  { name: 'T3', value: 52000000 },
  { name: 'T4', value: 48000000 },
  { name: 'T5', value: 61000000 },
  { name: 'T6', value: 55000000 },
  { name: 'T7', value: 72000000 },
  { name: 'CN', value: 68000000 },
];

const FUNNEL_DATA = [
  { stage: 'Mới', count: 124, color: '#6366f1' },
  { stage: 'Tư vấn', count: 82, color: '#8b5cf6' },
  { stage: 'Báo giá', count: 45, color: '#a855f7' },
  { stage: 'Đã mua', count: 28, color: '#d946ef' },
];

function Dashboard() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* ELITE DASHBOARD HEADER */}
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-40 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-24 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-6">
             <div className="w-14 h-14 rounded-[22px] bg-slate-900 flex items-center justify-center text-white shadow-2xl shadow-slate-300 ring-4 ring-slate-50 transition-transform hover:scale-110">
                <LayoutDashboard className="w-7 h-7" />
             </div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                   CRM Operating System
                   <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-lg">PREMIUM</Badge>
                </h1>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                   {isAdmin ? <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                   Xin chào, {user?.email?.split('@')[0]} 👋
                </p>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-slate-900">
                <Bell className="w-5 h-5" />
             </Button>
             <Button className="rounded-2xl bg-slate-900 hover:bg-black font-black text-xs h-12 px-8 shadow-xl shadow-slate-200 transition-all hover:scale-105 uppercase tracking-widest">
                <PlusIcon className="w-4 h-4 mr-2" /> Tạo dự án mới
             </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-7xl space-y-12">
        {/* KPI OVERVIEW GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <KpiCard title="DOANH THU THÁNG" value="482.5M" trend="+12.5%" icon={TrendingUp} color="bg-indigo-500" />
           <KpiCard title="LEAD MỚI" value="124" trend="+18" icon={Users} color="bg-purple-500" />
           <KpiCard title="TỶ LỆ CHỐT" value="28.4%" trend="+4.2%" icon={Target} color="bg-rose-500" />
           <KpiCard title="ĐƠN ĐANG GIAO" value="15" trend="4 Gấp" icon={Package} color="bg-amber-500" />
        </div>

        {/* ANALYTICS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* REVENUE CHART */}
           <Card className="lg:col-span-2 rounded-[40px] border-none shadow-sm bg-white overflow-hidden p-8">
              <CardHeader className="p-0 mb-8 flex flex-row items-center justify-between">
                 <div>
                    <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">Biểu đồ Tăng trưởng</CardTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Dữ liệu doanh thu 7 ngày gần nhất</p>
                 </div>
                 <Badge className="bg-slate-100 text-slate-500 border-none font-bold text-[10px]">REAL-TIME</Badge>
              </CardHeader>
              <div className="h-[350px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={REVENUE_DATA}>
                       <defs>
                          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 800, fill: '#94a3b8'}}
                          dy={10}
                       />
                       <YAxis hide />
                       <Tooltip 
                          contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800}}
                          formatter={(value) => [new Intl.NumberFormat('vi-VN').format(Number(value)) + 'đ', 'Doanh thu']}
                       />
                       <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#6366f1" 
                          strokeWidth={4} 
                          fillOpacity={1} 
                          fill="url(#colorVal)" 
                       />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </Card>

           {/* CONVERSION FUNNEL */}
           <Card className="rounded-[40px] border-none shadow-sm bg-white p-8">
              <CardHeader className="p-0 mb-8">
                 <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">Phễu Chuyển đổi</CardTitle>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Tỷ lệ rò rỉ khách hàng</p>
              </CardHeader>
              <div className="space-y-6">
                 {FUNNEL_DATA.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                       <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.stage}</span>
                          <span className="text-xs font-black text-slate-900">{item.count}</span>
                       </div>
                       <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                             className="h-full rounded-full transition-all duration-1000" 
                             style={{ 
                                width: `${(item.count / FUNNEL_DATA[0].count) * 100}%`,
                                backgroundColor: item.color
                             }} 
                          />
                       </div>
                    </div>
                 ))}
              </div>
              <div className="mt-10 p-6 bg-slate-900 rounded-[28px] text-center space-y-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ROI TRUNG BÌNH</p>
                 <p className="text-2xl font-black text-white">4.2x</p>
                 <Badge className="bg-indigo-500/20 text-indigo-300 border-none text-[8px]">HIGHT PERFORMANCE</Badge>
              </div>
           </Card>
        </div>

        {/* QUICK ACTIONS & RECENT ACTIVITY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="space-y-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">Truy cập Nhanh</h3>
              <div className="grid grid-cols-2 gap-4">
                 <QuickActionLink to="/customers" label="KHÁCH HÀNG" icon={Users} color="bg-indigo-600" />
                 <QuickActionLink to="/orders" label="ĐƠN HÀNG" icon={Package} color="bg-amber-500" />
                 <QuickActionLink to="/marketing" label="MARKETING" icon={Sparkles} color="bg-purple-600" />
                 <QuickActionLink to="/admin/settings" label="CÀI ĐẶT" icon={Zap} color="bg-slate-900" />
              </div>
           </div>
           
           <Card className="rounded-[40px] border-none shadow-sm bg-white p-8">
              <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
                 <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">Hoạt động Gần đây</CardTitle>
                 <Button variant="ghost" size="sm" className="text-[10px] font-black text-indigo-600 uppercase">Xem hết</Button>
              </CardHeader>
              <div className="space-y-5">
                 {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 group cursor-pointer">
                       <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all">
                          <Activity className="w-5 h-5" />
                       </div>
                       <div className="flex-1">
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Mới chốt đơn #ORD-220{i}</p>
                          <p className="text-[10px] font-bold text-slate-400">Bởi Nguyễn Văn A • 12 phút trước</p>
                       </div>
                       <ChevronRight className="w-4 h-4 text-slate-200 group-hover:translate-x-1 transition-all" />
                    </div>
                 ))}
              </div>
           </Card>
        </div>
      </main>
    </div>
  );
}

function KpiCard({ title, value, trend, icon: Icon, color }: any) {
  return (
    <Card className="rounded-[32px] border-none shadow-sm hover:shadow-xl transition-all duration-300 bg-white group overflow-hidden">
       <CardContent className="p-8">
          <div className="flex justify-between items-start mb-6">
             <div className={`p-4 rounded-[22px] ${color} text-white shadow-lg transition-transform group-hover:scale-110`}>
                <Icon className="w-6 h-6" />
             </div>
             <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] px-3 py-1">{trend}</Badge>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
       </CardContent>
    </Card>
  );
}

function QuickActionLink({ to, label, icon: Icon, color }: any) {
  return (
    <Link 
      to={to} 
      className={`p-6 rounded-[32px] ${color} flex flex-col items-center justify-center gap-3 transition-all hover:scale-105 shadow-lg group active:scale-95`}
    >
       <Icon className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
       <span className="text-[10px] font-black text-white uppercase tracking-widest">{label}</span>
       <ArrowUpRight className="w-4 h-4 text-white/40 absolute top-4 right-4" />
    </Link>
  );
}

function PlusIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
