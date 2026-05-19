import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { vi } from "date-fns/locale";
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
  Calendar,
  Star,
  Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SALES_PIPELINE_STAGES, getPipelineStageColor, getPipelineStageLabel } from "@/lib/salesPipeline";
import { classifyCustomerLifecycle, getStaffName } from "@/lib/customerOwnership";
import { QuickLogDialog } from "@/components/customers/QuickLogDialog";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/customers/")({
  component: CustomersPage,
});

function CustomersPage() {
  const { user, isAdmin, isSubAdmin, isTeleLead, isTelesale, isSale } = useAuth();
  const isManager = isAdmin || isSubAdmin;
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [activeStage, setActiveStage] = useState<string>("all");
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  
  // Quick Log State
  const [logTarget, setLogTarget] = useState<any | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [previewCustomer, setPreviewCustomer] = useState<any | null>(null);

  // Kanban Optimization States
  const [draggedCustomerId, setDraggedCustomerId] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCustomerId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    if (!draggedCustomerId) return;
    
    // Optimistic update
    setCustomers(prev => prev.map(c => 
      c.id === draggedCustomerId ? { ...c, lifecycle_stage: newStage } : c
    ));
    
    try {
      const { error } = await supabase
        .from('customers')
        .update({ lifecycle_stage: newStage })
        .eq('id', draggedCustomerId);
      if (error) throw error;
      toast.success("Đã cập nhật giai đoạn khách hàng");
    } catch (error: any) {
      toast.error("Lỗi cập nhật: " + error.message);
      fetchCustomers(); // revert
    }
    setDraggedCustomerId(null);
  };

  const toggleColumn = (stageValue: string) => {
    setCollapsedColumns(prev => ({ ...prev, [stageValue]: !prev[stageValue] }));
  };

  useEffect(() => {
    fetchCustomers();
  }, [user]);

  const handleExport = async (exportType: "active" | "deleted" = "active") => {
    try {
      let query = supabase.from("customers").select("*");
      if (exportType === "active") {
        query = query.is("deleted_at", null);
      } else {
        query = query.not("deleted_at", "is", null);
      }

      // Role-based logic (Strict ownership)
      if (!isAdmin) {
        if (isSale) query = query.eq("owner_sale_id", user?.id);
        if (isTelesale || isTeleLead) query = query.eq("owner_tele_id", user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Không có dữ liệu để xuất!");
        return;
      }

      // Convert to CSV
      const headers = [
        "ID", "Tên cơ sở", "Tên liên hệ", "Số điện thoại", "Số ĐT chuẩn hóa", 
        "Địa chỉ", "Kênh tiếp cận", "Mô hình chăm sóc", "Báo giá/Tiềm năng", 
        "Hạng mức", "Sale phụ trách ID", "Tele phụ trách ID", "Ngày tạo",
        "Lý do xóa", "Người xóa ID", "Ngày xóa"
      ];
      
      const csvRows = [
        headers.join(","),
        ...data.map(c => [
          c.id,
          `"${(c.facility_name || "").replace(/"/g, '""')}"`,
          `"${(c.name || "").replace(/"/g, '""')}"`,
          `"${c.phone || ""}"`,
          `"${c.normalized_phone || ""}"`,
          `"${(c.address || "").replace(/"/g, '""')}"`,
          c.customer_channel || "",
          c.care_model || "",
          c.status || "",
          c.lifecycle_stage || "",
          c.owner_sale_id || "",
          c.owner_tele_id || "",
          c.created_at,
          `"${(c.delete_reason || "").replace(/"/g, '""')}"`,
          c.deleted_by || "",
          c.deleted_at || ""
        ].join(","))
      ];

      const csvContent = "\uFEFF" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `DESEMBRE_Customers_${exportType}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Đã xuất thành công ${data.length} dòng dữ liệu (${exportType})!`);
    } catch (e: any) {
      toast.error("Lỗi khi xuất dữ liệu: " + e.message);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let query = supabase.from("customers").select("*, orders(id, total, status)").is("deleted_at", null);
      
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
      console.error("fetchCustomers error:", e);
      toast.error("Lỗi tải KH: " + ((e as any).message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = (c.name || c.facility_name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStage = activeStage === "all" || c.lifecycle_stage === activeStage;
      const matchUnassigned = !showUnassignedOnly || (!c.owner_sale_id && !c.owner_tele_id);
      return matchSearch && matchStage && matchUnassigned;
    });
  }, [customers, searchQuery, activeStage, showUnassignedOnly]);

  // Executive Admin & SubAdmin Stats
  const adminStats = useMemo(() => {
    if (!isManager) return null;
    const totalRevenue = customers.reduce((sum, c) => {
      const cValue = c.orders?.reduce((s: number, o: any) => s + (o.total || 0), 0) || 0;
      return sum + cValue;
    }, 0);
    const unassignedLeads = customers.filter(c => !c.owner_sale_id && !c.owner_tele_id).length;
    const vipCount = customers.filter(c => {
      const cValue = c.orders?.reduce((s: number, o: any) => s + (o.total || 0), 0) || 0;
      return cValue >= 50000000;
    }).length;
    
    return {
      totalRevenue,
      unassignedLeads,
      vipCount,
      totalCustomers: customers.length
    };
  }, [customers, isManager]);

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
             {isManager ? (
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button 
                     variant="outline"
                     className="rounded-xl border-slate-200 font-black text-xs h-10 px-5 shadow-3xs hover:bg-slate-50 bg-white transition-all flex items-center gap-1.5"
                   >
                     <Download className="w-4 h-4 text-slate-500" /> Xuất Excel
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent className="rounded-2xl border-slate-100 shadow-xl w-52">
                   <DropdownMenuItem 
                     onClick={() => handleExport("active")}
                     className="text-xs font-bold text-slate-700 py-2.5 cursor-pointer"
                   >
                     📂 Xuất Spa hoạt động
                   </DropdownMenuItem>
                   <DropdownMenuItem 
                     onClick={() => handleExport("deleted")}
                     className="text-xs font-bold text-rose-600 hover:text-rose-700 py-2.5 cursor-pointer"
                   >
                     🗑️ Xuất danh sách đã xóa
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
             ) : (
               <Button 
                 variant="outline"
                 onClick={() => handleExport("active")}
                 className="rounded-xl border-slate-200 font-black text-xs h-10 px-5 shadow-3xs bg-white hover:bg-slate-50 transition-all flex items-center gap-1.5"
               >
                 <Download className="w-4 h-4 text-slate-500" /> Xuất Excel
               </Button>
             )}
             <Button 
               className="rounded-xl bg-slate-900 hover:bg-black font-black text-xs h-10 px-6 shadow-lg shadow-slate-200 transition-all hover:scale-105"
               onClick={() => setIsAddDialogOpen(true)}
             >
                <Plus className="w-4 h-4 mr-2" /> Thêm khách hàng
             </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* EXECUTIVE CONTROL CENTER (ADMIN & SUB-ADMIN ONLY) */}
        {isManager && adminStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
             <div className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-sm flex flex-col justify-between h-36">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng khách hàng / Spa</span>
                   <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100">
                      <Users className="w-4 h-4" />
                   </div>
                </div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 leading-none">{adminStats.totalCustomers}</h3>
                   <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Cơ sở đăng ký hệ thống</p>
                </div>
             </div>

             <button 
                onClick={() => setShowUnassignedOnly(!showUnassignedOnly)}
                className={`p-6 rounded-[32px] text-left border flex flex-col justify-between h-36 transition-all duration-300 ${showUnassignedOnly ? 'bg-indigo-600 border-transparent text-white shadow-xl scale-105 shadow-indigo-100' : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'}`}
             >
                <div className="flex items-center justify-between w-full">
                   <span className={`text-[10px] font-black uppercase tracking-widest ${showUnassignedOnly ? 'text-white/80' : 'text-slate-400'}`}>Lead chưa phân công</span>
                   <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${showUnassignedOnly ? 'bg-white/20 border-white/10 text-white' : 'bg-rose-50 border-rose-100 text-rose-500'}`}>
                      <AlertCircle className="w-4 h-4" />
                   </div>
                </div>
                <div>
                   <h3 className={`text-2xl font-black leading-none ${showUnassignedOnly ? 'text-white' : 'text-slate-900'}`}>{adminStats.unassignedLeads}</h3>
                   <p className={`text-[9px] font-bold mt-1 uppercase ${showUnassignedOnly ? 'text-white/60' : 'text-slate-400'}`}>
                      {showUnassignedOnly ? 'Đang lọc xem Lead chưa chia 🎯' : 'Click để lọc nhanh chia lead'}
                   </p>
                </div>
             </button>

             <div className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-sm flex flex-col justify-between h-36">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spa đạt hạng VIP (Gold+)</span>
                   <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100">
                      <Star className="w-4 h-4 fill-amber-500" />
                   </div>
                </div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 leading-none">{adminStats.vipCount}</h3>
                   <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Đạt mức LTV &gt;= 50Mđ</p>
                </div>
             </div>

             <div className="p-6 rounded-[32px] bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 border-none shadow-xl shadow-indigo-100 text-white flex flex-col justify-between h-36">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">Tổng doanh thu hệ thống</span>
                   <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/10">
                      <Zap className="w-4 h-4 fill-white" />
                   </div>
                </div>
                <div>
                   <h3 className="text-xl font-black leading-none">{adminStats.totalRevenue.toLocaleString('vi-VN')} đ</h3>
                   <p className="text-[9px] font-bold text-white/60 mt-1 uppercase">Tổng giá trị đơn hàng đã chốt</p>
                </div>
             </div>
          </div>
        )}
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
             {SALES_PIPELINE_STAGES.map(stage => {
                const isCollapsed = collapsedColumns[stage.value];
                const stageCustomers = filteredCustomers.filter(c => c.lifecycle_stage === stage.value);
                
                if (isCollapsed) {
                   return (
                      <div key={stage.value} className="min-w-[60px] w-[60px] flex flex-col items-center border-r border-slate-200/50 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleColumn(stage.value)}>
                         <div className="flex flex-col items-center gap-4 py-4 h-full">
                            <div className={`w-3 h-3 rounded-full ${getPipelineStageColor(stage.value).replace('bg-', 'bg-').replace('50', '500')}`} />
                            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="text-xs font-black text-slate-400 tracking-widest whitespace-nowrap mt-4">
                               {stage.label} ({stageCustomers.length})
                            </div>
                         </div>
                      </div>
                   );
                }

                return (
                <div 
                   key={stage.value} 
                   className="min-w-[320px] w-[320px] space-y-4"
                   onDragOver={handleDragOver}
                   onDrop={(e) => handleDrop(e, stage.value)}
                >
                   <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleColumn(stage.value)}>
                         <div className={`w-2 h-6 rounded-full ${getPipelineStageColor(stage.value)}`} />
                         <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest hover:text-indigo-600 transition-colors">{stage.label}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                         <Badge variant="outline" className="text-[10px] font-bold border-slate-200 text-slate-400 bg-white">
                            {stageCustomers.length}
                         </Badge>
                         <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:bg-slate-200/50" onClick={() => toggleColumn(stage.value)}>
                            <ChevronRight className="w-4 h-4 transition-transform hover:-translate-x-1" />
                         </Button>
                      </div>
                   </div>

                   <div className={`space-y-4 bg-slate-50/50 p-3 rounded-[24px] border border-slate-100 min-h-[500px] transition-colors ${draggedCustomerId ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
                      {stageCustomers.map(customer => (
                         <CustomerCard 
                            key={customer.id} 
                            customer={customer} 
                            stage={stage.value} 
                            isAdmin={isAdmin} 
                            isManager={isManager}
                            onQuickLog={() => setLogTarget(customer)}
                            onPreview={() => setPreviewCustomer(customer)}
                            draggable={true}
                            onDragStart={(e: React.DragEvent) => handleDragStart(e, customer.id)}
                         />
                      ))}
                      {stageCustomers.length === 0 && (
                         <div className="h-40 flex flex-col items-center justify-center text-slate-200 border-2 border-dashed border-slate-200 rounded-[20px]">
                            <Layers className="w-8 h-8 mb-2" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Kéo thả vào đây</p>
                         </div>
                      )}
                   </div>
                </div>
             )})}
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
                                  <div 
                                     onClick={() => setPreviewCustomer(customer)} 
                                     className="flex items-center gap-4 cursor-pointer"
                                  >
                                     <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200 group-hover:scale-110 transition-transform">
                                        {(customer.contact_name || customer.name)?.slice(0,1) || "C"}
                                     </div>
                                     <div>
                                        <p className="text-sm font-black text-slate-900">{customer.business_name || customer.facility_name || "Khách lẻ"}</p>
                                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                           <Users className="w-3 h-3" /> {customer.contact_name || customer.name} • {customer.phone}
                                        </p>
                                     </div>
                                  </div>
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

      <AddCustomerDialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen} 
        onSuccess={fetchCustomers}
      />

      <CustomerPreviewDrawer
        customer={previewCustomer}
        open={!!previewCustomer}
        onOpenChange={(open) => !open && setPreviewCustomer(null)}
        getStaffName={getStaffName}
      />
    </div>
  );
}

function CustomerCard({ customer, stage, isAdmin, isManager, onQuickLog, draggable, onDragStart, onPreview }: any) {
  // Logic hành động nhanh tùy theo giai đoạn và vai trò người dùng
  const getAction = () => {
    // Nếu là Admin hoặc Phó Admin (Manager), họ không gọi điện/nhắc chốt/log ship, mà chỉ có 2 tác vụ: "CHIA LEAD" ở cột new_lead và "CHI TIẾT" ở các cột còn lại
    if (isManager) {
      if (stage === 'new_lead') {
        return { label: 'CHIA LEAD', icon: UserPlus, color: 'bg-indigo-600' };
      }
      return { label: 'CHI TIẾT', icon: ArrowRight, color: 'bg-slate-900' };
    }

    switch (stage) {
      case 'new_lead': return { label: 'CHIA LEAD', icon: UserPlus, color: 'bg-indigo-600' };
      case 'assigned': return { label: 'GỌI ĐIỆN', icon: Phone, color: 'bg-amber-500' };
      case 'quoted': return { label: 'NHẮC CHỐT', icon: BadgeCheck, color: 'bg-emerald-600' };
      case 'ordered': return { label: 'LOG SHIP', icon: Package, color: 'bg-indigo-600' };
      default: return { label: 'CHI TIẾT', icon: ArrowRight, color: 'bg-slate-900' };
    }
  };

  const { leadOverdueDays } = useSystemSettings();
  const action = getAction();
  const totalValue = customer.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
  
  const getTierBadge = () => {
    if (totalValue >= 100000000) {
      return <Badge className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white shadow-sm border-none text-[8px] px-1.5 py-0 h-4 font-black">💎 DIAMOND</Badge>;
    }
    if (totalValue >= 50000000) {
      return <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-sm border-none text-[8px] px-1.5 py-0 h-4 font-black">🥇 GOLD</Badge>;
    }
    if (totalValue > 0) {
      return <Badge className="bg-gradient-to-r from-slate-400 to-slate-600 text-white shadow-sm border-none text-[8px] px-1.5 py-0 h-4 font-black">🥈 SILVER</Badge>;
    }
    return null;
  };

  // Cảnh báo khách hàng báo giá quá X ngày (Đỏ)
  const isQuotedOverdue = stage === 'quoted' && differenceInDays(new Date(), new Date(customer.updated_at || customer.created_at)) >= leadOverdueDays;

  return (
    <Card 
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onPreview && onPreview(customer)}
      className={`rounded-[24px] shadow-sm hover:shadow-xl transition-all duration-300 bg-white overflow-hidden group border cursor-grab active:cursor-grabbing relative ${isQuotedOverdue ? 'border-red-400 shadow-red-100 ring-1 ring-red-400/50' : 'border-transparent hover:border-slate-200'}`}
    >
       <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-start">
             <div className="space-y-1">
                <div className="flex items-center gap-2">
                   <h4 className="text-sm font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{customer.business_name || customer.facility_name || customer.contact_name || customer.name}</h4>
                   {getTierBadge()}
                   {stage === 'new_lead' && <Badge className="bg-red-100 text-red-700 hover:bg-red-200 text-[8px] px-1.5 py-0 border-none h-4">HOT</Badge>}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{customer.city || "Toàn quốc"}</p>
             </div>
             {isQuotedOverdue ? (
                <AlertCircle className="w-4 h-4 text-red-500 animate-pulse shrink-0" title={`Đã báo giá quá ${leadOverdueDays} ngày, cần chăm sóc!`} />
             ) : (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-200 group-hover:text-slate-400 shrink-0">
                   <MoreVertical className="w-4 h-4" />
                </Button>
             )}
          </div>

          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <div className="flex -space-x-2">
                   {customer.owner_sale_id && <div className="w-5 h-5 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[8px] text-indigo-600 font-bold" title="Sale phụ trách">S</div>}
                   {customer.owner_tele_id && <div className="w-5 h-5 rounded-full bg-teal-100 border border-white flex items-center justify-center text-[8px] text-teal-600 font-bold" title="Tele phụ trách">T</div>}
                   {!customer.owner_sale_id && !customer.owner_tele_id && <div className="w-5 h-5 rounded-full bg-slate-100 border border-white" />}
                </div>
                <span>• {customer.phone ? customer.phone.slice(-4).padStart(customer.phone.length, '*') : 'Chưa có SĐT'}</span>
             </div>
             
             <div className="flex justify-between items-center text-[9px] font-bold bg-slate-50 p-2 rounded-xl">
                <span className="text-slate-400 flex items-center gap-1">
                   <Clock className="w-3 h-3" /> 
                   {customer.updated_at || customer.created_at ? formatDistanceToNow(new Date(customer.updated_at || customer.created_at), { addSuffix: true, locale: vi }) : 'Mới đây'}
                </span>
                {totalValue > 0 && <span className="text-emerald-600 font-black tracking-widest">{new Intl.NumberFormat('vi-VN').format(totalValue)}đ</span>}
             </div>
          </div>

          <div className="pt-1 flex gap-2">
             <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview && onPreview(customer);
                }}
                className={`flex-1 rounded-xl h-8 text-[9px] font-black tracking-widest text-white shadow-sm transition-all hover:scale-105 ${action.color}`}
             >
                <action.icon className="w-3 h-3 mr-1.5" /> {action.label}
             </Button>
             <Button 
                variant="outline" 
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickLog();
                }}
                className="w-8 h-8 rounded-xl border-slate-100 p-0 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all"
             >
                <MessageSquare className="w-3.5 h-3.5" />
             </Button>
          </div>
       </CardContent>
    </Card>
  );
}
