import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ChevronLeft,
  Phone,
  MapPin,
  UserCircle,
  Target,
  Users,
  FileText,
  Plus,
  MessageCircle,
  Activity,
  Sparkles,
  Star,
  Clock,
  Filter,
  CheckCircle2,
  Package,
  Calendar,
  AlertCircle,
  PhoneCall,
  User,
  ExternalLink,
  MoreHorizontal,
  Play,
  Check,
  PhoneOff,
  CalendarClock,
  UserX,
  Heart,
  ArrowRightLeft,
  Trash2,
  Briefcase,
  HeadphonesIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerUpsellIntel } from "@/components/customers/CustomerUpsellIntel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getLifecycleConfig,
  getCareModelLabel,
  getCustomerChannelLabel,
  getCustomerDistanceLabel,
} from "@/lib/customerOwnership";
import { buildStaffMap, getStaffDisplayName, StaffMap } from "@/lib/staffDisplay";
import { toast } from "sonner";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { TemplateDispatcher } from "@/components/marketing/TemplateDispatcher";
import { AssignStaffDialog } from "@/components/customers/AssignStaffDialog";
import { AddTaskDialog } from "@/components/customers/AddTaskDialog";
import { TaskActionDialog } from "@/components/workspace/TaskActionDialog";
import { getTaskStatusLabel, getTaskTypeLabel } from "@/lib/tasks";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_CROSS_SELL_RULES = [
  {
    id: "cleansing",
    name: "Dòng Làm sạch & Thải độc (Cleansing)",
    desc: "Sữa rửa mặt, mặt nạ oxy bong bóng sủi bọt, tẩy tế bào chết enzyme",
    note_purchased: "Đã mua đơn hàng trước",
    note_not_purchased: "Chưa từng mua",
    action_label: "CHÀO MẪU TEST",
  },
  {
    id: "serum",
    name: "Dòng Serum & Ampoule Trị liệu (EGF / Vitamin C)",
    desc: "Tế bào gốc phục hồi, Vitamin C trị nám, serum mụn chuyên sâu",
    note_purchased: "Đã mua serum trị liệu trước đó",
    note_not_purchased: "Spa CHƯA MUA - Tỷ lệ lỗ hổng Upsell cực cao 🎯",
    action_label: "CHÀO MẪU TEST",
  },
  {
    id: "cream",
    name: "Dòng Kem dưỡng & Khóa ẩm Cabin (Creams)",
    desc: "Kem cấp ẩm sâu Hyaluronic, kem phục hồi Hydro lipid bơ hạt mỡ",
    note_purchased: "Đã mua đơn hàng trước",
    note_not_purchased: "Chưa từng mua",
    action_label: "CHÀO MẪU TEST",
  },
  {
    id: "sunblock",
    name: "Dòng Chống nắng & Bảo vệ (Sun Shield)",
    desc: "Kem chống nắng vật lý SPF 50+, gel làm dịu mát lô hội sau nắng",
    note_purchased: "Đã mua kem chống nắng trước đó",
    note_not_purchased: "Spa CHƯA MUA - Khách hàng đang bỏ ngỏ dòng bảo vệ da 🎯",
    action_label: "CHÀO MẪU TEST",
  },
];

const DEFAULT_SPA_EQUIPMENT_SCRIPTS: Record<
  string,
  { label: string; tag: string; desc: string; script: string }
> = {
  laser: {
    label: "Máy Laser YAG/CO2",
    tag: "TƯ VẤN SAU LASER",
    desc: "Spa có máy Laser ➡️ Khách hàng điều trị nám, sẹo, tàn nhang rất nhiều. Da sau Laser cực kỳ mỏng yếu và tổn thương.",
    script:
      "Tư vấn ngay **Set Tế bào gốc phục hồi EGF Desembre** (hộp 10 ống) kèm Kem chống nắng vật lý bảo vệ chuyên sâu. Nhấn mạnh hiệu quả tái tạo da tức thì, tránh tăng sắc tố sau Laser.",
  },
  needle: {
    label: "Thiết bị Phi kim/Lăn kim",
    tag: "TƯ VẤN SAU PHI KIM",
    desc: "Spa làm dịch vụ Phi kim / Lăn kim ➡️ Liệu trình collagen cảm ứng rất cần chất dẫn phục hồi biểu bì sâu.",
    script:
      "Giới thiệu dòng **Mặt nạ thải độc sủi bọt Desembre Oxy Bubble Mask** hoặc Serum đặc trị sẹo rỗ, lỗ chân lông to của Desembre để làm sạch sâu cabin trước và nuôi da sau liệu trình phi kim.",
  },
  hifu: {
    label: "Máy HIFU / Nâng cơ",
    tag: "TƯ VẤN SAU HIFU / NÂNG CƠ",
    desc: "Spa làm trẻ hóa nâng cơ bằng HIFU/RF ➡️ Cần bổ sung dưỡng chất nâng cơ, chống nhăn chùng chảy xệ tại nhà để duy trì kết quả máy.",
    script:
      "Chào dòng **Kem dưỡng trẻ hóa peptide 24K Gold Desembre Luxury Gold** cao cấp. Tỷ lệ chốt cực cao vì tệp khách làm HIFU là tệp khách VIP, sẵn sàng chi trả mức giá trị lớn!",
  },
  rf: {
    label: "Máy RF / Giảm béo",
    tag: "TƯ VẤN GIẢM BÉO & SĂN CHẮC",
    desc: "Spa có máy RF hoặc máy giảm béo cơ thể/mặt ➡️ Liệu trình tiêu mỡ cần kem massage và gel dẫn hỗ trợ hóa lỏng mỡ thừa.",
    script:
      "Giới thiệu dòng **Kem massage giảm béo nóng Desembre** kết hợp với RF để tăng hiệu quả đốt mỡ x3 lần và Serum nâng cơ peptide.",
  },
};

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
      const savedTier = localStorage.getItem("system_tier_settings");
      return savedTier
        ? {
            ...JSON.parse(savedTier),
            crossSellRules: DEFAULT_CROSS_SELL_RULES,
            spaEquipmentScripts: DEFAULT_SPA_EQUIPMENT_SCRIPTS,
          }
        : {
            goldThreshold: 50000000,
            goldDiscount: 62,
            diamondThreshold: 100000000,
            diamondDiscount: 65,
            refillCycleDays: 60,
            crossSellRules: DEFAULT_CROSS_SELL_RULES,
            spaEquipmentScripts: DEFAULT_SPA_EQUIPMENT_SCRIPTS,
          };
    } catch {
      return {
        goldThreshold: 50000000,
        goldDiscount: 62,
        diamondThreshold: 100000000,
        diamondDiscount: 65,
        refillCycleDays: 60,
        crossSellRules: DEFAULT_CROSS_SELL_RULES,
        spaEquipmentScripts: DEFAULT_SPA_EQUIPMENT_SCRIPTS,
      };
    }
  });

  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [staffMap, setStaffMap] = useState<StaffMap>({});

  // Activity Log State
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: "note", content: "" });
  const [filterType, setFilterType] = useState<string>("all");

  // Customer 360 States
  const [tasks, setTasks] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Dialog Toggles
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isAssignStaffOpen, setIsAssignStaffOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);

  // Task Actions State
  const [taskAction, setTaskAction] = useState<{ task: any; action: string } | null>(null);

  // Quick Activity Form State
  const [quickActivity, setQuickActivity] = useState({
    type: "note",
    title: "",
    content: "",
    next_follow_up_at: "",
  });

  const [spaEquipment, setSpaEquipment] = useState<string[]>([]);

  // Fetch settings from Database
  useEffect(() => {
    async function fetchSystemSettings() {
      try {
        const { data } = await supabase.from("system_settings").select("*").maybeSingle();

        const savedCrossSell = localStorage.getItem("system_cross_sell_rules");
        const savedSpaScripts = localStorage.getItem("system_spa_equipment_scripts");

        if (data) {
          setTierSettings({
            goldThreshold: Number(data.gold_threshold ?? 50000000),
            goldDiscount: Number(data.gold_discount ?? 62),
            diamondThreshold: Number(data.diamond_threshold ?? 100000000),
            diamondDiscount: Number(data.diamond_discount ?? 65),
            refillCycleDays: Number(data.refill_cycle_days ?? 60),
            crossSellRules:
              data.cross_sell_rules &&
              Array.isArray(data.cross_sell_rules) &&
              data.cross_sell_rules.length > 0
                ? data.cross_sell_rules
                : savedCrossSell
                  ? JSON.parse(savedCrossSell)
                  : DEFAULT_CROSS_SELL_RULES,
            spaEquipmentScripts:
              data.spa_equipment_scripts &&
              typeof data.spa_equipment_scripts === "object" &&
              Object.keys(data.spa_equipment_scripts).length > 0
                ? data.spa_equipment_scripts
                : savedSpaScripts
                  ? JSON.parse(savedSpaScripts)
                  : DEFAULT_SPA_EQUIPMENT_SCRIPTS,
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
    const completedOrders = orders.filter(
      (o) => o.status === "completed" || o.status === "delivered" || !o.status,
    );
    if (completedOrders.length === 0) return null;

    const sorted = [...completedOrders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const last = sorted[0];

    const lastDate = new Date(last.created_at);
    const today = new Date();
    const elapsed = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
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
      statusColor,
    };
  }, [orders, tierSettings]);

  const canEditCustomer = useMemo(() => {
    if (!user || !customer) return false;
    if (isManager) return true;
    if (isSale && customer.owner_sale_id === user.id) return true;
    if (isTeleLead && customer.owner_tele_id === user.id) return true;
    return false;
  }, [user, customer, isManager, isSale, isTeleLead]);

  const totalSpend = useMemo(() => {
    return orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  }, [orders]);

  const spaTier = useMemo(() => {
    if (totalSpend >= 100000000)
      return {
        label: "💎 DIAMOND",
        color:
          "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white shadow-sm border-none text-[9px]",
      };
    if (totalSpend >= 50000000)
      return {
        label: "🥇 GOLD",
        color:
          "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-white shadow-sm border-none text-[9px]",
      };
    if (totalSpend > 0)
      return {
        label: "🥈 SILVER",
        color:
          "bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600 text-white shadow-sm border-none text-[9px]",
      };
    return { label: "NEW CO", color: "bg-slate-100 text-slate-500 border-none text-[9px]" };
  }, [totalSpend]);

  const toggleEquipment = async (eqName: string) => {
    const next = spaEquipment.includes(eqName)
      ? spaEquipment.filter((x) => x !== eqName)
      : [...spaEquipment, eqName];

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
      toast.error("Không thể lưu thay đổi");
    }
  };

  const handleDeleteCustomer = async () => {
    if (!canEditCustomer) {
      toast.error("Bạn không có quyền thực hiện hành động này!");
      return;
    }

    const reason = window.prompt(
      "⚠️ CẢNH BÁO: HÀNH ĐỘNG NÀY SẼ XÓA MỀM KHÁCH HÀNG KHỎI HỆ THỐNG.\n\nVui lòng nhập lý do xóa khách hàng (bắt buộc):",
    );
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Lý do xóa khách hàng không được để trống!");
      return;
    }

    try {
      const { error } = await supabase
        .from("customers")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          delete_reason: reason.trim(),
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Đã xóa khách hàng thành công (Soft delete)!");
      navigate({ to: "/customers" });
    } catch (e: any) {
      toast.error("Không thể xóa khách hàng: " + e.message);
    }
  };

  const fetchCustomer = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("Error fetching customer:", error);
      toast.error("Không thể tải thông tin khách hàng");
    } else {
      setCustomer(data);
      if (data && data.spa_equipment && Array.isArray(data.spa_equipment)) {
        setSpaEquipment(data.spa_equipment);
      } else {
        try {
          const saved = localStorage.getItem(`spa_equipment_${id}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            setSpaEquipment(parsed);
          }
        } catch (err) {
          console.error("Failed to parse local spa equipment:", err);
        }
      }
    }
    setLoading(false);
  };

  const fetchTasks = async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("customer_tasks")
        .select("*")
        .eq("customer_id", id)
        .order("due_at", { ascending: false });
      if (data) setTasks(data);
    } catch (e) {
      console.error("Error fetching tasks:", e);
    }
  };

  const fetchOrders = async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (data) setOrders(data);
    } catch (e) {
      console.error("Error fetching orders:", e);
    }
  };

  const fetchOrderItems = async () => {
    if (!id) return;
    try {
      const { data: customerOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("customer_id", id);
      if (customerOrders && customerOrders.length > 0) {
        const orderIds = customerOrders.map((o: any) => o.id);
        const { data } = await supabase
          .from("order_items")
          .select("*, order:orders(created_at, status)")
          .in("order_id", orderIds);
        if (data) setOrderItems(data);
      } else {
        setOrderItems([]);
      }
    } catch (e) {
      console.error("Error fetching order items:", e);
    }
  };

  const fetchAppointments = async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("customer_id", id)
        .order("starts_at", { ascending: false });
      if (data) setAppointments(data);
    } catch (e) {
      console.error("Error fetching appointments:", e);
    }
  };

  const fetchEvents = async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("event_registrations")
        .select("*, company_events(*)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (data) setEvents(data);
    } catch (e) {
      console.error("Error fetching events:", e);
    }
  };

  const fetchActivities = async () => {
    if (!id) return;
    setLoadingActivities(true);
    try {
      const { data } = await supabase
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

  useEffect(() => {
    fetchCustomer();
    fetchActivities();
    fetchTasks();
    fetchOrders();
    fetchAppointments();
    fetchEvents();
    fetchOrderItems();
  }, [id]);

  useEffect(() => {
    async function fetchProfiles() {
      if (!customer) return;
      const ids = [customer.owner_sale_id, customer.owner_tele_id].filter(Boolean) as string[];
      if (ids.length === 0) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", ids);
        if (data) {
          setStaffMap(buildStaffMap(data));
        }
      } catch (err) {
        console.error("Error fetching staff profiles in detail page:", err);
      }
    }
    fetchProfiles();
  }, [customer]);

  const handleAddActivity = async () => {
    if (!quickActivity.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề nhật ký");
      return;
    }
    try {
      const { error } = await supabase.from("customer_activities").insert([
        {
          customer_id: id,
          created_by: user?.id,
          activity_type: quickActivity.type,
          title: quickActivity.title,
          content: quickActivity.content,
          next_follow_up_at: quickActivity.next_follow_up_at || null,
        },
      ]);

      if (!error) {
        // Cập nhật trạng thái khách hàng tương ứng
        const updates: any = { last_contacted_at: new Date().toISOString() };
        if (quickActivity.next_follow_up_at) {
          updates.next_follow_up_at = quickActivity.next_follow_up_at;
        }

        await supabase.from("customers").update(updates).eq("id", id);

        setQuickActivity({
          type: "note",
          title: "",
          content: "",
          next_follow_up_at: "",
        });
        setIsAddActivityOpen(false);
        fetchActivities();
        fetchCustomer();
        toast.success("Đã lưu nhật ký tương tác");
      } else {
        throw error;
      }
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    }
  };

  const filteredActivities = useMemo(() => {
    if (filterType === "all") return activities;
    return activities.filter((a) => a.activity_type === filterType);
  }, [activities, filterType]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="w-3.5 h-3.5" />;
      case "meeting":
      case "online_consultation":
      case "showroom_meeting":
      case "direct_visit":
        return <Users className="w-3.5 h-3.5" />;
      case "message":
      case "zalo_message":
        return <MessageCircle className="w-3.5 h-3.5" />;
      case "order":
      case "order_created":
        return <Package className="w-3.5 h-3.5" />;
      case "handoff":
        return <Sparkles className="w-3.5 h-3.5 text-indigo-500" />;
      default:
        return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "call":
        return "bg-blue-50 text-blue-600 border-blue-100";
      case "meeting":
      case "online_consultation":
      case "showroom_meeting":
      case "direct_visit":
        return "bg-purple-50 text-purple-600 border-purple-100";
      case "message":
      case "zalo_message":
        return "bg-sky-50 text-sky-650 border-sky-100";
      case "order":
      case "order_created":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "handoff":
        return "bg-amber-50 text-amber-700 border-amber-100";
      default:
        return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  const renderStatusBadge = (stage: string) => {
    const config = getLifecycleConfig(stage);
    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-black px-2.5 py-0.5 ${config.bg} ${config.text} ${config.border} rounded-lg`}
      >
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          Đang tải hồ sơ khách hàng...
        </p>
      </div>
    );
  }

  if (!customer)
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50">
        <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
        <h2 className="text-lg font-bold text-slate-900">Không tìm thấy khách hàng</h2>
        <Button onClick={() => navigate({ to: "/customers" })} className="mt-4">
          Quay lại danh sách
        </Button>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* TOP NAVIGATION & ACTIONS */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-start justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10 bg-slate-50 border border-slate-200 hover:bg-slate-100 shrink-0 mt-1"
              onClick={() => navigate({ to: "/customers" })}
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                  {customer.business_name ||
                    customer.facility_name ||
                    customer.name ||
                    "Khách Hàng Tự Do"}
                </h1>
                {renderStatusBadge(customer.lifecycle_stage)}
                <Badge
                  className={`font-black uppercase tracking-wider rounded-lg border-none px-2 py-0.5 ${spaTier.color}`}
                >
                  {spaTier.label}
                </Badge>
                {customer.is_vip && (
                  <Badge className="bg-amber-100 text-amber-700 border-none text-[9px] font-black">
                    <Star className="w-2.5 h-2.5 mr-1 fill-amber-500 text-amber-500" /> VIP
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1.5">
                  <UserCircle className="w-4 h-4 text-slate-400" />{" "}
                  {customer.contact_name || customer.name || "N/A"}
                </span>
                {customer.phone && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-slate-400" /> {customer.phone}
                    </span>
                  </>
                )}
                {customer.city && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400" /> {customer.city}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <NotificationBell />
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 font-bold text-xs h-10 px-4 text-white shadow-sm transition-all"
              >
                <PhoneCall className="mr-2 h-4 w-4" /> Gọi điện
              </a>
            )}
            <Button
              variant="outline"
              onClick={() => setIsAddActivityOpen(true)}
              className="rounded-xl border-slate-200 font-bold text-xs bg-white text-slate-700 hover:bg-slate-50 h-10 px-4 shadow-sm"
            >
              <FileText className="mr-2 h-4 w-4 text-indigo-500" /> Ghi chú
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAddTaskOpen(true)}
              className="rounded-xl border-slate-200 font-bold text-xs bg-white text-slate-700 hover:bg-slate-50 h-10 px-4 shadow-sm"
            >
              <CheckCircle2 className="mr-2 h-4 w-4 text-blue-500" /> Việc cần làm
            </Button>
            <Button
              onClick={() => navigate({ to: "/orders/new", search: { customerId: customer.id } })}
              className="rounded-xl font-bold text-xs bg-slate-900 hover:bg-black text-white h-10 px-5 shadow-sm transition-all"
            >
              <Plus className="mr-2 h-4 w-4" /> Đơn hàng
            </Button>
            {canEditCustomer && (
              <Button
                variant="outline"
                onClick={handleDeleteCustomer}
                className="rounded-xl border-rose-200 font-bold text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 h-10 px-4 shadow-sm ml-2"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* CUSTOMER CARE OWNERS MINI CARD */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Sale phụ trách
                </p>
                <p className="text-sm font-bold text-slate-900 leading-none">
                  {getStaffDisplayName(customer.owner_sale_id, staffMap)}
                </p>
              </div>
            </div>
            {isManager && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 h-8 rounded-lg"
                onClick={() => setIsAssignStaffOpen(true)}
              >
                Gán lại
              </Button>
            )}
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <HeadphonesIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Telesale hỗ trợ
                </p>
                <p className="text-sm font-bold text-slate-900 leading-none">
                  {getStaffDisplayName(customer.owner_tele_id, staffMap)}
                </p>
              </div>
            </div>
            {isManager && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 h-8 rounded-lg"
                onClick={() => setIsAssignStaffOpen(true)}
              >
                Gán lại
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-white p-1 rounded-2xl border border-slate-200 shadow-3xs mb-8 flex flex-nowrap w-full overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth">
              <TabsTrigger
                value="overview"
                className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 shrink-0 text-center"
              >
                Tổng quan
              </TabsTrigger>
              <TabsTrigger
                value="activities"
                className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 shrink-0 text-center"
              >
                Nhật ký chăm sóc
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 shrink-0 text-center"
              >
                Việc cần làm
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 shrink-0 text-center"
              >
                Đơn hàng
              </TabsTrigger>
              <TabsTrigger
                value="appointments"
                className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 shrink-0 text-center"
              >
                Lịch hẹn
              </TabsTrigger>
              <TabsTrigger
                value="events"
                className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex-1 shrink-0 text-center"
              >
                Sự kiện
              </TabsTrigger>
              <TabsTrigger
                value="upsell"
                className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all flex-1 shrink-0 text-center text-indigo-650 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/50"
              >
                Gợi ý Upsell
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW CONTENT (Tổng quan) */}
            <TabsContent value="overview" className="mt-0 outline-none space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Basic profile info card */}
                <Card className="rounded-3xl border border-slate-200 shadow-sm bg-white p-6 md:col-span-2">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-6 flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-500" /> Thông tin cơ bản
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Tên liên hệ</p>
                      <p className="text-sm font-black text-slate-800">
                        {customer.contact_name || customer.name || "N/A"}
                      </p>
                    </div>
                    {customer.email && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                        <p className="text-sm font-black text-slate-800">{customer.email}</p>
                      </div>
                    )}
                    <div className="space-y-1.5 sm:col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        Địa chỉ cụ thể
                      </p>
                      <p className="text-sm font-bold text-slate-700 leading-relaxed">
                        {customer.address || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Quy mô Spa</p>
                      <p className="text-sm font-bold text-slate-700">
                        <span className="text-slate-900 font-black">{customer.bed_count || 0}</span>{" "}
                        Giường &middot;{" "}
                        <span className="text-slate-900 font-black">
                          {customer.staff_count || 0}
                        </span>{" "}
                        Nhân viên
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Care pipeline and route */}
                <Card className="rounded-3xl border-none shadow-3xs bg-white p-6">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-5 flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-500" /> Tuyến chăm sóc
                  </h3>
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Kênh tiếp cận
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase font-bold bg-white text-slate-600 border-slate-200"
                      >
                        {getCustomerChannelLabel(customer.customer_channel) || "Chưa thiết lập"}
                      </Badge>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Phân loại khoảng cách
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase font-bold bg-white text-slate-600 border-slate-200"
                      >
                        {getCustomerDistanceLabel(customer.customer_distance_type) ||
                          "Chưa thiết lập"}
                      </Badge>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Mô hình hỗ trợ
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase font-bold bg-white text-slate-600 border-slate-200"
                      >
                        {getCareModelLabel(customer.care_model) || "Chưa thiết lập"}
                      </Badge>
                    </div>
                  </div>
                </Card>

                {/* Purchase KPIs card */}
                <Card className="rounded-3xl border-none shadow-3xs bg-white p-6">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-5 flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-500" /> Chỉ số mua hàng
                  </h3>
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Số đơn hàng
                      </span>
                      <span className="text-sm font-black text-slate-900">
                        {customer.total_orders_count || 0} đơn
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Doanh số tích lũy
                      </span>
                      <span className="text-sm font-black text-indigo-600">
                        {new Intl.NumberFormat("vi-VN").format(customer.total_order_amount || 0)}đ
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Đơn hàng cuối
                      </span>
                      <span className="text-[11px] font-bold text-slate-700">
                        {customer.last_order_at
                          ? format(new Date(customer.last_order_at), "dd/MM/yyyy")
                          : "Chưa phát sinh"}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Follow up stats card */}
                <Card className="rounded-3xl border-none shadow-3xs bg-white p-6 md:col-span-2">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-5 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-500" /> Kế hoạch Follow-up
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between h-20">
                      <span className="text-[9px] text-slate-450 font-bold uppercase">
                        Lần tương tác cuối
                      </span>
                      <span className="text-sm font-black text-slate-850">
                        {customer.last_contacted_at
                          ? format(new Date(customer.last_contacted_at), "dd/MM/yyyy HH:mm")
                          : "N/A"}
                      </span>
                    </div>
                    <div className="p-3 bg-rose-50/20 rounded-xl border border-rose-100/50 flex flex-col justify-between h-20">
                      <span className="text-[9px] text-rose-600 font-bold uppercase">
                        Ngày hẹn follow-up tiếp
                      </span>
                      <span className="text-sm font-black text-rose-700">
                        {customer.next_follow_up_at
                          ? format(new Date(customer.next_follow_up_at), "dd/MM/yyyy HH:mm")
                          : "Chưa lên lịch"}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* ACTIVITIES CONTENT (Nhật ký chăm sóc) */}
            <TabsContent value="activities" className="mt-0 outline-none space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Tất cả", value: "all" },
                      { label: "Cuộc gọi", value: "call" },
                      { label: "Gặp trực tiếp", value: "direct_visit" },
                      { label: "Zalo", value: "zalo_message" },
                      { label: "Đơn hàng", value: "order_created" },
                      { label: "Ghi chú", value: "note" },
                    ].map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setFilterType(f.value)}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                          filterType === f.value
                            ? "bg-slate-900 border-slate-900 text-white shadow-3xs"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => setIsAddActivityOpen(true)}
                  className="bg-slate-900 text-white hover:bg-black rounded-xl text-xs font-bold px-4"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Thêm hoạt động
                </Button>
              </div>

              <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                {filteredActivities.length > 0 ? (
                  filteredActivities.map((act) => (
                    <div key={act.id} className="relative group">
                      <div
                        className={`absolute left-[-29px] top-1.5 w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center shadow-3xs group-hover:border-primary transition-colors ${getActivityColor(act.activity_type)}`}
                      >
                        {getActivityIcon(act.activity_type)}
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs hover:shadow-2xs transition-all space-y-1.5">
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-xs font-bold text-slate-800">
                            {act.title || "Nhật ký tương tác"}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {format(new Date(act.created_at), "HH:mm dd/MM/yyyy", { locale: vi })}
                          </span>
                        </div>
                        {act.content && (
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            {act.content}
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-0.5">
                          <Badge
                            variant="outline"
                            className="text-[8px] px-1.5 py-0 h-4 bg-slate-50 border-slate-250 text-slate-500 font-bold uppercase"
                          >
                            {act.activity_type || "note"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                    <Activity className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Chưa có nhật ký hoạt động nào
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TASKS CONTENT (Việc cần làm) */}
            <TabsContent value="tasks" className="mt-0 outline-none space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Danh sách việc cần làm
                </h3>
                <Button
                  size="sm"
                  onClick={() => setIsAddTaskOpen(true)}
                  className="bg-slate-900 text-white hover:bg-black rounded-xl text-xs font-bold px-4"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Thêm việc
                </Button>
              </div>

              {tasks.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-3xs flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-850">{t.title}</span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] uppercase font-black px-1.5 py-0 ${
                              t.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : t.status === "in_progress"
                                  ? "bg-blue-50 text-blue-700 border-blue-100"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {getTaskStatusLabel(t.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase mt-1">
                          <span>{getTaskTypeLabel(t.task_type)}</span>
                          <span>&middot;</span>
                          <span>
                            Hạn: {t.due_at ? format(new Date(t.due_at), "dd/MM/yyyy HH:mm") : "N/A"}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-8 h-8 rounded-lg hover:bg-slate-100 border border-slate-200"
                            >
                              <MoreHorizontal className="w-4 h-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => setTaskAction({ task: t, action: "start" })}
                            >
                              <Play className="w-3.5 h-3.5 mr-2 text-blue-500" /> Bắt đầu xử lý
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTaskAction({ task: t, action: "completed" })}
                            >
                              <Check className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Hoàn thành
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTaskAction({ task: t, action: "no_answer" })}
                            >
                              <PhoneOff className="w-3.5 h-3.5 mr-2 text-red-500" /> Không nghe máy
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTaskAction({ task: t, action: "wrong_number" })}
                            >
                              <UserX className="w-3.5 h-3.5 mr-2 text-slate-500" /> Sai số
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTaskAction({ task: t, action: "interested" })}
                            >
                              <Heart className="w-3.5 h-3.5 mr-2 text-pink-500" /> Khách quan tâm
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTaskAction({ task: t, action: "call_back_later" })}
                            >
                              <CalendarClock className="w-3.5 h-3.5 mr-2 text-amber-500" /> Hẹn gọi
                              lại
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTaskAction({ task: t, action: "transfer_to_sale" })}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 mr-2 text-indigo-500" /> Cần
                              chuyển Sale
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                  <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Chưa có việc cần làm
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ORDERS CONTENT (Đơn hàng) */}
            <TabsContent value="orders" className="mt-0 outline-none space-y-4">
              <Card className="rounded-3xl border-none shadow-3xs bg-white overflow-hidden">
                {orders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4">Mã đơn</th>
                          <th className="px-6 py-4">Ngày tạo</th>
                          <th className="px-6 py-4 text-right">Tổng tiền</th>
                          <th className="px-6 py-4 text-center">Trạng thái</th>
                          <th className="px-6 py-4 text-center">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.slice(0, 5).map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-50/55 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">
                              #{ord.order_no || ord.id.slice(0, 8).toUpperCase()}
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-medium">
                              {format(new Date(ord.created_at), "dd/MM/yyyy HH:mm")}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-slate-900">
                              {ord.total?.toLocaleString("vi-VN")} đ
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge className="text-[9px] uppercase font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700 border-none">
                                {ord.status || "Chờ duyệt"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 rounded-lg hover:bg-slate-100 text-indigo-600"
                                onClick={() => navigate({ to: `/orders/${ord.id}` })}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-400 flex flex-col items-center">
                    <Package className="w-10 h-10 mb-2 text-slate-200" />
                    <p className="text-xs font-bold uppercase tracking-widest">
                      Chưa có đơn hàng nào phát sinh
                    </p>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* APPOINTMENTS CONTENT (Lịch hẹn) */}
            <TabsContent value="appointments" className="mt-0 outline-none space-y-4">
              {appointments.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {appointments.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-3xs flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center shrink-0 border border-indigo-100 shadow-3xs">
                        <span className="text-sm font-black leading-none">
                          {format(new Date(app.starts_at), "dd")}
                        </span>
                        <span className="text-[8px] font-bold uppercase mt-0.5">
                          {format(new Date(app.starts_at), "MMM", { locale: vi })}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{app.title}</p>
                        <p className="text-[10px] text-slate-450 font-bold mt-1 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />{" "}
                            {format(new Date(app.starts_at), "HH:mm")}
                          </span>
                          {app.location && (
                            <>
                              <span>&middot;</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {app.location}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                  <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Không có lịch hẹn nào
                  </p>
                </div>
              )}
            </TabsContent>

            {/* EVENTS CONTENT (Sự kiện) */}
            <TabsContent value="events" className="mt-0 outline-none space-y-4">
              {events.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-3xs flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {ev.company_events?.title || "Sự kiện Desembre"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                          {ev.company_events?.starts_at
                            ? format(new Date(ev.company_events.starts_at), "dd/MM/yyyy", {
                                locale: vi,
                              })
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase font-black ${
                          ev.status === "attended"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : ev.status === "no_show"
                              ? "bg-rose-50 text-rose-700 border-rose-100"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ev.status || "Chờ xác nhận"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                  <Star className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Chưa đăng ký sự kiện nào
                  </p>
                </div>
              )}
            </TabsContent>

            {/* UPSELL CONTENT */}
            <TabsContent value="upsell" className="mt-0 outline-none space-y-6">
              <CustomerUpsellIntel orders={orders} items={orderItems} totalSpend={totalSpend} />

              {/* Thiết bị & Công nghệ hiện có tại Spa */}
              <Card className="rounded-3xl border-none shadow-3xs bg-white p-6">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-4">
                  Thiết bị & Công nghệ tại Spa
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    {
                      id: "laser",
                      label: "Máy Laser YAG/CO2",
                      color: "from-rose-500 to-rose-600 border-rose-200 text-white",
                    },
                    {
                      id: "hifu",
                      label: "Máy HIFU / Nâng cơ",
                      color: "from-amber-500 to-amber-600 border-amber-200 text-white",
                    },
                    {
                      id: "needle",
                      label: "Thiết bị Phi kim/Lăn kim",
                      color: "from-emerald-500 to-emerald-600 border-emerald-200 text-white",
                    },
                    {
                      id: "rf",
                      label: "Máy RF / Giảm béo",
                      color: "from-blue-500 to-blue-600 border-blue-200 text-white",
                    },
                  ].map((eq) => {
                    const isActive = spaEquipment.includes(eq.id);
                    return (
                      <button
                        key={eq.id}
                        onClick={() => {
                          if (!canEditCustomer) {
                            toast.error("Bạn không có quyền chỉnh sửa.");
                            return;
                          }
                          toggleEquipment(eq.id);
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                          isActive
                            ? `bg-gradient-to-br ${eq.color} border-transparent shadow-md scale-102`
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-wider">
                          {eq.id}
                        </div>
                        <span className="text-[11px] font-black leading-tight">{eq.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Kịch bản gợi ý CSKH (AI Scripts)
                  </h4>
                  {spaEquipment.length > 0 ? (
                    <div className="space-y-3">
                      {spaEquipment.map((eqId) => {
                        const script = tierSettings.spaEquipmentScripts?.[eqId];
                        if (!script) return null;
                        return (
                          <div
                            key={eqId}
                            className="p-4 rounded-xl bg-indigo-50/30 border border-indigo-150/50 space-y-1.5"
                          >
                            <span className="text-[8px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                              {script.tag}
                            </span>
                            <p className="text-xs font-bold text-slate-900 leading-snug">
                              {script.desc}
                            </p>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                              <strong>Gợi ý:</strong> {script.script}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center font-bold py-4">
                      Chọn thiết bị phía trên để xem kịch bản gợi ý bán hàng.
                    </p>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
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

      {/* QUICK ADD ACTIVITY DIALOG */}
      <Dialog open={isAddActivityOpen} onOpenChange={(o) => !o && setIsAddActivityOpen(false)}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
              ✍️ Thêm ghi chú chăm sóc nhanh
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-500 uppercase">
                  Loại hoạt động
                </Label>
                <Select
                  value={quickActivity.type}
                  onValueChange={(val) => setQuickActivity({ ...quickActivity, type: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Ghi chú (Note)</SelectItem>
                    <SelectItem value="call">Cuộc gọi (Call)</SelectItem>
                    <SelectItem value="direct_visit">Gặp trực tiếp (Visit)</SelectItem>
                    <SelectItem value="zalo_message">Zalo Message</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-500 uppercase">
                  Hẹn ngày gọi lại (Tùy chọn)
                </Label>
                <Input
                  type="datetime-local"
                  value={quickActivity.next_follow_up_at}
                  onChange={(e) =>
                    setQuickActivity({ ...quickActivity, next_follow_up_at: e.target.value })
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-500 uppercase">
                Tiêu đề ghi chú <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="VD: Trao đổi phác đồ trị nám..."
                value={quickActivity.title}
                onChange={(e) => setQuickActivity({ ...quickActivity, title: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-500 uppercase">
                Chi tiết trao đổi
              </Label>
              <Textarea
                placeholder="Nhập nội dung trao đổi chi tiết với chủ Spa..."
                value={quickActivity.content}
                onChange={(e) => setQuickActivity({ ...quickActivity, content: e.target.value })}
                className="min-h-[80px] text-xs resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddActivityOpen(false)}
              className="text-xs font-bold"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleAddActivity}
              className="bg-slate-900 text-white hover:bg-black text-xs font-bold px-4"
            >
              Lưu ghi chú
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TaskActionDialog
        taskAction={taskAction}
        onClose={() => setTaskAction(null)}
        onSuccess={fetchTasks}
      />
    </div>
  );
}
