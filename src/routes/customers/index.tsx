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
  Download,
  Activity,
  CheckCircle2,
  Globe,
  Video,
  PhoneCall,
  Facebook,
  Lock
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SALES_PIPELINE_STAGES, getPipelineStageColor, getPipelineStageLabel } from "@/lib/salesPipeline";
import { classifyCustomerLifecycle } from "@/lib/customerOwnership";
import { buildStaffMap, getStaffDisplayName, getStaffInitials, StaffMap } from "@/lib/staffDisplay";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  VIETNAM_PROVINCES,
  stripAccents,
  findProvinceByName,
} from "@/lib/vietnamProvinces";
import { Check, ChevronsUpDown, Map } from "lucide-react";

export const Route = createFileRoute("/customers/")({
  component: CustomersPage,
});

function CustomersPage() {
  const { user, isAdmin, isSubAdmin, isTeleLead, isTelesale, isSale } = useAuth();
  const isManager = isAdmin || isSubAdmin;
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [staffMap, setStaffMap] = useState<StaffMap>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [activeStage, setActiveStage] = useState<string>("all");
  const [smartFilter, setSmartFilter] = useState<"all" | "has_phone" | "has_facebook" | "has_zalo" | "has_email" | "has_tiktok" | "has_website" | "has_primary" | "no_primary" | "has_remarketing" | "no_social" | "unassigned">("all");
  
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  
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

  useEffect(() => {
    const handleOpenPreview = (e: CustomEvent) => {
      const { customerId } = e.detail;
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setPreviewCustomer(customer);
      }
    };
    window.addEventListener('open-customer-preview' as any, handleOpenPreview);
    return () => window.removeEventListener('open-customer-preview' as any, handleOpenPreview);
  }, [customers]);

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
      let query = supabase.from("customers").select("id, created_at, name, facility_name, phone, city, address, owner_sale_id, owner_tele_id, lifecycle_stage, ownership_status, customer_channel, customer_distance_type, next_follow_up_at, last_contacted_at, latitude, longitude, orders(id, total, status)").is("deleted_at", null);
      
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

      // --- ADD INTELLIGENCE FETCH HERE ---
      const cIds = processed.map(c => c.id);
      if (cIds.length > 0) {
        const { data: intelData, error: intelError } = await supabase.rpc('get_customer_list_intelligence', {
           p_customer_ids: cIds
        });
        if (!intelError && intelData) {
           const intelMap = new Map(intelData.map((i: any) => [i.customer_id, i] as [string, any]));
           processed.forEach((c: any) => {
              const intel = intelMap.get(c.id);
              if (intel) {
                 c.sales_intelligence = intel;
              }
           });
        } else if (intelError) {
           console.error("fetch intelligence error:", intelError);
        }

        const { data: channelData, error: channelError } = await supabase.rpc('get_customer_channel_summary', {
           p_customer_ids: cIds
        });
        if (!channelError && channelData) {
           const channelMap = new Map(channelData.map((i: any) => [i.customer_id, i] as [string, any]));
           processed.forEach((c: any) => {
              const channel = channelMap.get(c.id);
              if (channel) {
                 c.channel_summary = channel;
              }
           });
        } else if (channelError) {
           console.error("fetch channel summary error:", channelError);
        }
      }

      setCustomers(processed);

      // Fetch user profiles to build staffMap
      const userIds = new Set<string>();
      processed.forEach(c => {
        if (c.owner_sale_id) userIds.add(c.owner_sale_id);
        if (c.owner_tele_id) userIds.add(c.owner_tele_id);
      });
      if (userIds.size > 0) {
        const { data: profiles, error: profError } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", Array.from(userIds));
        if (!profError && profiles) {
          setStaffMap(buildStaffMap(profiles));
        }
      }
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
      
      let matchSmart = true;
      if (smartFilter === "unassigned") matchSmart = !c.owner_sale_id && !c.owner_tele_id;
      if (smartFilter === "has_phone") matchSmart = !!c.channel_summary?.has_phone;
      if (smartFilter === "has_facebook") matchSmart = !!c.channel_summary?.has_facebook;
      if (smartFilter === "has_zalo") matchSmart = !!c.channel_summary?.has_zalo;
      if (smartFilter === "has_email") matchSmart = !!c.channel_summary?.has_email;
      if (smartFilter === "has_tiktok") matchSmart = !!c.channel_summary?.has_tiktok;
      if (smartFilter === "has_website") matchSmart = !!c.channel_summary?.has_website;
      if (smartFilter === "has_primary") matchSmart = !!c.channel_summary?.has_primary;
      if (smartFilter === "no_primary") matchSmart = c.channel_summary && !c.channel_summary.has_primary;
      if (smartFilter === "has_remarketing") matchSmart = !!c.channel_summary?.has_remarketing;
      if (smartFilter === "no_social") matchSmart = c.channel_summary && !c.channel_summary.has_facebook && !c.channel_summary.has_zalo && !c.channel_summary.has_tiktok;

      const matchCity = cityFilter === "all" || c.city === cityFilter;
      return matchSearch && matchStage && matchSmart && matchCity;
    });
  }, [customers, searchQuery, activeStage, smartFilter, cityFilter]);

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
    
    let hasPhone = 0, hasFb = 0, hasZalo = 0, hasEmail = 0, hasPrimary = 0, noSocial = 0, privateChannels = 0;
    
    customers.forEach(c => {
       const cs = c.channel_summary;
       if (cs) {
          if (cs.has_phone) hasPhone++;
          if (cs.has_facebook) hasFb++;
          if (cs.has_zalo) hasZalo++;
          if (cs.has_email) hasEmail++;
          if (cs.has_primary) hasPrimary++;
          if (!cs.has_facebook && !cs.has_zalo && !cs.has_tiktok) noSocial++;
          privateChannels += (cs.private_count || 0);
       }
    });

    return {
      totalRevenue,
      unassignedLeads,
      vipCount,
      totalCustomers: customers.length,
      channels: { hasPhone, hasFb, hasZalo, hasEmail, hasPrimary, noSocial, privateChannels }
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
                <Link to="/customers/map">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="rounded-lg text-[10px] font-black text-slate-400 hover:text-slate-900"
                  >
                     BẢN ĐỒ 🗺️
                  </Button>
                </Link>
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
               className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-xs h-10 px-6 shadow-lg shadow-indigo-200 transition-all hover:scale-105 text-white"
               onClick={() => setIsAddDialogOpen(true)}
             >
                <Zap className="w-4 h-4 mr-1.5 fill-white/20" /> Thêm khách nhanh
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
                onClick={() => setSmartFilter(smartFilter === "unassigned" ? "all" : "unassigned")}
                className={`p-6 rounded-[32px] text-left border flex flex-col justify-between h-36 transition-all duration-300 ${smartFilter === "unassigned" ? 'bg-indigo-600 border-transparent text-white shadow-xl scale-105 shadow-indigo-100' : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'}`}
             >
                <div className="flex items-center justify-between w-full">
                   <span className={`text-[10px] font-black uppercase tracking-widest ${smartFilter === "unassigned" ? 'text-white/80' : 'text-slate-400'}`}>Lead chưa phân công</span>
                   <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${smartFilter === "unassigned" ? 'bg-white/20 border-white/10 text-white' : 'bg-rose-50 border-rose-100 text-rose-500'}`}>
                      <AlertCircle className="w-4 h-4" />
                   </div>
                </div>
                <div>
                   <h3 className={`text-2xl font-black leading-none ${smartFilter === "unassigned" ? 'text-white' : 'text-slate-900'}`}>{adminStats.unassignedLeads}</h3>
                   <p className={`text-[9px] font-bold mt-1 uppercase ${smartFilter === "unassigned" ? 'text-white/60' : 'text-slate-400'}`}>
                      {smartFilter === "unassigned" ? 'Đang lọc xem Lead chưa chia 🎯' : 'Click để lọc nhanh chia lead'}
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
        
        {isManager && adminStats && (
          <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center text-xs font-bold text-slate-600">
             <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Channel Intelligence</span>
             <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-blue-500" /> {adminStats.channels.hasPhone}</div>
             <div className="flex items-center gap-1.5"><Facebook className="w-3.5 h-3.5 text-blue-600" /> {adminStats.channels.hasFb}</div>
             <div className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-blue-500" /> {adminStats.channels.hasZalo}</div>
             <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-500" /> {adminStats.channels.hasEmail}</div>
             <div className="flex items-center gap-1.5 text-emerald-600"><Star className="w-3.5 h-3.5 fill-emerald-500" /> {adminStats.channels.hasPrimary} Kênh chính</div>
             <div className="flex items-center gap-1.5 text-rose-500"><AlertCircle className="w-3.5 h-3.5" /> {adminStats.channels.noSocial} Thiếu Social</div>
             <div className="flex items-center gap-1.5 text-indigo-500 ml-auto"><Lock className="w-3.5 h-3.5" /> {adminStats.channels.privateChannels} Kênh Private</div>
          </div>
        )}

        {/* CONTROLS (SEARCH & FILTER) */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="relative w-full md:w-96 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Tìm tên Spa, tên chủ, số điện thoại..." 
                className="pl-10 h-11 rounded-xl border-slate-100 bg-white shadow-sm focus:ring-2 focus:ring-slate-900 transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
           
           <div className="relative w-full md:w-64 shrink-0 z-50">
             <Popover open={cityOpen} onOpenChange={(o) => { setCityOpen(o); if (!o) setCitySearch(""); }}>
               <PopoverTrigger asChild>
                 <button
                   type="button"
                   role="combobox"
                   aria-expanded={cityOpen}
                   className="w-full text-sm h-11 rounded-xl border border-slate-100 bg-white shadow-sm px-3 flex items-center justify-between gap-2 hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                 >
                   <div className="flex items-center gap-2 overflow-hidden">
                     <Map className="w-4 h-4 text-slate-400 shrink-0" />
                     <span className={cityFilter !== "all" ? "text-slate-800 font-medium truncate" : "text-slate-400 truncate"}>
                       {cityFilter === "all" ? "Tất cả tỉnh/thành" : cityFilter}
                     </span>
                   </div>
                   <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                 </button>
               </PopoverTrigger>
               <PopoverContent
                 className="p-0 rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
                 style={{ width: "var(--radix-popover-trigger-width)", zIndex: 9999 }}
                 align="start"
                 sideOffset={4}
               >
                 <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50/80">
                   <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                   <input
                     autoFocus
                     value={citySearch}
                     onChange={(e) => setCitySearch(e.target.value)}
                     placeholder="Gõ tìm tỉnh/thành..."
                     className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-300 text-slate-800"
                   />
                   {citySearch && (
                     <button
                       type="button"
                       onClick={() => setCitySearch("")}
                       className="text-slate-300 hover:text-slate-500 text-xs font-bold"
                     >
                       ✕
                     </button>
                   )}
                 </div>
                 <div className="max-h-52 overflow-y-auto">
                   <button
                     type="button"
                     onClick={() => {
                       setCityFilter("all");
                       setCitySearch("");
                       setCityOpen(false);
                     }}
                     className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                   >
                     <Check
                       className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                         cityFilter === "all" ? "opacity-100 text-slate-900" : "opacity-0"
                       }`}
                     />
                     <span className={`font-medium ${cityFilter === "all" ? "text-slate-900" : "text-slate-600"}`}>
                       Tất cả tỉnh/thành
                     </span>
                   </button>
                   {(() => {
                     const q = stripAccents(citySearch);
                     const matched = VIETNAM_PROVINCES.filter((p) => {
                       if (!q) return true;
                       const alias = findProvinceByName(citySearch);
                       if (alias === p) return true;
                       return stripAccents(p).includes(q);
                     });
                     if (matched.length === 0) {
                       return (
                         <div className="py-4 text-center text-xs text-slate-400 font-semibold">
                           Không tìm thấy.
                         </div>
                       );
                     }
                     return matched.map((province) => (
                       <button
                         key={province}
                         type="button"
                         onClick={() => {
                           setCityFilter(province);
                           setCitySearch("");
                           setCityOpen(false);
                         }}
                         className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                       >
                         <Check
                           className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                             cityFilter === province ? "opacity-100 text-slate-900" : "opacity-0"
                           }`}
                         />
                         <span className={`font-medium ${
                           cityFilter === province ? "text-slate-900" : "text-slate-600"
                         }`}>
                           {province}
                         </span>
                       </button>
                     ));
                   })()}
                 </div>
               </PopoverContent>
             </Popover>
           </div>
        </div>

        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full no-scrollbar">
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

           <div className="flex items-center gap-2 overflow-x-auto pt-2 w-full no-scrollbar border-t border-slate-100 mt-2 pb-2">
              <Button 
                variant={smartFilter === 'all' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'all' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('all')}
              >
                 Không lọc
              </Button>
              <Button 
                variant={smartFilter === 'has_phone' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'has_phone' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('has_phone')}
              >
                 📞 Có SĐT
              </Button>
              <Button 
                variant={smartFilter === 'has_facebook' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'has_facebook' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('has_facebook')}
              >
                 📘 Có FB
              </Button>
              <Button 
                variant={smartFilter === 'has_zalo' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'has_zalo' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('has_zalo')}
              >
                 💬 Có Zalo
              </Button>
              <Button 
                variant={smartFilter === 'has_email' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'has_email' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('has_email')}
              >
                 📧 Có Email
              </Button>
              <Button 
                variant={smartFilter === 'has_tiktok' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'has_tiktok' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('has_tiktok')}
              >
                 🎵 Có TikTok
              </Button>
              <Button 
                variant={smartFilter === 'has_website' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'has_website' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('has_website')}
              >
                 🌐 Có Website
              </Button>
              <Button 
                variant={smartFilter === 'has_primary' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'has_primary' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('has_primary')}
              >
                 ⭐ Có Kênh Chính
              </Button>
              <Button 
                variant={smartFilter === 'no_primary' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'no_primary' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('no_primary')}
              >
                 ❌ Chưa Có Kênh Chính
              </Button>
              <Button 
                variant={smartFilter === 'has_remarketing' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'has_remarketing' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('has_remarketing')}
              >
                 🎯 Có Remarketing
              </Button>
              <Button 
                variant={smartFilter === 'no_social' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'no_social' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('no_social')}
              >
                 🟡 Thiếu Social
              </Button>
              <Button 
                variant={smartFilter === 'unassigned' ? 'default' : 'outline'} 
                size="sm" 
                className={`rounded-xl text-[10px] font-black uppercase border-slate-200 shadow-sm ${smartFilter === 'unassigned' ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setSmartFilter('unassigned')}
              >
                 👤 Chưa phân bổ
              </Button>
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
                            staffMap={staffMap}
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
          /* CUSTOMER INTELLIGENCE CENTER (L1) */
          <div className="flex flex-col gap-3">
             {filteredCustomers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100 shadow-sm">
                   <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-slate-300" />
                   </div>
                   <h3 className="text-sm font-black text-slate-900">Không tìm thấy dữ liệu</h3>
                   <p className="text-xs text-slate-500 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                </div>
             ) : (
                filteredCustomers.map(customer => (
                   <CustomerIntelligenceRow 
                      key={customer.id} 
                      customer={customer} 
                      staffMap={staffMap}
                      onPreview={() => setPreviewCustomer(customer)}
                      onQuickLog={() => setLogTarget(customer)}
                   />
                ))
             )}
          </div>
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
        staffMap={staffMap}
      />
    </div>
  );
}

function CustomerCard({ customer, stage, isAdmin, isManager, onQuickLog, draggable, onDragStart, onPreview, staffMap }: any) {
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

  const saleName = getStaffDisplayName(customer.owner_sale_id, staffMap);
  const teleName = getStaffDisplayName(customer.owner_tele_id, staffMap);
  const saleInitials = getStaffInitials(customer.owner_sale_id, staffMap);
  const teleInitials = getStaffInitials(customer.owner_tele_id, staffMap);
  
  const channelIntel = customer.channel_summary || {};
  const getChannelIcons = () => {
     const icons = [];
     if (channelIntel.has_facebook) icons.push(<Facebook key="fb" className="w-3 h-3 text-blue-600" />);
     if (channelIntel.has_zalo) icons.push(<MessageSquare key="zl" className="w-3 h-3 text-blue-500" />);
     if (channelIntel.has_email) icons.push(<Mail key="em" className="w-3 h-3 text-slate-500" />);
     if (channelIntel.has_tiktok) icons.push(<Video key="tt" className="w-3 h-3 text-slate-900" />);
     if (channelIntel.has_website) icons.push(<Globe key="wb" className="w-3 h-3 text-emerald-500" />);
     return icons;
  };

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
                <div title={`Đã báo giá quá ${leadOverdueDays} ngày, cần chăm sóc!`}>
                   <AlertCircle className="w-4 h-4 text-red-500 animate-pulse shrink-0" />
                </div>
             ) : (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-200 group-hover:text-slate-400 shrink-0">
                   <MoreVertical className="w-4 h-4" />
                 </Button>
             )}
          </div>

          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <div className="flex -space-x-2">
                   {customer.owner_sale_id && <div className="w-5 h-5 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[8px] text-indigo-600 font-bold" title={`Sale: ${saleName}`}>{saleInitials}</div>}
                   {customer.owner_tele_id && <div className="w-5 h-5 rounded-full bg-teal-100 border border-white flex items-center justify-center text-[8px] text-teal-600 font-bold" title={`Tele: ${teleName}`}>{teleInitials}</div>}
                   {!customer.owner_sale_id && !customer.owner_tele_id && <div className="w-5 h-5 rounded-full bg-slate-100 border border-white" />}
                </div>
                <span>• {customer.phone ? customer.phone.slice(-4).padStart(customer.phone.length, '*') : 'Chưa có SĐT'}</span>
                <div className="flex items-center gap-1 ml-auto">
                    {getChannelIcons()}
                 </div>
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

function CustomerIntelligenceRow({ customer, staffMap, onPreview, onQuickLog }: any) {
  const salesIntel = customer.sales_intelligence || {};
  const channelIntel = customer.channel_summary || {};
  
  const score = channelIntel.channel_health_score || 0;
  let healthStatus = 'weak';
  if (score >= 80) healthStatus = 'healthy';
  else if (score >= 40) healthStatus = 'partial';
  
  const dupRisk = channelIntel.duplicate_risk;
  const hasRisk = dupRisk && (dupRisk.has_value_duplicates || dupRisk.has_external_id_duplicates || dupRisk.has_primary_duplicates);

  const getHealthColor = () => {
    if (healthStatus === 'healthy') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (healthStatus === 'partial') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-rose-100 text-rose-700 border-rose-200';
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
       case 'facebook': return <Facebook className="w-3.5 h-3.5" />;
       case 'zalo': return <MessageSquare className="w-3.5 h-3.5" />;
       case 'email': return <Mail className="w-3.5 h-3.5" />;
       case 'tiktok': return <Video className="w-3.5 h-3.5" />;
       case 'website': return <Globe className="w-3.5 h-3.5" />;
       default: return <Globe className="w-3.5 h-3.5" />;
    }
  };

  const renderChannelAction = (ch: any) => {
     let href = "#";
     if (ch.type === 'facebook') href = ch.value.includes('http') ? ch.value : `https://facebook.com/${ch.value}`;
     else if (ch.type === 'zalo') href = `https://zalo.me/${ch.value}`;
     else if (ch.type === 'website') href = ch.value.includes('http') ? ch.value : `https://${ch.value}`;
     else if (ch.type === 'email') href = `mailto:${ch.value}`;
     
     return (
        <a 
           key={`${ch.type}-${ch.value}`} 
           href={href} 
           target="_blank" 
           rel="noreferrer"
           className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
           title={ch.value}
           onClick={(e) => e.stopPropagation()}
        >
           {getChannelIcon(ch.type)}
           {ch.is_primary && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-white rounded-full flex items-center justify-center text-white"><Star className="w-2 h-2 fill-white" /></div>}
           {ch.is_verified && <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center text-white"><CheckCircle2 className="w-2 h-2" /></div>}
        </a>
     );
  };

  const saleName = getStaffDisplayName(customer.owner_sale_id, staffMap);
  const teleName = getStaffDisplayName(customer.owner_tele_id, staffMap);

  return (
    <div className="group bg-white border border-slate-100 rounded-[24px] p-4 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={onPreview}>
       {/* Col 1: Info & Health */}
       <div className="w-full md:w-3/12 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg font-black text-slate-400 uppercase shrink-0">
             {(customer.contact_name || customer.name || customer.business_name || customer.facility_name || "C").slice(0, 1)}
          </div>
          <div>
             <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{customer.business_name || customer.facility_name || "Khách lẻ"}</h4>
             <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                {customer.contact_name || customer.name} • {customer.phone ? customer.phone.slice(-4).padStart(customer.phone.length, '*') : 'Chưa có SĐT'}
             </p>
             <div className="flex items-center">
               <Badge className={`mt-2 text-[8px] px-1.5 py-0 h-4 uppercase font-black border ${getHealthColor()}`}>
                  {healthStatus === 'healthy' ? 'Healthy' : healthStatus === 'partial' ? 'Partial' : 'Weak'} ({score})
               </Badge>
               {hasRisk && (
                  <TooltipProvider>
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse ml-2 mt-2" />
                        </TooltipTrigger>
                        <TooltipContent>
                           Phát hiện trùng lặp kênh liên hệ. Cần kiểm tra!
                        </TooltipContent>
                     </Tooltip>
                  </TooltipProvider>
               )}
             </div>
          </div>
       </div>

       {/* Col 2: Omnichannel */}
       <div className="w-full md:w-2/12 flex flex-wrap gap-2">
          {channelIntel.channels_summary?.length > 0 ? (
             channelIntel.channels_summary.map((ch: any) => renderChannelAction(ch))
          ) : (
             <span className="text-xs text-slate-400 italic">Chưa có kênh liên hệ</span>
          )}
       </div>

       {/* Col 3: Priority & Stage */}
       <div className="w-full md:w-2/12">
          <div className="flex items-center gap-2 mb-1">
             <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                   className={`h-full rounded-full ${salesIntel.priority_score >= 80 ? 'bg-red-500' : salesIntel.priority_score >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                   style={{ width: `${Math.min(salesIntel.priority_score || 0, 100)}%` }}
                />
             </div>
             <span className="text-[10px] font-black text-slate-600" title="Priority Score">{salesIntel.priority_score || 0}</span>
          </div>
          <Badge variant="outline" className={`rounded-lg font-black text-[9px] uppercase border-none ${getPipelineStageColor(customer.lifecycle_stage)} bg-opacity-10 text-opacity-100 w-fit`}>
             {getPipelineStageLabel(customer.lifecycle_stage)}
          </Badge>
       </div>

       {/* Col 4: Last Activity */}
       <div className="w-full md:w-3/12">
          {salesIntel.latest_activity ? (
             <>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{salesIntel.latest_activity}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase flex items-center gap-1">
                   <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(salesIntel.activity_at), { addSuffix: true, locale: vi })}
                </p>
             </>
          ) : (
             <span className="text-xs text-slate-400 italic">Chưa có tương tác</span>
          )}
       </div>

       {/* Col 5: Quick Actions */}
       <div className="w-full md:w-2/12 flex items-center justify-end gap-2">
          {customer.phone && (
             <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                <PhoneCall className="w-4 h-4" />
             </a>
          )}
          <button onClick={(e) => { e.stopPropagation(); onQuickLog(); }} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
             <FileText className="w-4 h-4" />
          </button>
       </div>
    </div>
  );
}
