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
  ChevronRight, 
  MoreVertical, 
  LayoutDashboard,
  Phone,
  MessageSquare,
  FileText,
  BadgeCheck,
  Package,
  Heart,
  Clock,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  XCircle,
  BarChart3,
  Mail,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SALES_PIPELINE_STAGES, getPipelineStageColor, getPipelineStageLabel } from "@/lib/salesPipeline";
import { classifyCustomerLifecycle } from "@/lib/customerOwnership";
import { QuickLogDialog } from "@/components/customers/QuickLogDialog";
import { NotificationBell } from "@/components/layout/NotificationBell";

export const Route = createFileRoute("/customers/")({
  component: CustomersPage,
});

function CustomersPage() {
  const { user, isAdmin, isTeleLead, isTelesale, isSale } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [activeStage, setActiveStage] = useState<string>("all");
  
  // Quick Log State
  const [logTarget, setLogTarget] = useState<any | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, [user]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let query = supabase.from("customers").select("*, orders(id, total, status)");
      
      // Role-based logic (Strict ownership)
      if (!isAdmin) {
        if (isSale) query = query.eq("owner_sale_id", user?.id);
        if (isTelesale || isTeleLead) query = query.eq("owner_tele_id", user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Apply hierarchical lifecycle classification to ensure data integrity
      const processed = (data || []).map(c => ({
        ...c,
        lifecycle_stage: classifyCustomerLifecycle(c, c.orders || [])
      }));

      setCustomers(processed);
    } catch (e) {
      toast.error("Lỗi tải danh sách khách hàng");
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = (c.name || c.facility_name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStage = activeStage === "all" || c.lifecycle_stage === activeStage;
      return matchSearch && matchStage;
    });
  }, [customers, searchQuery, activeStage]);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      {/* MASTER HEADER */}
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-30 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
                <Users className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Quản trị Khách hàng</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                   {isAdmin ? <ShieldCheck className="w-3 h-3 text-indigo-500" /> : <Zap className="w-3 h-3 text-amber-500" />}
                   {isAdmin ? "Admin Control Center" : "Personal Workspace"}
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`rounded-lg text-[10px] font-black ${viewMode === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                  onClick={() => setViewMode('kanban')}
                >
                   KANBAN
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`rounded-lg text-[10px] font-black ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                  onClick={() => setViewMode('list')}
                >
                   DANH SÁCH
                </Button>
             </div>
             <NotificationBell />
             <Button className="rounded-xl bg-slate-900 hover:bg-black font-black text-xs h-10 px-6 shadow-lg shadow-slate-200 transition-all hover:scale-105">
                <Plus className="w-4 h-4 mr-2" /> Thêm khách hàng
             </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* TOP FILTER BAR */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Tìm tên Spa, tên chủ, số điện thoại..." 
                className="pl-10 h-11 rounded-xl border-slate-100 bg-white shadow-sm focus:ring-2 focus:ring-slate-900 transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
           
           <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto no-scrollbar">
              <Button 
                variant={activeStage === 'all' ? 'default' : 'ghost'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase ${activeStage === 'all' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
                onClick={() => setActiveStage('all')}
              >
                 TẤT CẢ
              </Button>
              {SALES_PIPELINE_STAGES.map(stage => (
                <Button 
                  key={stage.value}
                  variant={activeStage === stage.value ? 'default' : 'ghost'} 
                  size="sm" 
                  className={`rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${activeStage === stage.value ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
                  onClick={() => setActiveStage(stage.value)}
                >
                   {stage.label}
                   <Badge className="ml-2 bg-slate-200 text-slate-600 border-none text-[8px] h-4">
                      {customers.filter(c => c.lifecycle_stage === stage.value).length}
                   </Badge>
                </Button>
              ))}
           </div>
        </div>

        {viewMode === 'kanban' ? (
          /* PERFECT KANBAN UX */
          <div className="flex gap-6 overflow-x-auto pb-10 min-h-[600px] no-scrollbar">
             {SALES_PIPELINE_STAGES.map(stage => (
                <div key={stage.value} className="min-w-[320px] w-[320px] space-y-4">
                   <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                         <div className={`w-2 h-6 rounded-full ${getPipelineStageColor(stage.value)}`} />
                         <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{stage.label}</h3>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold border-slate-200 text-slate-400 bg-white">
                         {customers.filter(c => c.lifecycle_stage === stage.value).length}
                      </Badge>
                   </div>

                   <div className="space-y-4 bg-slate-50/50 p-3 rounded-[24px] border border-slate-100 min-h-[500px]">
                      {filteredCustomers.filter(c => c.lifecycle_stage === stage.value).map(customer => (
                         <CustomerCard 
                            key={customer.id} 
                            customer={customer} 
                            stage={stage.value} 
                            isAdmin={isAdmin} 
                            onQuickLog={() => setLogTarget(customer)}
                         />
                      ))}
                      {filteredCustomers.filter(c => c.lifecycle_stage === stage.value).length === 0 && (
                         <div className="h-40 flex flex-col items-center justify-center text-slate-200 border-2 border-dashed border-slate-200 rounded-[20px]">
                            <Layers className="w-8 h-8 mb-2" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Trống</p>
                         </div>
                      )}
                   </div>
                </div>
             ))}
          </div>
        ) : (
          /* MODERN LIST VIEW */
          <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                   <table className="w-full text-sm">
                      <thead>
                         <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            <th className="px-8 py-5 text-left">Khách hàng / Spa</th>
                            <th className="px-8 py-5 text-center">Giai đoạn</th>
                            <th className="px-8 py-5 text-center">Người phụ trách</th>
                            <th className="px-8 py-5 text-right">Tổng đơn</th>
                            <th className="px-8 py-5 text-right">Hành động</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {filteredCustomers.map(customer => (
                            <tr key={customer.id} className="hover:bg-slate-50/50 transition-all group">
                               <td className="px-8 py-5">
                                  <Link to="/customers/$id" params={{id: customer.id}} className="flex items-center gap-4">
                                     <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200 group-hover:scale-110 transition-transform">
                                        {customer.name?.slice(0,1) || "C"}
                                     </div>
                                     <div>
                                        <p className="text-sm font-black text-slate-900">{customer.facility_name || "Khách lẻ"}</p>
                                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                           <Users className="w-3 h-3" /> {customer.name} • {customer.phone}
                                        </p>
                                     </div>
                                  </Link>
                               </td>
                               <td className="px-8 py-5 text-center">
                                  <Badge variant="outline" className={`rounded-lg font-black text-[9px] uppercase border-none ${getPipelineStageColor(customer.lifecycle_stage)} bg-opacity-10 text-opacity-100`}>
                                     {getPipelineStageLabel(customer.lifecycle_stage)}
                                  </Badge>
                               </td>
                               <td className="px-8 py-5 text-center font-bold text-slate-500 text-xs">
                                  {customer.owner_sale_id ? "Sale Team" : "Unassigned"}
                               </td>
                               <td className="px-8 py-5 text-right font-black text-slate-900">
                                  {new Intl.NumberFormat('vi-VN').format(customer.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0)}đ
                               </td>
                               <td className="px-8 py-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                     <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="rounded-xl text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
                                      onClick={() => setLogTarget(customer)}
                                     >
                                        <MessageSquare className="w-4 h-4" />
                                     </Button>
                                     <Button variant="ghost" size="icon" className="rounded-xl text-slate-300 hover:text-slate-900"><MoreVertical className="w-5 h-5" /></Button>
                                  </div>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </CardContent>
          </Card>
        )}
      </main>

      <QuickLogDialog 
        isOpen={!!logTarget} 
        customer={logTarget} 
        onClose={() => setLogTarget(null)} 
        onSuccess={fetchCustomers}
      />
    </div>
  );
}

function CustomerCard({ customer, stage, isAdmin, onQuickLog }: any) {
  // Logic hành động nhanh tùy theo giai đoạn
  const getAction = () => {
    switch (stage) {
      case 'new_lead': return { label: 'CHIA LEAD', icon: UserPlus, color: 'bg-indigo-600' };
      case 'assigned': return { label: 'GỌI ĐIỆN', icon: Phone, color: 'bg-amber-500' };
      case 'quoted': return { label: 'NHẮC CHỐT', icon: BadgeCheck, color: 'bg-emerald-600' };
      case 'ordered': return { label: 'LOG SHIP', icon: Package, color: 'bg-indigo-600' };
      default: return { label: 'CHI TIẾT', icon: ArrowRight, color: 'bg-slate-900' };
    }
  };

  const action = getAction();

  return (
    <Card className="rounded-[24px] border-none shadow-sm hover:shadow-xl transition-all duration-300 bg-white overflow-hidden group border border-transparent hover:border-slate-100">
       <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-start">
             <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{customer.facility_name || customer.name}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{customer.city || "Toàn quốc"}</p>
             </div>
             <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-200 group-hover:text-slate-400">
                <MoreVertical className="w-4 h-4" />
             </Button>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
             <div className="flex -space-x-2">
                <div className="w-5 h-5 rounded-full bg-slate-100 border border-white" title="Sale phụ trách" />
                <div className="w-5 h-5 rounded-full bg-slate-50 border border-white" title="Tele phụ trách" />
             </div>
             <span>• {customer.phone ? customer.phone.slice(-4).padStart(customer.phone.length, '*') : 'Chưa có SĐT'}</span>
          </div>

          <div className="pt-2 flex gap-2">
             <Button 
                asChild
                className={`flex-1 rounded-xl h-8 text-[9px] font-black tracking-widest text-white shadow-sm transition-all hover:scale-105 ${action.color}`}
             >
                <Link to="/customers/$id" params={{id: customer.id}}>
                   <action.icon className="w-3 h-3 mr-1.5" /> {action.label}
                </Link>
             </Button>
             <Button 
                variant="outline" 
                onClick={onQuickLog}
                className="w-8 h-8 rounded-xl border-slate-100 p-0 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all"
             >
                <MessageSquare className="w-3.5 h-3.5" />
             </Button>
          </div>
       </CardContent>
    </Card>
  );
}
