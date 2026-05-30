// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Layers, 
  Zap, 
  TrendingUp, 
  Target, 
  ChevronRight, 
  MoreVertical, 
  LayoutDashboard,
  Save,
  Trash2,
  Share2,
  FileDown,
  Activity,
  CheckCircle2,
  X,
  PlusCircle,
  Database,
  ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SALES_PIPELINE_STAGES } from "@/lib/salesPipeline";

export const Route = createFileRoute("/admin/segments")({
  component: CustomerSegmentsPage,
});

interface Segment {
  id: string;
  name: string;
  description: string;
  type: 'dynamic' | 'static';
  count: number;
  last_updated: string;
  filters?: any;
  color: string;
}

function CustomerSegmentsPage() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Builder State
  const [newSegment, setNewSegment] = useState({
    name: "",
    description: "",
    type: "dynamic" as const,
    conditions: [] as any[]
  });

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    setLoading(true);
    // Mocking high-end data for the CRM OS experience
    const mockSegments: Segment[] = [
      { id: '1', name: 'VIP Partners - Miền Bắc', description: 'Đại lý có doanh số > 200M tại khu vực phía Bắc', type: 'dynamic', count: 42, last_updated: '2026-05-14T10:00:00Z', color: 'indigo' },
      { id: '2', name: 'Inactive Leads (60d)', description: 'Lead chưa có tương tác hoặc đơn hàng trong 60 ngày', type: 'dynamic', count: 128, last_updated: '2026-05-15T08:30:00Z', color: 'rose' },
      { id: '3', name: 'Workshop Attendees Hanoi', description: 'Danh sách khách tham dự Workshop 15/05', type: 'static', count: 85, last_updated: '2026-05-15T12:00:00Z', color: 'emerald' },
      { id: '4', name: 'Potential Upsell', description: 'Khách đang ở giai đoạn "Khách đã mua" nhưng chưa mua lại', type: 'dynamic', count: 56, last_updated: '2026-05-13T15:45:00Z', color: 'amber' },
    ];
    
    setTimeout(() => {
      setSegments(mockSegments);
      setLoading(false);
    }, 800);
  };

  const handleCreateSegment = () => {
    if (!newSegment.name) return toast.error("Vui lòng nhập tên phân khúc");
    const created: Segment = {
      id: Math.random().toString(36).substr(2, 9),
      name: newSegment.name,
      description: newSegment.description,
      type: newSegment.type,
      count: 0,
      last_updated: new Date().toISOString(),
      color: 'indigo'
    };
    setSegments([created, ...segments]);
    setIsCreating(false);
    setNewSegment({ name: "", description: "", type: "dynamic", conditions: [] });
    toast.success("Đã khởi tạo phân khúc mới thành công");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      {/* HEADER */}
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
             <Link to="/admin/users" className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200">
                <ArrowLeft className="w-5 h-5" />
             </Link>
             <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Phân khúc Khách hàng</h1>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                   <Layers className="w-3 h-3 fill-indigo-500" /> Data Intelligence Hub
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" className="rounded-xl text-slate-400"><Database className="w-4 h-4" /></Button>
             <Button 
              onClick={() => setIsCreating(true)}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-xs h-10 px-6 shadow-lg shadow-indigo-200 transition-all hover:scale-105"
             >
                <Plus className="w-4 h-4 mr-2" /> Tạo phân khúc mới
             </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <SegmentStatCard title="Tổng số Phân khúc" value={segments.length} icon={Layers} color="indigo" />
           <SegmentStatCard title="Khách hàng đã định danh" value="1,240" icon={Users} color="emerald" />
           <SegmentStatCard title="Tỷ lệ phủ phân khúc" value="84%" icon={Target} color="rose" />
        </div>

        {/* SEGMENT BUILDER MODAL (Simple for now) */}
        {isCreating && (
          <Card className="rounded-[32px] border-none shadow-2xl bg-white overflow-hidden animate-in fade-in zoom-in duration-300">
             <CardHeader className="p-8 pb-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <div>
                   <CardTitle className="text-lg font-black text-slate-900">Thiết lập Phân khúc Thông minh</CardTitle>
                   <p className="text-xs text-slate-400 font-medium">Định nghĩa điều kiện lọc tự động cho tệp khách hàng</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}><X className="w-5 h-5" /></Button>
             </CardHeader>
             <CardContent className="p-8 space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên phân khúc *</label>
                         <Input 
                          placeholder="vd: Khách hàng tiềm năng cao..." 
                          className="rounded-xl border-slate-100 bg-slate-50 h-12 text-sm font-bold"
                          value={newSegment.name}
                          onChange={e => setNewSegment({...newSegment, name: e.target.value})}
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mô tả mục đích</label>
                         <Input 
                          placeholder="Mô tả ngắn gọn để đội ngũ dễ nhận diện..." 
                          className="rounded-xl border-slate-100 bg-slate-50 h-12 text-sm"
                          value={newSegment.description}
                          onChange={e => setNewSegment({...newSegment, description: e.target.value})}
                         />
                      </div>
                      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                         <Button 
                          variant={newSegment.type === 'dynamic' ? 'default' : 'ghost'} 
                          size="sm" 
                          className={`rounded-lg text-[10px] font-black ${newSegment.type === 'dynamic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                          onClick={() => setNewSegment({...newSegment, type: 'dynamic'})}
                         >
                            PHÂN KHÚC ĐỘNG
                         </Button>
                         <Button 
                          variant={newSegment.type === 'static' ? 'default' : 'ghost'} 
                          size="sm" 
                          className={`rounded-lg text-[10px] font-black ${newSegment.type === 'static' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                          onClick={() => setNewSegment({...newSegment, type: 'static'})}
                         >
                            PHÂN KHÚC TĨNH
                         </Button>
                      </div>
                   </div>
                   
                   <div className="bg-slate-50 rounded-[24px] p-6 border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-3">
                      <Zap className="w-8 h-8 text-indigo-300" />
                      <p className="text-xs font-bold text-slate-500 text-center">Xây dựng bộ lọc điều kiện (SQL-like Filter)</p>
                      <Button variant="outline" className="rounded-xl border-indigo-100 text-indigo-600 font-bold text-[10px]">
                         <PlusCircle className="w-3.5 h-3.5 mr-2" /> THÊM ĐIỀU KIỆN LỌC
                      </Button>
                   </div>
                </div>
                <div className="pt-6 border-t border-slate-50 flex justify-end gap-3">
                   <Button variant="ghost" onClick={() => setIsCreating(false)} className="rounded-xl font-bold text-slate-400">Hủy bỏ</Button>
                   <Button onClick={handleCreateSegment} className="rounded-xl bg-indigo-600 font-black px-8 h-12 shadow-lg shadow-indigo-100">
                      Lưu phân khúc & Tính toán quy mô
                   </Button>
                </div>
             </CardContent>
          </Card>
        )}

        {/* SEGMENTS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {segments.map((segment) => (
              <Card key={segment.id} className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                 <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                          segment.color === 'rose' ? 'bg-rose-500 shadow-rose-100' :
                          segment.color === 'emerald' ? 'bg-emerald-500 shadow-emerald-100' :
                          segment.color === 'amber' ? 'bg-amber-500 shadow-amber-100' :
                          'bg-indigo-500 shadow-indigo-100'
                       }`}>
                          {segment.type === 'dynamic' ? <Zap className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                       </div>
                       <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="rounded-xl text-slate-300 group-hover:text-slate-900 transition-all">
                             <Share2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="rounded-xl text-slate-300 group-hover:text-slate-900 transition-all">
                             <MoreVertical className="w-4 h-4" />
                          </Button>
                       </div>
                    </div>
                    
                    <div className="space-y-2">
                       <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black text-slate-900 tracking-tight">{segment.name}</h3>
                          <Badge variant="outline" className={`rounded-lg font-black text-[9px] uppercase border-none ${
                             segment.type === 'dynamic' ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-500'
                          }`}>
                             {segment.type}
                          </Badge>
                       </div>
                       <p className="text-xs text-slate-400 font-medium leading-relaxed">{segment.description}</p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quy mô tệp</p>
                          <p className="text-2xl font-black text-slate-900">{segment.count} <span className="text-[10px] font-bold text-slate-400">ĐỐI TÁC</span></p>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cập nhật lúc</p>
                          <p className="text-xs font-bold text-slate-600">{new Date(segment.last_updated).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</p>
                       </div>
                    </div>
                    
                    <div className="mt-6 flex gap-2">
                       <Button variant="outline" className="flex-1 rounded-xl border-slate-100 text-[10px] font-black text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100">
                          <FileDown className="w-3.5 h-3.5 mr-2" /> XUẤT EXCEL
                       </Button>
                       <Button className="flex-1 rounded-xl bg-slate-900 hover:bg-black font-black text-[10px] tracking-widest">
                          CHẠY CHIẾN DỊCH <ChevronRight className="w-3.5 h-3.5 ml-1" />
                       </Button>
                    </div>
                 </CardContent>
              </Card>
           ))}
        </div>
      </main>
    </div>
  );
}

function SegmentStatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <Card className="rounded-[28px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all group">
       <CardContent className="p-6 flex items-center justify-between">
          <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
             <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-1">{value}</h3>
          </div>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all group-hover:rotate-6 ${colors[color]}`}>
             <Icon className="w-6 h-6" />
          </div>
       </CardContent>
    </Card>
  );
}
