import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CustomerUpsellIntel } from "./CustomerUpsellIntel";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, 
  Phone, 
  UserCircle, 
  MapPin, 
  Calendar, 
  History, 
  Package, 
  Star,
  Clock,
  Target,
  Sparkles,
  Info,
  ChevronRight,
  Loader2,
  Trophy,
  Activity,
  Plus,
  Send,
  CalendarCheck,
  CheckSquare,
  UserCheck,
  MessageCircle,
  Copy,
  AlertTriangle,
  PhoneCall,
  Video,
  FileText,
  MoreHorizontal,
  Play,
  Check,
  PhoneOff,
  UserX,
  Heart,
  CalendarClock,
  ArrowRightLeft
} from "lucide-react";
import { 
  getCustomerChannelLabel, 
  getCustomerDistanceLabel, 
  getCareModelLabel,
  getStaffName
} from "@/lib/customerOwnership";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskActionDialog } from "@/components/workspace/TaskActionDialog";

interface CustomerPreviewDrawerProps {
  customer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getStaffName?: (id?: string | null) => string;
}

export const CustomerPreviewDrawer: React.FC<CustomerPreviewDrawerProps> = ({
  customer: customerProp,
  open,
  onOpenChange,
  getStaffName: getStaffNameProp
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [activeCustomer, setActiveCustomer] = useState<any | null>(null);
  const customer = activeCustomer || customerProp || {};

  const [activities, setActivities] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  // Task Actions
  const [taskAction, setTaskAction] = useState<{ task: any; action: string } | null>(null);

  // Quick Action Toggles
  const [quickAction, setQuickAction] = useState<null | "note" | "task" | "followup">(null);

  // Form states
  const [noteForm, setNoteForm] = useState({
    activity_type: "note",
    title: "",
    content: "",
    next_follow_up_at: ""
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    due_at: "",
    priority: "normal"
  });

  const [followupForm, setFollowupForm] = useState({
    title: "",
    starts_at: "",
    location: "Online / Tại Spa khách hàng",
    description: ""
  });

  // Timeline Filters
  const [timelineFilter, setTimelineFilter] = useState<string>("all");

  useEffect(() => {
    if (open && customerProp?.id) {
      setActiveCustomer(null);
      setQuickAction(null);
      setTimelineFilter("all");
      fetchCustomerDetails();
    } else {
      setActiveCustomer(null);
    }
  }, [open, customerProp?.id]);

  const fetchCustomerDetails = async () => {
    if (!customerProp?.id) return;
    setLoading(true);
    
    // Check if we need to load base profile details
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerProp.id)
        .single();
      if (!error && data) {
        setActiveCustomer(data);
      }
    } catch (err) {
      console.error("Error loading customer base profile:", err);
    }

    const fetchActivities = async () => {
      try {
        const { data, error } = await supabase
          .from("customer_activities")
          .select("*")
          .eq("customer_id", customerProp.id)
          .order("created_at", { ascending: false });
        if (!error && data) setActivities(data);
      } catch (err) {
        console.error("Error fetching activities:", err);
      }
    };

    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", customerProp.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (!error && data) setOrders(data);
      } catch (err) {
        console.error("Error fetching orders:", err);
      }
    };

    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from("event_registrations")
          .select("*, company_events(*)")
          .eq("customer_id", customerProp.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (!error && data) setEvents(data);
      } catch (err) {
        console.error("Error fetching events:", err);
      }
    };

    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from("customer_tasks")
          .select("*")
          .eq("customer_id", customerProp.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (!error && data) setTasks(data || []);
      } catch (err) {
        console.error("Error fetching tasks:", err);
      }
    };

    const fetchAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("customer_id", customerProp.id)
          .order("starts_at", { ascending: false })
          .limit(5);
        if (!error && data) setAppointments(data || []);
      } catch (err) {
        console.error("Error fetching appointments:", err);
      }
    };

    const fetchOrderItems = async () => {
      try {
        const { data: customerOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("customer_id", customerProp.id);
        
        if (customerOrders && customerOrders.length > 0) {
          const orderIds = customerOrders.map(o => o.id);
          const { data: itemsData, error } = await supabase
            .from("order_items")
            .select("*, order:orders(created_at, status)")
            .in("order_id", orderIds);
          if (!error && itemsData) {
            setOrderItems(itemsData);
          }
        } else {
          setOrderItems([]);
        }
      } catch (err) {
        console.error("Error fetching order items:", err);
      }
    };

    await Promise.all([
      fetchActivities(),
      fetchOrders(),
      fetchEvents(),
      fetchTasks(),
      fetchAppointments(),
      fetchOrderItems()
    ]);
    
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!noteForm.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề ghi chú");
      return;
    }

    setSubmitting(true);
    try {
      const { error: actError } = await supabase
        .from("customer_activities")
        .insert([{
          customer_id: customer.id,
          created_by: user?.id,
          activity_type: noteForm.activity_type,
          title: noteForm.title,
          content: noteForm.content,
          next_follow_up_at: noteForm.next_follow_up_at || null
        }]);

      if (actError) throw actError;

      // Update follow up and contacted timestamp on customer
      const updates: any = { last_contacted_at: new Date().toISOString() };
      if (noteForm.next_follow_up_at) {
        updates.next_follow_up_at = noteForm.next_follow_up_at;
      }
      
      await supabase.from("customers").update(updates).eq("id", customer.id);

      toast.success("Đã ghi nhận hoạt động chăm sóc!");
      setNoteForm({
        activity_type: "note",
        title: "",
        content: "",
        next_follow_up_at: ""
      });
      setQuickAction(null);
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error("Lỗi thêm hoạt động: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề công việc");
      return;
    }
    if (!taskForm.due_at) {
      toast.error("Vui lòng chọn hạn chót");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("customer_tasks")
        .insert([{
          customer_id: customer.id,
          title: taskForm.title,
          due_at: taskForm.due_at,
          priority: taskForm.priority,
          status: "pending",
          assigned_to: user?.id,
          task_type: "call"
        }]);

      if (error) throw error;

      await supabase
        .from("customer_activities")
        .insert([{
          customer_id: customer.id,
          created_by: user?.id,
          activity_type: "task_created",
          title: "Đã giao việc mới (Task)",
          content: `Tiêu đề: ${taskForm.title} - Hạn chót: ${formatDate(taskForm.due_at)}`
        }]);

      toast.success("Đã tạo việc cần làm thành công!");
      setTaskForm({
        title: "",
        due_at: "",
        priority: "normal"
      });
      setQuickAction(null);
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error("Lỗi tạo công việc: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFollowup = async () => {
    if (!followupForm.title.trim()) {
      toast.error("Vui lòng nhập nội dung buổi hẹn");
      return;
    }
    if (!followupForm.starts_at) {
      toast.error("Vui lòng chọn thời gian bắt đầu");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("calendar_events")
        .insert([{
          customer_id: customer.id,
          title: followupForm.title,
          starts_at: followupForm.starts_at,
          ends_at: new Date(new Date(followupForm.starts_at).getTime() + 60 * 60 * 1000).toISOString(),
          location: followupForm.location,
          description: followupForm.description,
          assigned_sale_id: customer.owner_sale_id || user?.id
        }]);

      if (error) throw error;

      // Log activity
      await supabase
        .from("customer_activities")
        .insert([{
          customer_id: customer.id,
          created_by: user?.id,
          activity_type: "follow_up",
          title: "Lên lịch hẹn chăm sóc (Follow-up)",
          content: `Đã lên lịch hẹn: "${followupForm.title}" - Thời gian: ${new Date(followupForm.starts_at).toLocaleString('vi-VN')} - Địa điểm: ${followupForm.location || "Chưa rõ"}`
        }]);

      toast.success("Đã lên lịch hẹn thành công!");

      setFollowupForm({
        title: "",
        starts_at: "",
        location: "Online / Tại Spa khách hàng",
        description: ""
      });
      setQuickAction(null);
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error("Lỗi tạo lịch hẹn: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyMessage = () => {
    const text = `Kính gửi anh/chị ${customer.contact_name || customer.name || 'chủ Spa'}, Desembre xin phép gửi thông tin hỗ trợ...`;
    navigator.clipboard.writeText(text);
    toast.success("Đã copy tin nhắn mẫu!");
  };

  const getCareModelWarning = () => {
    if (!customer.care_model) return "Chưa xác lập mô hình hỗ trợ.";
    if ((customer.care_model === "sale_only" || customer.care_model === "direct_sale") && !customer.owner_sale_id) {
      return "Mô hình Sale: Thiếu Sale phụ trách.";
    }
    if (customer.care_model === "tele_qualified_then_sale" || customer.care_model === "both" || customer.care_model === "joint") {
      if (!customer.owner_tele_id && !customer.owner_sale_id) {
        return "Mô hình phối hợp: Thiếu cả Tele hỗ trợ và Sale phụ trách.";
      }
      if (!customer.owner_tele_id) {
        return "Mô hình phối hợp: Thiếu Tele hỗ trợ phụ trách.";
      }
      if (!customer.owner_sale_id) {
        return "Mô hình phối hợp: Thiếu Sale phụ trách.";
      }
    }
    return null;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Chưa có";
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: vi });
  };

  const getDayKey = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      
      if (d.toDateString() === today.toDateString()) return "Hôm nay";
      if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";
      return format(d, "dd 'tháng' MM, yyyy", { locale: vi });
    } catch {
      return "Khác";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="w-3.5 h-3.5 text-blue-500" />;
      case "zalo_message":
        return <MessageCircle className="w-3.5 h-3.5 text-sky-500" />;
      case "direct_visit":
        return <MapPin className="w-3.5 h-3.5 text-orange-500" />;
      case "online_consultation":
        return <Video className="w-3.5 h-3.5 text-purple-500" />;
      case "quote_sent":
        return <FileText className="w-3.5 h-3.5 text-teal-500" />;
      case "order_created":
        return <Package className="w-3.5 h-3.5 text-emerald-500" />;
      case "check_in":
        return <Clock className="w-3.5 h-3.5 text-rose-500" />;
      case "handoff":
        return <UserCheck className="w-3.5 h-3.5 text-amber-500" />;
      case "event_registered":
        return <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-50" />;
      case "task_created":
        return <Plus className="w-3.5 h-3.5 text-indigo-500" />;
      case "task_completed":
        return <Check className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const mergedTimeline = useMemo(() => {
    let list: any[] = [];
    
    // Add activities
    activities.forEach(act => {
      list.push({
        id: act.id,
        type: act.activity_type || 'note',
        title: act.title || 'Ghi chú chăm sóc',
        content: act.content,
        created_at: act.created_at,
        raw: act
      });
    });

    // Add orders as order_created activities
    orders.forEach(ord => {
      list.push({
        id: `order-${ord.id}`,
        type: 'order_created',
        title: `Đã tạo đơn hàng #${ord.order_no || ord.id.slice(0, 8)}`,
        content: `Trị giá: ${formatCurrency(ord.total || ord.total_amount || 0)} · Trạng thái: ${ord.status || 'Chờ duyệt'}`,
        created_at: ord.created_at,
        raw: ord
      });
    });

    // Add event registrations as event activities
    events.forEach(ev => {
      list.push({
        id: `event-${ev.id}`,
        type: 'event_registered',
        title: `Đăng ký sự kiện: ${ev.company_events?.title || 'Sự kiện Desembre'}`,
        content: `Trạng thái tham gia: ${ev.status || 'Đăng ký thành công'}`,
        created_at: ev.created_at,
        raw: ev
      });
    });

    // Sort by created_at descending
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply filter
    if (timelineFilter !== "all") {
      list = list.filter(item => {
        if (timelineFilter === "event") return item.type === "event_registered";
        return item.type === timelineFilter;
      });
    }

    return list;
  }, [activities, orders, events, timelineFilter]);

  // Group timeline by day key
  const groupedTimeline = useMemo(() => {
    const map: Record<string, any[]> = {};
    mergedTimeline.forEach(item => {
      const key = getDayKey(item.created_at);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [mergedTimeline]);

  if (!customer.id) return null;

  const warning = getCareModelWarning();

  const getLifecycleBadgeColor = (stage: string) => {
    switch (stage) {
      case "new_lead": return "bg-sky-50 text-sky-700 border-sky-200";
      case "assigned": return "bg-blue-50 text-blue-700 border-blue-200";
      case "contacted": return "bg-amber-50 text-amber-700 border-amber-200";
      case "qualified": return "bg-purple-50 text-purple-700 border-purple-200";
      case "proposal": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "won": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "lost": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getPotentialBadgeColor = (level: string) => {
    switch (level) {
      case "hot": return "bg-red-500 text-white";
      case "warm": return "bg-amber-500 text-white";
      case "cold": return "bg-blue-400 text-white";
      default: return "bg-slate-300 text-slate-700";
    }
  };

  const staffNameSale = getStaffNameProp ? getStaffNameProp(customer.owner_sale_id) : getStaffName(customer.owner_sale_id);
  const staffNameTele = getStaffNameProp ? getStaffNameProp(customer.owner_tele_id) : getStaffName(customer.owner_tele_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col h-full border-l border-slate-200 shadow-2xl">
        
        {/* HEADER SECTION (UPGRADED TO QUICK AXIS CENTER) */}
        <div className="bg-slate-900 text-white p-6 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Building2 className="w-32 h-32" />
          </div>
          
          <div className="relative z-10 space-y-4">
            {/* BADGES & PHONE */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`border-none rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-wider uppercase ${getLifecycleBadgeColor(customer.lifecycle_stage || customer.status)}`}>
                  {customer.lifecycle_stage || customer.status || "Mới"}
                </Badge>
                {customer.potential_level && (
                  <Badge className={`border-none rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${getPotentialBadgeColor(customer.potential_level)}`}>
                    {customer.potential_level === "hot" ? "HOT 🔥" : customer.potential_level.toUpperCase()}
                  </Badge>
                )}
              </div>
              
              {customer.phone && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  {customer.phone}
                </div>
              )}
            </div>

            {/* CUSTOMER NAME AND FACILITY */}
            <div className="space-y-1">
              <h2 className="text-xl font-black tracking-tight leading-snug">
                {customer.contact_name || customer.name || "Khách hàng mới"}
              </h2>
              <p className="text-white/80 text-sm flex items-center gap-1.5 font-bold">
                <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {customer.business_name || customer.facility_name || "Spa Tự Do"}
              </p>
            </div>

            <Separator className="bg-white/10" />

            {/* UPGRADED GRID DATA ATTACHED IN THE HEADER FOR 30s ASSESSMENT */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-[11px] font-medium text-white/70">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Tuyến CS / Khoảng cách</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {getCustomerChannelLabel(customer.customer_channel) || "Chưa chọn"} &middot; {getCustomerDistanceLabel(customer.customer_distance_type) || "Chưa rõ"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Mô hình hỗ trợ</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  {getCareModelLabel(customer.care_model) || "Chưa thiết lập"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Sale phụ trách</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  {staffNameSale || "Chưa phân công"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Tele hỗ trợ</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {staffNameTele || "Chưa phân công"}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* CONTENT AREA */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8 pb-12">
            
            {/* CARE MODEL WARNING */}
            {warning && (
              <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-rose-800 text-[11px] font-medium leading-relaxed shadow-3xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold">Cần phân công:</span> {warning}
                </div>
              </div>
            )}

            {/* PERFORMANCE SUMMARY */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Trophy className="w-4 h-4 text-primary" /> Hiệu quả & Tóm tắt
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 grid grid-cols-2 gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-primary/60 uppercase">Tổng doanh số</div>
                    <div className="text-lg font-black text-primary">{formatCurrency(customer.total_order_amount || 0)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-primary/60 uppercase">Số đơn hàng</div>
                    <div className="text-lg font-black text-primary">{customer.total_orders_count || 0} đơn</div>
                  </div>
                </div>
                
                <div className="p-3 space-y-1 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <History className="w-3 h-3 text-slate-400" /> Tương tác cuối
                  </div>
                  <div className="text-[11px] font-medium text-slate-700">{formatDate(customer.last_contacted_at)}</div>
                </div>
                <div className="p-3 space-y-1 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-red-400" /> Hẹn cuộc gọi tiếp
                  </div>
                  <div className="text-[11px] font-bold text-red-650">{formatDate(customer.next_follow_up_at)}</div>
                </div>
              </div>
            </section>

            {/* QUICK ACTIONS BLOCK */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-primary" /> Hành động nhanh
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setQuickAction(quickAction === "note" ? null : "note")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-[11px] font-bold transition-all ${
                    quickAction === "note" 
                      ? "bg-primary border-primary text-white" 
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Ghi chú nhanh
                </button>
                <button
                  onClick={() => setQuickAction(quickAction === "task" ? null : "task")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-[11px] font-bold transition-all ${
                    quickAction === "task" 
                      ? "bg-primary border-primary text-white" 
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  Tạo task mới
                </button>
                <button
                  onClick={() => setQuickAction(quickAction === "followup" ? null : "followup")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-[11px] font-bold transition-all ${
                    quickAction === "followup" 
                      ? "bg-primary border-primary text-white" 
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <CalendarCheck className="w-4 h-4" />
                  Đặt lịch hẹn
                </button>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    navigate({ to: "/orders/new", search: { customerId: customer.id } });
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-bold transition-all"
                >
                  <Package className="w-4 h-4 text-emerald-500" />
                  Tạo đơn hàng
                </button>
                {customer.phone ? (
                  <>
                    <a
                      href={`https://zalo.me/${customer.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-bold transition-all"
                    >
                      <MessageCircle className="w-4 h-4 text-sky-500" />
                      Gửi Zalo
                    </a>
                    <button
                      onClick={handleCopyMessage}
                      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-bold transition-all"
                    >
                      <Copy className="w-4 h-4 text-slate-500" />
                      Copy tin nhắn
                    </button>
                  </>
                ) : (
                  <button
                    disabled
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-slate-300 text-[11px] font-bold cursor-not-allowed"
                  >
                    <PhoneOff className="w-4 h-4 text-slate-200" />
                    Không có SĐT
                  </button>
                )}
              </div>

              {/* Action forms */}
              {quickAction === "note" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary" /> THÊM GHI CHÚ CHĂM SÓC
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Loại hoạt động</Label>
                      <Select 
                        value={noteForm.activity_type} 
                        onValueChange={(v) => setNoteForm({ ...noteForm, activity_type: v })}
                      >
                        <SelectTrigger className="h-8 text-[11px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="note">Ghi chú (Note)</SelectItem>
                          <SelectItem value="call">Cuộc gọi (Call)</SelectItem>
                          <SelectItem value="zalo_message">Zalo Message</SelectItem>
                          <SelectItem value="direct_visit">Gặp trực tiếp</SelectItem>
                          <SelectItem value="handoff">Chuyển giao (Handoff)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Hẹn cuộc gọi tiếp</Label>
                      <Input 
                        type="datetime-local" 
                        value={noteForm.next_follow_up_at}
                        onChange={(e) => setNoteForm({ ...noteForm, next_follow_up_at: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Tiêu đề ghi chú <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="VD: Khách quan tâm dòng tế bào gốc EGF..."
                        value={noteForm.title}
                        onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Chi tiết trao đổi</Label>
                      <Textarea 
                        placeholder="Nội dung cụ thể trao đổi với chủ Spa..."
                        value={noteForm.content}
                        onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                        className="min-h-[70px] text-[11px] bg-white"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleAddNote} 
                    disabled={submitting}
                    className="w-full h-8 text-[11px] font-bold"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Send className="w-3 h-3 mr-2" />}
                    Lưu ghi chú
                  </Button>
                </div>
              )}

              {quickAction === "task" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-primary" /> ĐẶT TASK GỌI LẠI / LIÊN HỆ
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Tiêu đề công việc <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="VD: Gọi điện chốt hợp đồng, báo giá chiết khấu..."
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Hạn chót (Due Date) <span className="text-red-500">*</span></Label>
                      <Input 
                        type="datetime-local" 
                        value={taskForm.due_at}
                        onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Độ ưu tiên</Label>
                      <Select 
                        value={taskForm.priority} 
                        onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}
                      >
                        <SelectTrigger className="h-8 text-[11px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Thấp</SelectItem>
                          <SelectItem value="normal">Trung bình</SelectItem>
                          <SelectItem value="high">Cao 🔥</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button 
                    onClick={handleCreateTask} 
                    disabled={submitting}
                    className="w-full h-8 text-[11px] font-bold bg-primary hover:bg-primary/95"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                    Tạo việc cần làm
                  </Button>
                </div>
              )}

              {quickAction === "followup" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5 text-primary" /> HẸN LỊCH GẶP / LỊCH CHĂM SÓC
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Tên sự kiện / Nội dung gặp <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="VD: Gặp trực tiếp Demo sản phẩm..."
                        value={followupForm.title}
                        onChange={(e) => setFollowupForm({ ...followupForm, title: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Thời gian bắt đầu <span className="text-red-500">*</span></Label>
                      <Input 
                        type="datetime-local" 
                        value={followupForm.starts_at}
                        onChange={(e) => setFollowupForm({ ...followupForm, starts_at: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Địa điểm</Label>
                      <Input 
                        placeholder="Online / Spa khách..."
                        value={followupForm.location}
                        onChange={(e) => setFollowupForm({ ...followupForm, location: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Ghi chú thêm</Label>
                      <Textarea 
                        placeholder="Nội dung thảo luận hoặc chuẩn bị..."
                        value={followupForm.description}
                        onChange={(e) => setFollowupForm({ ...followupForm, description: e.target.value })}
                        className="min-h-[50px] text-[11px] bg-white"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleCreateFollowup} 
                    disabled={submitting}
                    className="w-full h-8 text-[11px] font-bold bg-primary hover:bg-primary/95"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Calendar className="w-3.5 h-3.5 mr-1.5" />}
                    Đặt lịch hẹn
                  </Button>
                </div>
              )}
            </section>

            {/* INTEL & UPSELL SECTION */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" /> Phân tích & Upsell thông minh
              </div>
              <CustomerUpsellIntel 
                orders={orders} 
                items={orderItems} 
                totalSpend={orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)} 
              />
            </section>

            {/* TIMELINE ACTIVITIES */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Activity className="w-4 h-4 text-primary" /> Lịch sử chăm sóc (Timeline)
                </div>
              </div>

              {/* TIMELINE FILTERS */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {[
                  { label: "Tất cả", value: "all" },
                  { label: "Cuộc gọi", value: "call" },
                  { label: "Gặp trực tiếp", value: "direct_visit" },
                  { label: "Zalo", value: "zalo_message" },
                  { label: "Báo giá", value: "quote_sent" },
                  { label: "Đơn hàng", value: "order_created" },
                  { label: "Sự kiện", value: "event" },
                  { label: "Ghi chú", value: "note" }
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setTimelineFilter(f.value)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                      timelineFilter === f.value
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-550 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : mergedTimeline.length > 0 ? (
                <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {Object.keys(groupedTimeline).map((dayKey) => (
                    <div key={dayKey} className="space-y-3">
                      <div className="relative pl-7">
                        <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-slate-200 border-2 border-white" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-[#f8fafc] pr-2">{dayKey}</span>
                      </div>
                      
                      {groupedTimeline[dayKey].map((item) => (
                        <div key={item.id} className="relative pl-7 group">
                          <div className="absolute left-1 top-2.5 w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-3xs group-hover:border-primary transition-colors">
                            {getActivityIcon(item.type)}
                          </div>
                          
                          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-3xs hover:shadow-2xs transition-all space-y-1.5">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-[11px] font-black text-slate-800 leading-snug">{item.title}</span>
                              <span className="text-[9px] text-slate-400 shrink-0 mt-0.5">{formatDate(item.created_at)}</span>
                            </div>
                            {item.content && <p className="text-[11px] text-slate-505 leading-relaxed font-medium">{item.content}</p>}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <Badge variant="outline" className="text-[8px] px-2 py-0 h-4 bg-slate-50 border-slate-200 text-slate-500 font-bold uppercase">
                                {item.type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Chưa có lịch sử chăm sóc</p>
                </div>
              )}
            </section>

            {/* RECENT ORDERS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Package className="w-4 h-4 text-primary" /> Đơn hàng gần đây
              </div>
              {orders.length > 0 ? (
                <div className="space-y-2">
                  {orders.map((ord) => (
                    <div 
                      key={ord.id} 
                      onClick={() => {
                        onOpenChange(false);
                        navigate({ to: "/orders/$id", params: { id: ord.id } });
                      }}
                      className="p-3.5 rounded-xl border border-slate-150 bg-white flex items-center justify-between hover:border-primary/20 transition-all cursor-pointer group shadow-3xs"
                    >
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Mã đơn: #{ord.order_no || ord.id.slice(0, 8)}</div>
                        <div className="text-xs font-black text-slate-800">{formatCurrency(ord.total || ord.total_amount || 0)}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge className="text-[9px] h-4 bg-slate-100 text-slate-700 border-none font-bold uppercase">{ord.status || 'Chờ duyệt'}</Badge>
                        <div className="text-[9px] text-slate-450">{formatDate(ord.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Chưa có đơn hàng
                </div>
              )}
            </section>

            {/* RECENT APPOINTMENTS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Calendar className="w-4 h-4 text-primary" /> Lịch hẹn gần đây
              </div>
              {appointments.length > 0 ? (
                <div className="space-y-2">
                  {appointments.map((app) => (
                    <div key={app.id} className="p-3.5 rounded-xl border border-slate-150 bg-white flex items-center justify-between shadow-3xs">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-800 leading-snug">{app.title}</div>
                        <div className="text-[10px] text-slate-450 font-bold flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {app.location || "Online"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-black text-indigo-650 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                          {formatDate(app.starts_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Chưa có lịch hẹn
                </div>
              )}
            </section>

            {/* RECENT TASKS WITH QUICK ACTION DROPDOWNS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <CheckSquare className="w-4 h-4 text-primary" /> Việc cần làm (Tasks)
              </div>
              {tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map((tsk) => (
                    <div key={tsk.id} className="p-3.5 rounded-xl border border-slate-150 bg-white flex items-center justify-between hover:border-primary/20 transition-all shadow-3xs">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-800 leading-snug">{tsk.title}</div>
                        {tsk.due_at && (
                          <div className="text-[9px] text-slate-400 font-medium">Hạn chót: {formatDate(tsk.due_at)}</div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Badge variant="outline" className={`text-[9px] h-4 font-bold border-none uppercase ${
                            tsk.status === 'completed' ? 'bg-emerald-500 text-white' :
                            tsk.status === 'in_progress' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {tsk.status === 'completed' ? 'Hoàn thành' : tsk.status === 'in_progress' ? 'Đang xử lý' : 'Chưa chạy'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="shrink-0 flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg hover:bg-slate-100">
                              <MoreHorizontal className="w-4 h-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "start" })}>
                              <Play className="w-3.5 h-3.5 mr-2 text-blue-500" /> Bắt đầu xử lý
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "completed" })}>
                              <Check className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Hoàn thành
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "no_answer" })}>
                              <PhoneOff className="w-3.5 h-3.5 mr-2 text-red-500" /> Không nghe máy
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "wrong_number" })}>
                              <UserX className="w-3.5 h-3.5 mr-2 text-slate-500" /> Sai số
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "interested" })}>
                              <Heart className="w-3.5 h-3.5 mr-2 text-pink-500" /> Khách quan tâm
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "call_back_later" })}>
                              <CalendarClock className="w-3.5 h-3.5 mr-2 text-amber-500" /> Hẹn gọi lại
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "transfer_to_sale" })}>
                              <ArrowRightLeft className="w-3.5 h-3.5 mr-2 text-indigo-500" /> Cần chuyển Sale
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Chưa có việc cần làm
                </div>
              )}
            </section>

            {/* RECENT EVENTS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Star className="w-4 h-4 text-amber-500" /> Sự kiện đã đăng ký
              </div>
              {events.length > 0 ? (
                <div className="space-y-2">
                  {events.map((ev) => (
                    <div key={ev.id} className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-100/70 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="font-bold text-xs text-amber-900 leading-relaxed">{ev.company_events?.title || "Sự kiện Desembre"}</div>
                        <Badge className="bg-amber-500 text-white border-none text-[8px] font-bold uppercase">{ev.status || 'Thành công'}</Badge>
                      </div>
                      <div className="text-[10px] text-amber-700/80 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" /> {formatDate(ev.company_events?.starts_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Chưa có sự kiện
                </div>
              )}
            </section>

          </div>
        </ScrollArea>

        {/* FOOTER ACTIONS */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-3 shadow-md">
          <button 
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-slate-250 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-3xs"
            onClick={() => onOpenChange(false)}
          >
            Đóng xem nhanh
          </button>
          <button 
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-all shadow-3xs"
            onClick={() => {
              navigate({ to: "/customers/$id", params: { id: customer.id } });
              onOpenChange(false);
            }}
          >
            Hồ sơ chi tiết <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </SheetContent>

      <TaskActionDialog 
        taskAction={taskAction}
        onClose={() => setTaskAction(null)}
        onSuccess={() => {
          fetchCustomerDetails();
        }}
      />
    </Sheet>
  );
};
