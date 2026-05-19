import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
import { 
  Loader2, 
  ChevronLeft, 
  Phone, 
  MapPin, 
  Building2, 
  UserCircle, 
  ShieldCheck, 
  Zap, 
  Target, 
  Users, 
  FileText, 
  Plus,
  MessageCircle,
  Activity,
  ChevronRight,
  Sparkles,
  Edit3,
  Star,
  Clock,
  Filter,
  CheckCircle2,
  Package,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  getLifecycleConfig, 
  getStaffName, 
  getCareModelLabel,
  getCustomerChannelLabel,
  getCustomerDistanceLabel
} from "@/lib/customerOwnership";
import { toast } from "sonner";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { TemplateDispatcher } from "@/components/marketing/TemplateDispatcher";
import { AssignStaffDialog } from "@/components/customers/AssignStaffDialog";
import { AddTaskDialog } from "@/components/customers/AddTaskDialog";

export const Route = createFileRoute("/customers/$id")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const { user, isAdmin, isSubAdmin, isSale, isTeleLead } = useAuth();
  const isManager = isAdmin || isSubAdmin;
  const navigate = useNavigate();

  const [tierSettings, setTierSettings] = useState(() => {
    try {
      const savedTier = localStorage.getItem('system_tier_settings');
      return savedTier ? JSON.parse(savedTier) : {
        goldThreshold: 50000000,
        goldDiscount: 62,
        diamondThreshold: 100000000,
        diamondDiscount: 65,
        refillCycleDays: 60
      };
    } catch {
      return {
        goldThreshold: 50000000,
        goldDiscount: 62,
        diamondThreshold: 100000000,
        diamondDiscount: 65,
        refillCycleDays: 60
      };
    }
  });

  useEffect(() => {
    async function fetchSystemSettings() {
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("*")
          .maybeSingle();
        if (data) {
          setTierSettings({
            goldThreshold: Number(data.gold_threshold ?? 50000000),
            goldDiscount: Number(data.gold_discount ?? 62),
            diamondThreshold: Number(data.diamond_threshold ?? 100000000),
            diamondDiscount: Number(data.diamond_discount ?? 65),
            refillCycleDays: Number(data.refill_cycle_days ?? 60)
          });
        }
      } catch (err) {
        console.error("Error loading system settings from DB:", err);
      }
    }
    fetchSystemSettings();
  }, []);

  const refillStats = useMemo(() => {
    if (!orders || orders.length === 0) return null;
    const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered' || !o.status);
    if (completedOrders.length === 0) return null;
    
    // Sort by created_at descending
    const sorted = [...completedOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const last = sorted[0];
    
    const lastDate = new Date(last.created_at);
    const today = new Date();
    const elapsed = differenceInDays(today, lastDate);
    const cycle = tierSettings.refillCycleDays || 60;
    const remaining = cycle - elapsed;
    const progress = Math.min(100, Math.max(0, (elapsed / cycle) * 100));
    
    let statusLabel = "🟢 AN TOÀN (ĐỦ HÀNG)";
    let statusColor = "text-emerald-500 bg-emerald-50 border-emerald-100";
    if (remaining <= 10) {
      statusLabel = "🔴⚠️ CẢNH BÁO REFILL (SẮP HẾT)";
      statusColor = "text-rose-500 bg-rose-50 border-rose-100 animate-pulse";
    } else if (remaining <= 25) {
      statusLabel = "🟡 ĐANG TIÊU THỤ TRUNG BÌNH";
      statusColor = "text-amber-500 bg-amber-50 border-amber-100";
    }
    
    return {
      lastOrder: last,
      lastDate,
      elapsed,
      cycle,
      remaining,
      progress,
      statusLabel,
      statusColor
    };
  }, [orders, tierSettings]);
  
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const canEditCustomer = useMemo(() => {
    if (!user || !customer) return false;
    if (isManager) return true;
    if (isSale && customer.owner_sale_id === user.id) return true;
    if (isTeleLead && customer.owner_tele_id === user.id) return true;
    return false;
  }, [user, customer, isManager, isSale, isTeleLead]);
  
  // Activity Log State
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: 'note', content: '' });
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    setNewActivity(prev => ({
      ...prev,
      type: isManager ? 'note' : 'call'
    }));
  }, [isManager]);

  // Customer 360 States
  const [tasks, setTasks] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Template Dispatcher State
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isAssignStaffOpen, setIsAssignStaffOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  // Spa Equipment Profile State (Upsell Phase 1) - Syncs with database
  const [spaEquipment, setSpaEquipment] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`spa_equipment_${id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleEquipment = async (eqName: string) => {
    const next = spaEquipment.includes(eqName)
      ? spaEquipment.filter(x => x !== eqName)
      : [...spaEquipment, eqName];
    
    // Update local state instantly for smooth UX
    setSpaEquipment(next);
    localStorage.setItem(`spa_equipment_${id}`, JSON.stringify(next));

    try {
      const { error } = await supabase
        .from("customers")
        .update({ spa_equipment: next })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Đã cập nhật thiết bị Spa: ${eqName}`);
    } catch (e: any) {
      console.error("Error saving spa equipment to DB:", e);
      toast.error("Không thể đồng bộ lên Cloud, đã lưu tạm cục bộ trên thiết bị");
    }
  };

  const totalSpend = useMemo(() => {
    return orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  }, [orders]);

  const spaTier = useMemo(() => {
    if (totalSpend >= 100000000) return { label: "💎 DIAMOND", color: "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white shadow-sm border-none text-[9px]" };
    if (totalSpend >= 50000000) return { label: "🥇 GOLD", color: "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-white shadow-sm border-none text-[9px]" };
    if (totalSpend > 0) return { label: "🥈 SILVER", color: "bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600 text-white shadow-sm border-none text-[9px]" };
    return { label: "NEW CO", color: "bg-slate-100 text-slate-500 border-none text-[9px]" };
  }, [totalSpend]);

  // Fetch Core Data
  const fetchCustomer = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching customer:", error);
      toast.error("Không thể tải thông tin khách hàng");
    } else {
      setCustomer(data);
      // Sync spa equipment from database if available, else fallback to localStorage
      if (data.spa_equipment && Array.isArray(data.spa_equipment)) {
        setSpaEquipment(data.spa_equipment);
      } else {
        try {
          const saved = localStorage.getItem(`spa_equipment_${id}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            setSpaEquipment(parsed);
            // Proactively backfill to database in the background
            await supabase.from("customers").update({ spa_equipment: parsed }).eq("id", id);
          }
        } catch (err) {
          console.error("Failed to parse local spa equipment:", err);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomer();
    fetchActivities();
    fetchTasks();
    fetchOrders();
    fetchAppointments();
    fetchEvents();
  }, [id]);

  const fetchTasks = async () => {
    if (!id) return;
    try {
      const { data } = await supabase.from("customer_tasks").select("*").eq("customer_id", id).order("due_at", { ascending: false });
      if (data) setTasks(data);
    } catch (e) { console.error("Error fetching tasks:", e); }
  };

  const fetchOrders = async () => {
    if (!id) return;
    try {
      const { data } = await supabase.from("orders").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(5);
      if (data) setOrders(data);
    } catch (e) { console.error("Error fetching orders:", e); }
  };

  const fetchAppointments = async () => {
    if (!id) return;
    try {
      const { data } = await supabase.from("calendar_events").select("*").eq("customer_id", id).order("starts_at", { ascending: false });
      if (data) setAppointments(data);
    } catch (e) { console.error("Error fetching appointments:", e); }
  };

  const fetchEvents = async () => {
    if (!id) return;
    try {
      const { data } = await supabase.from("event_registrations").select("*, company_events(*)").eq("customer_id", id).order("created_at", { ascending: false });
      if (data) setEvents(data);
    } catch (e) { console.error("Error fetching events:", e); }
  };

  // Fetch Activities
  const fetchActivities = async () => {
    if (!id) return;
    setLoadingActivities(true);
    try {
      const { data, error } = await supabase
        .from("customer_activities")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (data) setActivities(data);
    } catch (e) {
      console.log("Activities fetch error", e);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.content.trim()) {
      toast.error("Vui lòng nhập nội dung tương tác");
      return;
    }
    try {
      const typeMap: Record<string, string> = {
        'note': 'note',
        'call': 'call',
        'meeting': 'online_consultation',
        'message': 'zalo_message'
      };
      const titleMap: Record<string, string> = {
        'note': 'Ghi chú',
        'call': 'Cuộc gọi',
        'meeting': 'Tác vụ tư vấn',
        'message': 'Tin nhắn Zalo'
      };

      const dbType = typeMap[newActivity.type] || 'note';
      const dbTitle = titleMap[newActivity.type] || 'Nhật ký tương tác';

      const { error } = await supabase.from("customer_activities").insert([{
        customer_id: id,
        created_by: user?.id,
        activity_type: dbType,
        title: dbTitle,
        content: newActivity.content,
      }]);
      
      if (!error) {
        setNewActivity({ ...newActivity, content: '' });
        fetchActivities();
        toast.success("Đã lưu hoạt động");
      } else {
        throw error;
      }
    } catch (e) {
      toast.error("Lỗi khi lưu hoạt động");
    }
  };

  const filteredActivities = useMemo(() => {
    if (filterType === "all") return activities;
    return activities.filter(a => a.activity_type === filterType);
  }, [activities, filterType]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-3.5 h-3.5" />;
      case 'meeting':
      case 'online_consultation':
      case 'showroom_meeting':
      case 'direct_visit': return <Users className="w-3.5 h-3.5" />;
      case 'message':
      case 'zalo_message': return <MessageCircle className="w-3.5 h-3.5" />;
      case 'order':
      case 'order_created': return <Package className="w-3.5 h-3.5" />;
      case 'handoff': return <Sparkles className="w-3.5 h-3.5 text-indigo-500" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'meeting':
      case 'online_consultation':
      case 'showroom_meeting':
      case 'direct_visit': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'message':
      case 'zalo_message': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'order':
      case 'order_created': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'handoff': return 'bg-indigo-50 text-indigo-600 border-indigo-100/50';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const renderStatusBadge = (stage: string) => {
    const config = getLifecycleConfig(stage);
    return (
      <Badge variant="outline" className={`text-[10px] font-black px-2.5 py-0.5 ${config.bg} ${config.text} ${config.border} rounded-lg`}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Đang tải hồ sơ khách hàng...</p>
      </div>
    );
  }

  if (!customer) return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50">
      <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
      <h2 className="text-lg font-bold text-slate-900">Không tìm thấy khách hàng</h2>
      <Button onClick={() => navigate({ to: "/customers" })} className="mt-4">Quay lại danh sách</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* TOP NAVIGATION & ACTIONS */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-2xl h-12 w-12 bg-white shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
              onClick={() => navigate({ to: "/customers" })}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{customer.business_name || customer.facility_name || customer.contact_name || customer.name}</h1>
                {renderStatusBadge(customer.lifecycle_stage)}
                <Badge className={`font-black uppercase tracking-wider rounded-lg border-none px-2.5 py-0.5 ${spaTier.color}`}>{spaTier.label}</Badge>
                {customer.is_vip && <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] font-black"><Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" /> VIP</Badge>}
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5"><UserCircle className="w-4 h-4" /> {customer.contact_name || customer.name}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {customer.city}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Button 
              variant="outline" 
              onClick={() => setIsTemplateOpen(true)}
              className="rounded-xl border-slate-200 font-black text-[10px] text-indigo-600 bg-white shadow-sm hover:bg-indigo-50 h-10 px-6 uppercase tracking-widest border-indigo-100/50"
            >
              <MessageCircle className="mr-2 h-3.5 w-3.5" /> Gửi tin nhắn
            </Button>
            <Button variant="outline" className="rounded-xl border-slate-200 font-black text-[10px] text-slate-600 bg-white shadow-sm hover:bg-slate-50 h-10 px-6 uppercase tracking-widest">
              <Phone className="mr-2 h-3.5 w-3.5" /> Gọi điện
            </Button>
            <Button className="rounded-xl font-black text-[10px] bg-slate-900 hover:bg-black shadow-lg shadow-slate-200 h-10 px-8 transition-all uppercase tracking-widest">
              <Plus className="mr-2 h-3.5 w-3.5" /> Lên đơn mới
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* LEFT COLUMN: INSIGHTS & PROFILE */}
          <div className="space-y-8">
            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-5 px-8">
                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                   <Activity className="w-4 h-4 text-indigo-500" /> Chỉ số sức khỏe khách hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-5 bg-slate-50 rounded-[24px] border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Đơn hàng</p>
                    <p className="text-2xl font-black text-slate-900">{customer.total_orders_count || 0}</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-[24px] border border-slate-100 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Doanh số</p>
                    <p className="text-base font-black text-indigo-600 truncate" title={`${totalSpend.toLocaleString('vi-VN')} đ`}>
                      {new Intl.NumberFormat('vi-VN').format(totalSpend)}đ
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                            <Clock className="w-4 h-4" />
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Tương tác cuối</p>
                            <p className="text-xs font-black text-slate-700 mt-0.5">{customer.last_order_at ? format(new Date(customer.last_order_at), "dd/MM/yyyy") : "Chưa rõ"}</p>
                         </div>
                      </div>
                      <Badge variant="outline" className="bg-white text-indigo-600 border-indigo-200 font-black text-[9px]">99+ NGÀY</Badge>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="py-5 px-8 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">Hồ sơ đối tác</CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-slate-900"><Edit3 className="w-4 h-4" /></Button>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="flex items-start gap-5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0 shadow-sm">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Địa chỉ vận hành</p>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">{customer.address || "Chưa cập nhật"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0 shadow-sm">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Liên hệ trực tiếp</p>
                    <p className="text-xs font-black text-slate-900 tracking-tight">{customer.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0 shadow-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quy mô cơ sở</p>
                    <p className="text-xs font-bold text-slate-700">{customer.bed_count || 0} Giường • {customer.staff_count || 0} Nhân sự</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: TIMELINE & TABS */}
          <div className="lg:col-span-2 space-y-8">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/60 shadow-sm mb-8 h-auto flex flex-wrap w-full lg:sticky lg:top-24 z-20">
                <TabsTrigger value="overview" className="rounded-xl px-4 lg:px-6 py-2 lg:py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 text-center">
                   <Target className="mr-2 h-4 w-4 hidden sm:inline" /> Tổng quan
                </TabsTrigger>
                <TabsTrigger value="activities" className="rounded-xl px-4 lg:px-6 py-2 lg:py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 text-center">
                   <Activity className="mr-2 h-4 w-4 hidden sm:inline" /> Nhật ký
                </TabsTrigger>
                <TabsTrigger value="tasks" className="rounded-xl px-4 lg:px-6 py-2 lg:py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 text-center">
                   <CheckCircle2 className="mr-2 h-4 w-4 hidden sm:inline" /> Việc làm
                </TabsTrigger>
                <TabsTrigger value="orders" className="rounded-xl px-4 lg:px-6 py-2 lg:py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 text-center">
                   <Package className="mr-2 h-4 w-4 hidden sm:inline" /> Đơn hàng
                </TabsTrigger>
                <TabsTrigger value="appointments" className="rounded-xl px-4 lg:px-6 py-2 lg:py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 text-center">
                   <Calendar className="mr-2 h-4 w-4 hidden sm:inline" /> Lịch hẹn
                </TabsTrigger>
                <TabsTrigger value="events" className="rounded-xl px-4 lg:px-6 py-2 lg:py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 text-center">
                   <Star className="mr-2 h-4 w-4 hidden sm:inline" /> Sự kiện
                </TabsTrigger>
                <TabsTrigger value="upsell" className="rounded-xl px-4 lg:px-6 py-2 lg:py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all flex-1 text-center bg-indigo-50/40 border border-indigo-100/30 text-indigo-700 hover:bg-indigo-50/80">
                   <Sparkles className="mr-2 h-4 w-4 hidden sm:inline text-indigo-500" /> Upsell
                </TabsTrigger>
              </TabsList>

              {/* ACTIVITIES CONTENT */}
              <TabsContent value="activities" className="mt-0 space-y-8 outline-none">
                {/* Elite Activity Form */}
                <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white border border-indigo-100/50 shadow-indigo-100/20">
                  <CardContent className="p-6">
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                      {[
                        { id: 'note', label: 'GHI CHÚ', icon: FileText, color: 'text-slate-500' },
                        { id: 'call', label: 'GỌI ĐIỆN', icon: Phone, color: 'text-amber-500' },
                        { id: 'meeting', label: 'GẶP MẶT', icon: Users, color: 'text-purple-500' },
                        { id: 'message', label: 'ZALO', icon: MessageCircle, color: 'text-indigo-500' },
                      ].filter(t => {
                        if (isManager) {
                          return t.id === 'note';
                        } else {
                          return t.id !== 'note';
                        }
                      }).map((type) => (
                        <Button 
                          key={type.id}
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewActivity({ ...newActivity, type: type.id })}
                          className={`rounded-xl text-[10px] font-black h-10 px-5 transition-all ${newActivity.type === type.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-400'}`}
                        >
                          <type.icon className={`mr-2 h-4 w-4 ${newActivity.type === type.id ? 'text-white' : type.color}`} /> {type.label}
                        </Button>
                      ))}
                    </div>
                    <textarea 
                      className="w-full min-h-[140px] bg-slate-50 rounded-[24px] p-6 text-sm focus:ring-0 focus:bg-white border-2 border-transparent focus:border-slate-100 transition-all placeholder:text-slate-400 font-medium resize-none shadow-inner"
                      placeholder="Ghi lại kết quả tư vấn, lý do khách chưa chốt đơn hoặc các lưu ý phục vụ CSKH..."
                      value={newActivity.content}
                      onChange={(e) => setNewActivity({ ...newActivity, content: e.target.value })}
                    />
                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center gap-3">
                         <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-50"></div>
                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Live Synchronization</p>
                      </div>
                      <Button onClick={handleAddActivity} className="rounded-xl px-10 font-black text-xs bg-slate-900 hover:bg-black h-11 shadow-xl shadow-slate-200 hover:scale-105 transition-all uppercase tracking-widest">
                        Lưu nhật ký
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* VISUAL TIMELINE AXIS */}
                <div className="space-y-8">
                   <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-3">
                         <Filter className="w-4 h-4 text-slate-400" />
                         <div className="flex gap-2">
                            {['all', 'call', 'order', 'message', 'note'].map(t => (
                               <button 
                                  key={t}
                                  onClick={() => setFilterType(t)}
                                  className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${filterType === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                               >
                                  {t === 'all' ? 'TẤT CẢ' : t}
                               </button>
                            ))}
                         </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{filteredActivities.length} Hoạt động</p>
                   </div>

                   <div className="relative pl-10 space-y-10 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-slate-200 before:via-slate-100 before:to-transparent before:content-['']">
                    {loadingActivities ? (
                      <div className="py-20 text-center flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-slate-200" />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Retrieving History...</p>
                      </div>
                    ) : filteredActivities.length > 0 ? (
                      filteredActivities.map((activity) => (
                        <div key={activity.id} className="relative animate-in fade-in slide-in-from-left-4 duration-500">
                          {/* Timeline Bullet Icon */}
                          <div className={`absolute -left-[43px] top-0 w-11 h-11 rounded-2xl border-4 border-[#f8fafc] shadow-lg flex items-center justify-center z-10 transition-transform hover:scale-110 ${getActivityColor(activity.activity_type)}`}>
                            {getActivityIcon(activity.activity_type)}
                          </div>
                          
                          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative border-l-4 border-l-transparent hover:border-l-slate-900">
                            <div className="flex items-center justify-between mb-4">
                               <div className="flex items-center gap-4">
                                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">
                                    {activity.activity_type === 'note' ? 'Hệ thống ghi chú' : 
                                     activity.activity_type === 'handoff' ? 'BÀN GIAO & NHU CẦU' : 
                                     activity.activity_type === 'call' ? 'CUỘC GỌI' :
                                     activity.activity_type === 'zalo_message' ? 'TIN NHẮN ZALO' :
                                     activity.activity_type === 'online_consultation' ? 'TƯ VẤN ONLINE' :
                                     `Nhật ký ${activity.activity_type}`}
                                  </span>
                                 <span className="text-[10px] text-slate-300 font-bold flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full">
                                   <Clock className="w-3 h-3" /> {format(new Date(activity.created_at), "HH:mm · dd/MM/yyyy", { locale: vi })}
                                 </span>
                               </div>
                               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-200 hover:text-slate-900 rounded-xl"><Edit3 className="w-4 h-4" /></Button>
                               </div>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap pl-1">
                              {activity.content}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-24 text-center flex flex-col items-center justify-center bg-white rounded-[40px] border-2 border-dashed border-slate-100 mx-4">
                         <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center text-slate-100 mb-6 shadow-inner">
                            <Activity className="w-12 h-12" />
                         </div>
                         <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Chưa có dữ liệu tương tác</h3>
                         <p className="text-xs text-slate-400 mt-3 max-w-[300px] leading-relaxed font-medium">
                           Mọi hoạt động từ gọi điện, nhắn tin cho đến đơn hàng sẽ được hiển thị tại đây để bạn tiện theo dõi.
                         </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="outline-none">
                <Card className="rounded-[40px] border-none shadow-sm bg-white p-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-8">
                         <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                            <Target className="w-5 h-5 text-indigo-500" /> Mô hình quản trị Lead
                         </h4>
                         <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                            <div className="flex justify-between items-center">
                               <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">CHẾ ĐỘ CHĂM SÓC</span>
                               <Badge className="bg-slate-900 text-white border-none font-black text-[9px] uppercase px-4 py-1.5 rounded-full">{getCareModelLabel(customer.care_model)}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                               <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">NGUỒN DỮ LIỆU</span>
                               <Badge variant="outline" className="text-slate-600 border-slate-200 bg-white font-black text-[9px] uppercase px-4 py-1.5 rounded-full">{customer.customer_channel || "OFFLINE"}</Badge>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic border-t border-slate-200 pt-4 mt-4">
                               Phân tuyến này tự động điều phối quyền truy cập dữ liệu giữa Sale và Telesale để tối ưu hóa quy trình bán hàng.
                            </p>
                         </div>

                         {customer.note && (
                           <div className="p-8 bg-indigo-50/30 rounded-[32px] border border-indigo-100/50 space-y-3 mt-6">
                              <span className="text-[10px] text-indigo-500 font-black uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Nhu cầu & Ghi chú bàn giao
                              </span>
                              <p className="text-xs font-semibold text-slate-700 leading-relaxed pl-1 whitespace-pre-wrap">
                                 {customer.note}
                              </p>
                           </div>
                         )}
                      </div>
                      <div className="space-y-8">
                         <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-amber-500" /> Phân tuyến & Trạng thái
                         </h4>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Kênh tiếp cận</p>
                               <p className="text-xs font-bold text-slate-900">{getCustomerChannelLabel(customer.customer_channel)}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Khoảng cách</p>
                               <p className="text-xs font-bold text-slate-900">{getCustomerDistanceLabel(customer.customer_distance_type)}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 col-span-2">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mô hình chăm sóc</p>
                               <p className="text-xs font-bold text-slate-900">{getCareModelLabel(customer.care_model)}</p>
                            </div>
                         </div>

                         <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                            <Users className="w-5 h-5 text-indigo-500" /> Đội ngũ phụ trách
                         </h4>
                         <div className="space-y-4">
                            <div 
                               className="flex items-center gap-5 p-6 bg-white border border-slate-100 rounded-[28px] hover:shadow-lg hover:border-indigo-200 hover:ring-2 hover:ring-indigo-50 transition-all group cursor-pointer"
                               onClick={() => {
                                  if (isManager) {
                                     setIsAssignStaffOpen(true);
                                  } else {
                                     toast.error("Chỉ Admin hoặc Phó Admin mới có quyền phân tuyến người phụ trách.");
                                  }
                               }}
                            >
                               <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black border border-indigo-100 shadow-sm group-hover:scale-105 transition-transform uppercase">S</div>
                               <div className="flex-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Direct Sale</p>
                                  <p className="text-sm font-black text-slate-900">{getStaffName(customer.owner_sale_id) || "Chưa phân công"}</p>
                               </div>
                               <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-indigo-50"><ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600" /></Button>
                            </div>
                            <div 
                               className="flex items-center gap-5 p-6 bg-white border border-slate-100 rounded-[28px] hover:shadow-lg hover:border-rose-200 hover:ring-2 hover:ring-rose-50 transition-all group cursor-pointer"
                               onClick={() => {
                                  if (isManager) {
                                     setIsAssignStaffOpen(true);
                                  } else {
                                     toast.error("Chỉ Admin hoặc Phó Admin mới có quyền phân tuyến người phụ trách.");
                                  }
                               }}
                            >
                               <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-sm font-black border border-rose-100 shadow-sm group-hover:scale-105 transition-transform uppercase">T</div>
                               <div className="flex-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Telesale Hub</p>
                                  <p className="text-sm font-black text-slate-900">{getStaffName(customer.owner_tele_id) || "Chưa phân công"}</p>
                               </div>
                               <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-rose-50"><ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-rose-600" /></Button>
                            </div>
                         </div>
                      </div>
                   </div>
                </Card>
              </TabsContent>

              {/* TASKS TAB */}
              <TabsContent value="tasks" className="outline-none">
                <Card className="rounded-[40px] border-none shadow-sm bg-white overflow-hidden">
                  <div className="flex items-center justify-between p-8 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" /> Việc cần làm
                    </h3>
                    <Button 
                      size="sm" 
                      onClick={() => setIsAddTaskOpen(true)}
                      className="rounded-xl font-bold text-[10px] uppercase tracking-widest bg-slate-900 text-white hover:bg-primary"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Thêm việc
                    </Button>
                  </div>
                  <div className="p-8 space-y-4">
                    {tasks.length > 0 ? tasks.map(task => (
                      <div key={task.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                        <div className={`w-3 h-3 rounded-full ${task.status === 'completed' ? 'bg-emerald-500' : task.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                        <div className="flex-1">
                          <p className={`text-sm font-bold ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <span>{task.task_type}</span>
                            <span>•</span>
                            <span>Hạn: {task.due_at ? format(new Date(task.due_at), "dd/MM/yyyy HH:mm") : "Không có"}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase font-black">{task.status}</Badge>
                      </div>
                    )) : (
                      <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                        <CheckCircle2 className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="text-xs font-bold uppercase tracking-widest">Chưa có việc cần làm</p>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* ORDERS TAB */}
              <TabsContent value="orders" className="outline-none">
                 <Card className="rounded-[40px] border-none shadow-sm bg-white overflow-hidden">
                    <div className="p-8 border-b border-slate-100">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" /> Đơn hàng gần đây
                      </h3>
                    </div>
                    <div className="p-0">
                      {orders.length > 0 ? (
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                            <tr>
                              <th className="px-8 py-4">Mã đơn</th>
                              <th className="px-8 py-4">Ngày tạo</th>
                              <th className="px-8 py-4 text-right">Tổng tiền</th>
                              <th className="px-8 py-4 text-center">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {orders.map(order => (
                              <tr key={order.id} className="hover:bg-slate-50">
                                <td className="px-8 py-4 font-bold text-slate-900">{order.id.slice(0,8).toUpperCase()}</td>
                                <td className="px-8 py-4 text-slate-500 font-medium">{format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</td>
                                <td className="px-8 py-4 text-right font-black text-slate-900">{order.total?.toLocaleString('vi-VN')} đ</td>
                                <td className="px-8 py-4 text-center">
                                  <Badge className="text-[10px] uppercase font-black">{order.status}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="py-16 text-center text-slate-400 flex flex-col items-center">
                          <Package className="w-12 h-12 mb-3 text-slate-200" />
                          <p className="text-xs font-bold uppercase tracking-widest">Chưa có đơn hàng nào</p>
                        </div>
                      )}
                    </div>
                 </Card>
              </TabsContent>

              {/* APPOINTMENTS TAB */}
              <TabsContent value="appointments" className="outline-none">
                <Card className="rounded-[40px] border-none shadow-sm bg-white overflow-hidden">
                  <div className="flex items-center justify-between p-8 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-500" /> Lịch hẹn
                    </h3>
                  </div>
                  <div className="p-8 space-y-4">
                    {appointments.length > 0 ? appointments.map(app => (
                      <div key={app.id} className="flex gap-4 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center shrink-0">
                          <span className="text-xs font-black leading-none">{format(new Date(app.starts_at), "dd")}</span>
                          <span className="text-[8px] font-bold uppercase">{format(new Date(app.starts_at), "MMM", { locale: vi })}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{app.title}</p>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            <Clock className="w-3 h-3" /> {format(new Date(app.starts_at), "HH:mm")}
                            {app.location && <><MapPin className="w-3 h-3 ml-2" /> {app.location}</>}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                        <Calendar className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="text-xs font-bold uppercase tracking-widest">Không có lịch hẹn</p>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* EVENTS TAB */}
              <TabsContent value="events" className="outline-none">
                <Card className="rounded-[40px] border-none shadow-sm bg-white overflow-hidden">
                  <div className="p-8 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500" /> Sự kiện tham gia
                    </h3>
                  </div>
                  <div className="p-8 space-y-4">
                    {events.length > 0 ? events.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-amber-50/30">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{ev.company_events?.title || "Sự kiện không xác định"}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                            {ev.company_events?.starts_at ? format(new Date(ev.company_events.starts_at), "dd/MM/yyyy") : ""}
                          </p>
                        </div>
                        <Badge className={`text-[9px] uppercase font-black ${ev.status === 'attended' ? 'bg-emerald-100 text-emerald-700' : ev.status === 'no_show' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                          {ev.status}
                        </Badge>
                      </div>
                    )) : (
                      <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                        <Star className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="text-xs font-bold uppercase tracking-widest">Chưa đăng ký sự kiện nào</p>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* UPSELL & ANALYTICS TAB */}
              <TabsContent value="upsell" className="outline-none space-y-8">
                {/* 1. DOANH SỐ TÍCH LŨY & TIẾN TRÌNH THĂNG HẠNG */}
                <Card className="rounded-[40px] border-none shadow-sm bg-white overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" /> Thăng hạng thành viên Spa & Quyền lợi
                      </h3>
                      <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Hệ thống cấp hạng đại lý phân phối Desembre</p>
                    </div>
                    <Badge className={`font-black uppercase tracking-widest text-[10px] px-3.5 py-1 rounded-xl border-none ${totalSpend >= tierSettings.diamondThreshold ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white' : totalSpend >= tierSettings.goldThreshold ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white' : totalSpend > 0 ? 'bg-gradient-to-r from-slate-400 to-slate-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      Hạng hiện tại: {totalSpend >= tierSettings.diamondThreshold ? 'DIAMOND' : totalSpend >= tierSettings.goldThreshold ? 'GOLD' : totalSpend > 0 ? 'SILVER' : 'NEW CO'}
                    </Badge>
                  </div>
                  <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100/80">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tích lũy trọn đời (LTV)</span>
                        <span className="text-xl font-black text-slate-900">{totalSpend.toLocaleString('vi-VN')} đ</span>
                      </div>
                      <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100/80">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chiết khấu Đại lý hiện tại</span>
                        <span className="text-xl font-black text-indigo-600">{totalSpend >= tierSettings.diamondThreshold ? `${tierSettings.diamondDiscount}%` : totalSpend >= tierSettings.goldThreshold ? `${tierSettings.goldDiscount}%` : '60%'}</span>
                      </div>
                      <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100/80">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mục tiêu thăng hạng tiếp theo</span>
                        <span className="text-xl font-black text-slate-700">
                          {totalSpend >= tierSettings.diamondThreshold ? 'ĐẠT ĐỈNH HẠNG' : totalSpend >= tierSettings.goldThreshold ? `DIAMOND (${(tierSettings.diamondThreshold / 1000000).toFixed(0)}M)` : `GOLD (${(tierSettings.goldThreshold / 1000000).toFixed(0)}M)`}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {totalSpend < tierSettings.diamondThreshold && (
                      <div className="space-y-3 bg-indigo-50/20 p-6 rounded-3xl border border-indigo-100/30">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                          <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Tiến trình thăng cấp</span>
                          <span className="text-indigo-600 font-black">
                            Còn thiếu {((totalSpend >= tierSettings.goldThreshold ? tierSettings.diamondThreshold : tierSettings.goldThreshold) - totalSpend).toLocaleString('vi-VN')}đ để thăng hạng
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, (totalSpend / (totalSpend >= tierSettings.goldThreshold ? tierSettings.diamondThreshold : tierSettings.goldThreshold)) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mt-1">
                          Thăng hạng giúp đối tác tăng chiết khấu lên {totalSpend >= tierSettings.goldThreshold ? `${tierSettings.diamondDiscount}%` : `${tierSettings.goldDiscount}%`}, kích thích chủ Spa gom đơn lớn để hưởng lợi nhuận tối đa!
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 1.5. DỰ BÁO CHU KỲ HẾT HÀNG & TÁI ĐẶT HÀNG (REFILL & DEPLETION ALERT) */}
                <Card className="rounded-[40px] border-none shadow-sm bg-white overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-600 animate-pulse" /> Dự báo chu kỳ hết hàng & Tái đặt hàng
                      </h3>
                      <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Cảnh báo Refill & Depletion thông minh của Desembre</p>
                    </div>
                    {refillStats ? (
                      <span className={`font-black uppercase tracking-widest text-[9px] px-3 py-1 rounded-xl border ${refillStats.statusColor}`}>
                        {refillStats.statusLabel}
                      </span>
                    ) : (
                      <span className="font-black uppercase tracking-widest text-[9px] px-3 py-1 rounded-xl bg-slate-100 text-slate-400">
                        Chưa kích hoạt bộ đếm
                      </span>
                    )}
                  </div>
                  <CardContent className="p-8 space-y-6">
                    {refillStats ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100/80">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chu kỳ cạn kiệt</span>
                            <span className="text-base font-black text-slate-900">{refillStats.cycle} ngày</span>
                          </div>
                          <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100/80">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Đã sử dụng</span>
                            <span className="text-base font-black text-slate-900">{refillStats.elapsed} ngày trước</span>
                          </div>
                          <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100/80">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chu kỳ còn lại</span>
                            <span className={`text-base font-black ${refillStats.remaining <= 10 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {refillStats.remaining > 0 ? `${refillStats.remaining} ngày` : `Quá hạn ${Math.abs(refillStats.remaining)} ngày`}
                            </span>
                          </div>
                          <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100/80">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Đơn hàng kích hoạt gần nhất</span>
                            <span className="text-xs font-bold text-slate-600 block truncate">
                              Đơn #{refillStats.lastOrder.id?.substring(0, 8)} ({format(refillStats.lastDate, 'dd/MM/yyyy')})
                            </span>
                          </div>
                        </div>

                        {/* Progress display */}
                        <div className="space-y-3 bg-slate-50/50 p-6 rounded-3xl border border-slate-100/60">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                            <span className="flex items-center gap-1.5">📊 Tiến trình tiêu hao sản phẩm</span>
                            <span className="font-black text-indigo-600">
                              Mức độ tiêu thụ: {refillStats.progress.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${refillStats.remaining <= 10 ? 'bg-rose-500' : refillStats.remaining <= 25 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${refillStats.progress}%` }}
                            />
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mt-1">
                            {refillStats.remaining <= 10 
                              ? "⚠️ Lượng mỹ phẩm tại cơ sở ước lượng đã cạn kiệt! Nhân viên Sale cần kết nối ngay lập tức để tránh mất cơ hội bán thêm." 
                              : `Sản phẩm đang được Spa sử dụng trong liệu trình giường cabin. Ước tính sẽ cần tái đặt hàng trong ${refillStats.remaining} ngày tới.`
                            }
                          </p>
                        </div>

                        <div className="flex justify-end gap-3">
                          <a 
                            href={`tel:${customer?.phone}`}
                            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-10 px-6 shadow-sm shadow-indigo-100 transition-all"
                          >
                            📞 Gọi điện CSKH & Upsell ngay
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400 flex flex-col items-center max-w-lg mx-auto">
                        <Clock className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-800">Chưa kích hoạt bộ đếm ngược</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 text-center leading-relaxed">
                          Spa này chưa phát sinh đơn hàng thành công trên hệ thống. Khi đơn hàng đầu tiên được chốt thành công, CRM sẽ tự động đếm ngược chu kỳ tiêu thụ mỹ phẩm ({tierSettings.refillCycleDays} ngày) và đưa ra gợi ý Upsell gối đầu kịp thời cho Sale!
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. HỒ SƠ THIẾT BỊ CỦA SPA & GỢI Ý THÔNG MINH */}
                <Card className="rounded-[40px] border-none shadow-sm bg-white overflow-hidden">
                  <div className="p-8 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" /> Thiết bị & Công nghệ hiện có tại Spa
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Chọn máy móc Spa đang vận hành để kích hoạt kịch bản gợi ý Upsell phù hợp</p>
                  </div>
                  <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { id: 'laser', label: 'Máy Laser YAG/CO2', color: 'from-rose-500 to-red-600 shadow-rose-100' },
                        { id: 'hifu', label: 'Máy HIFU / Nâng cơ', color: 'from-amber-400 to-orange-500 shadow-amber-100' },
                        { id: 'needle', label: 'Thiết bị Phi kim/Lăn kim', color: 'from-emerald-400 to-teal-500 shadow-emerald-100' },
                        { id: 'rf', label: 'Máy RF / Giảm béo', color: 'from-cyan-400 to-blue-500 shadow-cyan-100' }
                      ].map((eq) => {
                        const isActive = spaEquipment.includes(eq.id);
                        return (
                          <button
                            key={eq.id}
                            onClick={() => {
                              if (!canEditCustomer) {
                                toast.error("Bạn không có quyền chỉnh sửa thông tin của Spa này.");
                                return;
                              }
                              toggleEquipment(eq.id);
                            }}
                            className={`p-5 rounded-3xl border-2 text-left transition-all duration-300 flex flex-col justify-between h-32 relative overflow-hidden group ${isActive ? `bg-gradient-to-br ${eq.color} border-transparent text-white shadow-xl scale-105` : 'bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-700'}`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${isActive ? 'bg-white/20' : 'bg-slate-200/50'}`}>
                              {eq.id.toUpperCase().slice(0, 2)}
                            </div>
                            <div>
                              <span className={`text-[10px] font-black tracking-widest uppercase block ${isActive ? 'text-white/70' : 'text-slate-400'}`}>Thiết bị</span>
                              <span className="text-xs font-black mt-1 leading-tight block">{eq.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* AI Smart Recommendation Alerts */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kịch bản tư vấn thông minh (AI Sales Scripts)</h4>
                      
                      {spaEquipment.length === 0 ? (
                        <div className="p-6 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 text-xs font-bold">
                          💡 Hãy chọn ít nhất một thiết bị Spa ở trên để hiển thị kịch bản Upsell mỹ phẩm gối đầu tương ứng!
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {spaEquipment.includes('laser') && (
                            <div className="p-6 rounded-3xl bg-rose-50 border border-rose-100/80 flex gap-4 items-start animate-fade-in">
                              <Sparkles className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                              <div>
                                <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest bg-rose-100 px-2 py-0.5 rounded">TƯ VẤN SAU LASER</span>
                                <p className="text-xs font-bold text-rose-900 mt-2 leading-relaxed">
                                  Spa có máy Laser ➡️ Khách hàng điều trị nám, sẹo, tàn nhang rất nhiều. Da sau Laser cực kỳ mỏng yếu và tổn thương.
                                </p>
                                <p className="text-xs font-medium text-rose-800 mt-1">
                                  👉 **Kịch bản Upsell:** Tư vấn ngay **Set Tế bào gốc phục hồi EGF Desembre** (hộp 10 ống) kèm Kem chống nắng vật lý bảo vệ chuyên sâu. Nhấn mạnh hiệu quả tái tạo da tức thì, tránh tăng sắc tố sau Laser.
                                </p>
                              </div>
                            </div>
                          )}

                          {spaEquipment.includes('needle') && (
                            <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100/80 flex gap-4 items-start animate-fade-in">
                              <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 animate-pulse" />
                              <div>
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-100 px-2 py-0.5 rounded">TƯ VẤN SAU PHI KIM</span>
                                <p className="text-xs font-bold text-emerald-900 mt-2 leading-relaxed">
                                  Spa làm dịch vụ Phi kim / Lăn kim ➡️ Liệu trình collagen cảm ứng rất cần chất dẫn phục hồi biểu bì sâu.
                                </p>
                                <p className="text-xs font-medium text-emerald-800 mt-1">
                                  👉 **Kịch bản Upsell:** Giới thiệu dòng **Mặt nạ thải độc sủi bọt Desembre Oxy Bubble Mask** hoặc Serum đặc trị sẹo rỗ, lỗ chân lông to của Desembre để làm sạch sâu cabin trước và nuôi da sau liệu trình phi kim.
                                </p>
                              </div>
                            </div>
                          )}

                          {spaEquipment.includes('hifu') && (
                            <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100/80 flex gap-4 items-start animate-fade-in">
                              <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                              <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-100 px-2 py-0.5 rounded">TƯ VẤN SAU HIFU / NÂNG CƠ</span>
                                <p className="text-xs font-bold text-amber-900 mt-2 leading-relaxed">
                                  Spa làm trẻ hóa nâng cơ bằng HIFU/RF ➡️ Cần bổ sung dưỡng chất nâng cơ, chống nhăn chùng chảy xệ tại nhà để duy trì kết quả máy.
                                </p>
                                <p className="text-xs font-medium text-amber-800 mt-1">
                                  👉 **Kịch bản Upsell:** Chào dòng **Kem dưỡng trẻ hóa peptide 24K Gold Desembre Luxury Gold** cao cấp. Tỷ lệ chốt cực cao vì tệp khách làm HIFU là tệp khách VIP, sẵn sàng chi trả mức giá trị lớn!
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 3. LỊCH SỬ NHÓM MỸ PHẨM ĐÃ MUA & CHƯA MUA */}
                <Card className="rounded-[40px] border-none shadow-sm bg-white overflow-hidden">
                  <div className="p-8 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Package className="w-5 h-5 text-indigo-500" /> Báo cáo Nhóm sản phẩm mua sắm của Spa
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Hệ thống phân chia 4 nhóm sản phẩm lõi cabin Spa để Sale tìm kiếm lỗ hổng chưa mua nhằm Upsell</p>
                  </div>
                  <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { 
                          name: 'Dòng Làm sạch & Thải độc (Cleansing)', 
                          desc: 'Sữa rửa mặt, mặt nạ oxy bong bóng sủi bọt, tẩy tế bào chết enzyme',
                          purchased: orders.length > 0, 
                          note: orders.length > 0 ? 'Đã mua đơn hàng trước' : 'Chưa từng mua' 
                        },
                        { 
                          name: 'Dòng Serum & Ampoule Trị liệu (EGF / Vitamin C)', 
                          desc: 'Tế bào gốc phục hồi, Vitamin C trị nám, serum mụn chuyên sâu',
                          purchased: false, 
                          note: 'Spa CHƯA MUA - Tỷ lệ lỗ hổng Upsell cực cao 🎯' 
                        },
                        { 
                          name: 'Dòng Kem dưỡng & Khóa ẩm Cabin (Creams)', 
                          desc: 'Kem cấp ẩm sâu Hyaluronic, kem phục hồi Hydro lipid bơ hạt mỡ',
                          purchased: orders.length > 0, 
                          note: orders.length > 0 ? 'Đã mua đơn hàng trước' : 'Chưa từng mua' 
                        },
                        { 
                          name: 'Dòng Chống nắng & Bảo vệ (Sun Shield)', 
                          desc: 'Kem chống nắng vật lý SPF 50+, gel làm dịu mát lô hội sau nắng',
                          purchased: false, 
                          note: 'Spa CHƯA MUA - Khách hàng đang bỏ ngỏ dòng bảo vệ da 🎯' 
                        }
                      ].map((cat, idx) => (
                        <div key={idx} className={`p-6 rounded-3xl border transition-all ${cat.purchased ? 'bg-emerald-50/10 border-emerald-100/50' : 'bg-slate-50 border-slate-100 hover:shadow-md'}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="text-xs font-black text-slate-900 leading-tight">{cat.name}</h5>
                              <p className="text-[10px] font-bold text-slate-400 mt-1">{cat.desc}</p>
                            </div>
                            <Badge className={`text-[8px] font-black uppercase tracking-wider border-none px-2 py-0.5 ${cat.purchased ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700 animate-pulse'}`}>
                              {cat.purchased ? 'ĐÃ MUA' : 'CHƯA MUA'}
                            </Badge>
                          </div>
                          
                          <div className="mt-4 flex items-center justify-between text-[9px] font-bold">
                            <span className={cat.purchased ? 'text-emerald-600' : 'text-rose-500 font-extrabold'}>{cat.note}</span>
                            {!cat.purchased && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 rounded-lg text-[9px] font-black tracking-widest text-indigo-600 bg-white border border-indigo-100 hover:bg-indigo-50/50"
                                onClick={() => {
                                  setNewActivity({
                                    type: 'call',
                                    content: `📞 Đã tư vấn thêm cho chủ Spa về nhóm sản phẩm "${cat.name}". Spa đang có nhu cầu tìm hiểu thử mẫu test dòng này.`
                                  });
                                  // Switch back to activities tab
                                  const trigger = document.querySelector('[value="activities"]') as HTMLButtonElement;
                                  if (trigger) trigger.click();
                                  toast.success(`Đã tự động soạn thảo nhật ký tư vấn Upsell dòng sản phẩm: ${cat.name}`);
                                }}
                              >
                                CHÀO MẪU TEST
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <TemplateDispatcher 
        customer={customer} 
        isOpen={isTemplateOpen} 
        onClose={() => setIsTemplateOpen(false)} 
      />

      <AddTaskDialog
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        customer={customer}
        onSuccess={fetchTasks}
      />

      <AssignStaffDialog
        customer={customer}
        isOpen={isAssignStaffOpen}
        onClose={() => setIsAssignStaffOpen(false)}
        onSuccess={fetchCustomer}
      />
    </div>
  );
}
