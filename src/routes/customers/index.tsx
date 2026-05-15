import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { normalizePhone } from "@/lib/phone";
import { 
  Users, 
  Plus, 
  Search, 
  ArrowLeft, 
  Download, 
  Building2, 
  MapPin, 
  Phone, 
  UserCircle,
  Headset,
  UserCheck,
  UserMinus,
  ShieldCheck,
  Target,
  Map,
  Sparkles,
  Pencil,
  Trash2,
  CalendarIcon,
  Loader2,
  Filter,
  CheckCircle2,
  AlertCircle,
  Table,
  Kanban,
  Shield,
  History,
  Tag,
  Mail
} from "lucide-react";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  type CustomerChannel,
  type CustomerDistanceType,
  type CustomerCareModel,
  getCustomerChannelLabel,
  getCustomerDistanceLabel,
  getCareModelLabel,
  CUSTOMER_CHANNEL_OPTIONS,
  CUSTOMER_DISTANCE_OPTIONS,
  CARE_MODEL_OPTIONS,
  DEFAULT_CUSTOMER_CHANNEL,
  DEFAULT_CUSTOMER_DISTANCE_TYPE,
  DEFAULT_CARE_MODEL,
} from "@/lib/customerOwnership";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export const Route = createFileRoute("/customers/")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  facility_name: string;
  phone: string;
  address: string;
  user_id?: string;
  created_at?: string;
  // Ownership Core Integration
  owner_sale_id?: string | null;
  owner_tele_id?: string | null;
  customer_channel?: CustomerChannel;
  customer_distance_type?: CustomerDistanceType;
  care_model?: CustomerCareModel;
  
  // B2B Elite Fields
  contact_name?: string;
  business_name?: string;
  normalized_phone?: string;
  email?: string;
  zalo?: string;
  facebook?: string;
  city?: string;
  district?: string;
  region?: string;
  business_type?: string;
  business_size?: string;
  main_service?: string;
  skin_concern_focus?: string;
  interested_products?: string;
  current_brands?: string;
  monthly_purchase_potential?: number;
  decision_maker?: string;
  decision_role?: string;
  preferred_contact_channel?: string;
  source?: string;
  status?: string;
  potential_level?: string;
  note?: string;
  tags?: string[];
  last_contacted_at?: string;
  next_follow_up_at?: string;
  last_order_at?: string;
  total_order_amount?: number;
  total_orders_count?: number;
  marketing_opt_in?: boolean;
  marketing_opt_in_at?: string;
  email_opt_in?: boolean;
  zalo_opt_in?: boolean;
  sms_opt_in?: boolean;
  created_by?: string;
  lifecycle_stage?: string;
  tax_code?: string;
  bed_count?: number;
  staff_count?: number;
  tech_equipment?: string;
  decision_maker_dob?: string;
  anniversary_date?: string;
};

// Global helper removed as it's now handled locally within the component per user request

// Helpers for Elite Badges
const getLifecycleBadge = (stage?: string) => {
  const stages: Record<string, { label: string; className: string }> = {
    lead: { label: "TIỀM NĂNG", className: "bg-blue-50 text-blue-700 border-blue-200" },
    prospect: { label: "CƠ HỘI", className: "bg-purple-50 text-purple-700 border-purple-200" },
    customer: { label: "ĐẠI LÝ", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    loyal: { label: "THÂN THIẾT", className: "bg-amber-50 text-amber-700 border-amber-200" },
    churned: { label: "NGỪNG CHĂM", className: "bg-red-50 text-red-700 border-red-200" },
  };
  const config = stages[stage || "lead"] || stages.lead;
  return <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 ${config.className}`}>{config.label}</Badge>;
};

const getPotentialBadge = (level?: string) => {
  const levels: Record<string, { label: string; color: string }> = {
    cold: { label: "LẠNH", color: "text-slate-400" },
    warm: { label: "ẤM", color: "text-amber-500" },
    hot: { label: "NÓNG", color: "text-red-500" },
  };
  const config = levels[level || "warm"] || levels.warm;
  return <span className={`text-[10px] font-extrabold flex items-center gap-0.5 ${config.color}`}>
    <Sparkles className="w-2.5 h-2.5" /> {config.label}
  </span>;
};

export function CustomersPage() {
  const { user, isSale, isTeleLead, isAdmin, isSubAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  
  // Trạng thái bộ lọc danh sách (Filter Dashboard)
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [distanceFilter, setDistanceFilter] = useState<string>("all");
  const [careModelFilter, setCareModelFilter] = useState<string>("all");
  const [onlyNeedsAssignment, setOnlyNeedsAssignment] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Trạng thái Form đầy đủ bao gồm section "Tuyến chăm sóc"
  const [form, setForm] = useState({
    name: "",
    facility_name: "",
    phone: "",
    address: "",
    customer_channel: "direct_sales" as CustomerChannel,
    customer_distance_type: "unknown" as CustomerDistanceType,
    care_model: "sale_owned" as CustomerCareModel,
    owner_sale_id: "none",
    owner_tele_id: "none",
    // B2B Elite Fields
    email: "",
    zalo: "",
    facebook: "",
    city: "",
    district: "",
    region: "",
    business_type: "SPA_CLINIC",
    business_size: "medium",
    main_service: "",
    skin_concern_focus: "",
    interested_products: "",
    current_brands: "",
    monthly_purchase_potential: 0,
    decision_maker: "",
    decision_role: "OWNER",
    preferred_contact_channel: "ZALO",
    source: "FACEBOOK",
    status: "new",
    potential_level: "warm",
    note: "",
    tags: [] as string[],
    marketing_opt_in: false,
    tax_code: "",
    bed_count: 0,
    staff_count: 0,
    tech_equipment: "",
    decision_maker_dob: "",
    lifecycle_stage: "lead",
    personality_trait: "",
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  
  // Trạng thái danh sách nhân sự tham chiếu ownership
  const [salesUsers, setSalesUsers] = useState<Array<{ id: string; full_name?: string; email?: string }>>([]);
  const [teleUsers, setTeleUsers] = useState<Array<{ id: string; full_name?: string; email?: string }>>([]);

  const isMock = !!localStorage.getItem("mock_session") || !!localStorage.getItem("mock_users");
  const [useLocalFallback, setUseLocalFallback] = useState(isMock);

  // Load danh sách nhân viên Sale và Tele dựa trên bảng user_roles + profiles (Source of Truth)
  useEffect(() => {
    async function fetchStaff() {
      try {
        // 1. Lấy danh sách các role map từ user_roles
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role");
          
        if (!rolesData) return;

        // 2. Lấy thông tin chi tiết từ bảng profiles
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, display_name, email");

        const profMap = new Map();
        if (profilesData) {
          profilesData.forEach(p => profMap.set(p.id, {
            id: p.id,
            display_name: p.display_name || p.full_name,
            full_name: p.full_name || p.display_name,
            email: p.email
          }));
        }

        // 3. Tách lọc danh sách chuẩn xác dựa trên user_roles
        const salesList: any[] = [];
        const teleList: any[] = [];

        rolesData.forEach(ur => {
          if (!ur.user_id) return;
          const pInfo = profMap.get(ur.user_id) || { 
            id: ur.user_id, 
            display_name: "User ID: " + String(ur.user_id).slice(0,6),
            full_name: "User ID: " + String(ur.user_id).slice(0,6),
            email: "User ID: " + String(ur.user_id).slice(0,6) 
          };
          if (ur.role === "sale") {
            salesList.push(pInfo);
          } else if (ur.role === "tele_lead") {
            teleList.push(pInfo);
          }
        });

        setSalesUsers(salesList);
        setTeleUsers(teleList);
      } catch {
        // Bỏ qua im lặng nếu DB lỗi phân quyền đọc
      }
    }
    fetchStaff();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const defaultBaselineData: Customer[] = [
      { 
        id: "sample-1", 
        name: "Chị Lan Anh", 
        facility_name: "Lan Anh Beauty & Spa", 
        phone: "0912345678", 
        address: "Quận Hoàn Kiếm, Hà Nội",
        customer_channel: "direct_sales",
        customer_distance_type: "near_company",
        care_model: "sale_owned"
      },
      { 
        id: "sample-2", 
        name: "Anh Minh Tuấn", 
        facility_name: "Tuấn Premium Clinic", 
        phone: "0987654321", 
        address: "Quận 1, TP. Hồ Chí Minh",
        customer_channel: "hybrid",
        customer_distance_type: "far_city",
        care_model: "sale_with_tele_support"
      },
    ];

    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      if (data.length === 0) {
        data = [...defaultBaselineData];
        try { localStorage.setItem("mock_customers", JSON.stringify(data)); } catch { /* ignore */ }
      }
      setCustomers(data.filter((c: any) => isAdmin || !c.user_id || c.user_id === user?.id));
      setLoading(false);
      return;
    }

    const query = supabase.from("customers").select("*");
    
    if (showDeleted) {
      query.not("deleted_at", "is", null);
    } else {
      query.is("deleted_at", null);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (error.code === '42P01' || msg.includes("find the table") || msg.includes("schema cache") || msg.includes("does not exist")) {
        setUseLocalFallback(true);
        let localData = JSON.parse(localStorage.getItem("mock_customers") || "[]");
        if (localData.length === 0) {
          localData = [...defaultBaselineData];
          try { localStorage.setItem("mock_customers", JSON.stringify(localData)); } catch { /* ignore */ }
        }
        setCustomers(localData);
        toast.success("Đã kích hoạt CSDL Khách hàng dự phòng cục bộ");
      } else {
        toast.error("Lỗi tải khách hàng: " + error.message);
        setCustomers([...defaultBaselineData]);
      }
    } else {
      setCustomers(data as Customer[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [useLocalFallback, user?.id, showDeleted]);

  const filtered = useMemo(() => {
    return customers.filter(c => {
      // 1. Lọc theo từ khóa tìm kiếm
      const q = query.trim().toLowerCase();
      if (q) {
        const matchQuery = 
          c.name?.toLowerCase().includes(q) || 
          c.facility_name?.toLowerCase().includes(q) || 
          c.phone?.includes(q);
        if (!matchQuery) return false;
      }

      // 2. Lọc theo Tuyến chăm sóc (Channel)
      if (channelFilter !== "all") {
        const ch = c.customer_channel || "direct_sales";
        if (ch !== channelFilter) return false;
      }

      // 3. Lọc theo Khoảng cách (Distance)
      if (distanceFilter !== "all") {
        const ds = c.customer_distance_type || "unknown";
        if (ds !== distanceFilter) return false;
      }

      // 4. Lọc theo Mô hình chăm sóc (Care Model)
      if (careModelFilter !== "all") {
        const cm = c.care_model || "sale_owned";
        if (cm !== careModelFilter) return false;
      }

      // 5. Lọc theo trạng thái Cần phân công
      if (onlyNeedsAssignment) {
        const isMissing = 
          (c.care_model === "sale_owned" && !c.owner_sale_id) ||
          (c.care_model === "tele_owned" && !c.owner_tele_id) ||
          !c.customer_channel;
        if (!isMissing) return false;
      }

      return true;
    });
  }, [customers, query, channelFilter, distanceFilter, careModelFilter, onlyNeedsAssignment]);

  const handleOpen = (c?: Customer) => {
    if (c) {
      setEditingId(c.id);
      setForm({ 
        name: c.name || "", 
        facility_name: c.facility_name || "", 
        phone: c.phone || "", 
        address: c.address || "",
        customer_channel: c.customer_channel || "direct_sales",
        customer_distance_type: c.customer_distance_type || "unknown",
        care_model: c.care_model || "sale_owned",
        owner_sale_id: c.owner_sale_id || (c as any).assigned_sale_id || c.user_id || "none",
        owner_tele_id: c.owner_tele_id || "none",
        // B2B Elite Fields
        email: c.email || "",
        zalo: c.zalo || "",
        facebook: c.facebook || "",
        city: c.city || "",
        district: c.district || "",
        region: c.region || "",
        business_type: c.business_type || "SPA_CLINIC",
        business_size: c.business_size || "medium",
        main_service: c.main_service || "",
        skin_concern_focus: c.skin_concern_focus || "",
        interested_products: c.interested_products || "",
        current_brands: c.current_brands || "",
        monthly_purchase_potential: c.monthly_purchase_potential || 0,
        decision_maker: c.decision_maker || "",
        decision_role: c.decision_role || "OWNER",
        preferred_contact_channel: c.preferred_contact_channel || "ZALO",
        source: c.source || "FACEBOOK",
        status: c.status || "new",
        potential_level: c.potential_level || "warm",
        note: c.note || "",
        tags: c.tags || [],
        marketing_opt_in: c.marketing_opt_in || false,
        tax_code: c.tax_code || "",
        bed_count: c.bed_count || 0,
        staff_count: c.staff_count || 0,
        tech_equipment: c.tech_equipment || "",
        decision_maker_dob: c.decision_maker_dob || "",
        lifecycle_stage: c.lifecycle_stage || "lead",
        personality_trait: (c as any).personality_trait || "",
      });
    } else {
      setEditingId(null);
      
      // Khởi tạo các giá trị mặc định chuẩn khi tạo mới (Default Baseline)
      let defaultChannel: CustomerChannel = DEFAULT_CUSTOMER_CHANNEL;
      let defaultCareModel: CustomerCareModel = DEFAULT_CARE_MODEL;
      let defaultOwnerSaleId = "";
      let defaultOwnerTeleId = "";

      // Nếu khách do Sale tạo
      if (isSale) {
        defaultOwnerSaleId = user?.id || "";
        defaultChannel = DEFAULT_CUSTOMER_CHANNEL;
        defaultCareModel = DEFAULT_CARE_MODEL;
      }
      // Nếu khách do Trưởng Tele tạo
      else if (isTeleLead) {
        defaultOwnerTeleId = user?.id || "";
        defaultChannel = "tele_sales";
        defaultCareModel = "tele_owned";
      }

      setForm({ 
        name: "", 
        facility_name: "", 
        phone: "", 
        address: "",
        customer_channel: defaultChannel,
        customer_distance_type: DEFAULT_CUSTOMER_DISTANCE_TYPE,
        care_model: defaultCareModel,
        owner_sale_id: defaultOwnerSaleId || "none",
        owner_tele_id: defaultOwnerTeleId || "none",
        // B2B Elite Fields Default
        email: "",
        zalo: "",
        facebook: "",
        city: "",
        district: "",
        region: "",
        business_type: "SPA_CLINIC",
        business_size: "medium",
        main_service: "",
        skin_concern_focus: "",
        interested_products: "",
        current_brands: "",
        monthly_purchase_potential: 0,
        decision_maker: "",
        decision_role: "OWNER",
        preferred_contact_channel: "ZALO",
        source: "FACEBOOK",
        status: "new",
        potential_level: "warm",
        note: "",
        tags: [],
        marketing_opt_in: false,
        tax_code: "",
        bed_count: 0,
        staff_count: 0,
        tech_equipment: "",
        decision_maker_dob: "",
        lifecycle_stage: "lead",
        personality_trait: "",
      });
    }
    setOpen(true);
  };

  const handlePreview = (c: Customer) => {
    setSelectedCustomer(c);
    setPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập họ và tên khách hàng");
      return;
    }
    
    setSaving(true);
    
    // Đóng gói Payload chứa trọn vẹn dải tham số Ownership theo đúng yêu cầu DB
    const payload: any = {
      name: form.name.trim(),
      facility_name: form.facility_name.trim(),
      phone: form.phone.trim(),
      normalized_phone: normalizePhone(form.phone),
      address: form.address.trim(),
      user_id: form.owner_sale_id || user?.id,
      customer_channel: form.customer_channel,
      customer_distance_type: form.customer_distance_type,
      care_model: form.care_model,
      owner_sale_id: (form.owner_sale_id && form.owner_sale_id !== "none") ? form.owner_sale_id : null,
      owner_tele_id: (form.owner_tele_id && form.owner_tele_id !== "none") ? form.owner_tele_id : null,
      // B2B Elite Fields Payload
      email: form.email,
      zalo: form.zalo,
      facebook: form.facebook,
      city: form.city,
      district: form.district,
      region: form.region,
      business_type: form.business_type,
      business_size: form.business_size,
      main_service: form.main_service,
      skin_concern_focus: form.skin_concern_focus,
      interested_products: form.interested_products,
      current_brands: form.current_brands,
      monthly_purchase_potential: form.monthly_purchase_potential,
      decision_maker: form.decision_maker,
      decision_role: form.decision_role,
      preferred_contact_channel: form.preferred_contact_channel,
      source: form.source,
      status: form.status,
      potential_level: form.potential_level,
      note: form.note,
      tags: form.tags,
      marketing_opt_in: form.marketing_opt_in,
      tax_code: form.tax_code,
      bed_count: form.bed_count,
      staff_count: form.staff_count,
      tech_equipment: form.tech_equipment,
      decision_maker_dob: form.decision_maker_dob || null,
      lifecycle_stage: form.lifecycle_stage,
      personality_trait: form.personality_trait,
      updated_by: user?.id,
    };

    if (!editingId) {
      payload.created_by = user?.id;
    }

    // Theo yêu cầu: Nếu customer_channel = direct_sales thì ưu tiên owner_sale_id
    if (payload.customer_channel === "direct_sales" && !payload.owner_sale_id) {
      payload.owner_sale_id = user?.id || null;
      payload.user_id = user?.id;
    }

    // Nếu đang chạy Local fallback đệm cache
    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      if (editingId) {
        const idx = data.findIndex((c: any) => c.id === editingId);
        if (idx >= 0) data[idx] = { ...data[idx], ...payload };
      } else {
        data.unshift({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload });
      }
      localStorage.setItem("mock_customers", JSON.stringify(data));
      setCustomers(data.filter((c: any) => isAdmin || !c.user_id || c.user_id === user?.id));
      setSaving(false);
      setOpen(false);
      toast.success(editingId ? "Đã cập nhật dữ liệu Ownership" : "Đã thêm mới Khách hàng");
      return;
    }

    // Ghi thực tế vào Database Supabase
    if (editingId) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editingId);
      if (error) toast.error("Lỗi cập nhật CSDL: " + error.message);
      else {
        toast.success("Đã lưu thành công dữ liệu Tuyến chăm sóc vào DB!");
        setOpen(false);
        loadData();
      }
    } else {
      const { error } = await supabase.from("customers").insert([payload]);
      if (error) toast.error("Lỗi ghi CSDL: " + error.message);
      else {
        toast.success("Đã ghi mới Khách hàng với Ownership chuẩn xác!");
        setOpen(false);
        loadData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const reason = prompt("Nhập lý do xóa khách hàng này (không bắt buộc):");
    if (reason === null) return; // User cancelled
    
    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      const idx = data.findIndex((c: any) => c.id === id);
      if (idx >= 0) {
        data[idx] = { 
          ...data[idx], 
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          delete_reason: reason || "Xóa bởi người dùng"
        };
      }
      localStorage.setItem("mock_customers", JSON.stringify(data));
      setCustomers(data.filter((c: any) => (isAdmin || !c.user_id || c.user_id === user?.id) && !c.deleted_at));
      toast.success("Đã xóa tạm thời (Soft Delete)");
      return;
    }

    const { error } = await supabase
      .from("customers")
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
        delete_reason: reason || "Xóa bởi người dùng"
      })
      .eq("id", id);

    if (error) toast.error("Lỗi xóa: " + error.message);
    else {
      toast.success("Đã chuyển vào thùng rác");
      loadData();
    }
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Không có dữ liệu khách hàng để xuất CSV");
      return;
    }

    const headers = [
      "id", 
      "name", 
      "facility_name", 
      "phone", 
      "address", 
      "customer_channel", 
      "customer_channel_label",
      "customer_distance_type", 
      "customer_distance_label",
      "care_model",
      "care_model_label",
      "owner_sale_id",
      "owner_sale_name",
      "owner_tele_id",
      "owner_tele_name",
      "created_at"
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filtered.map((c: any) => {
      const effectiveSaleId = c.owner_sale_id || c.assigned_sale_id || c.user_id;
      const foundSale = salesUsers.find(u => u.id === effectiveSaleId);
      const saleName = foundSale ? (foundSale as any).display_name || foundSale.full_name || foundSale.email || "" : "";
      
      const foundTele = teleUsers.find(u => u.id === c.owner_tele_id);
      const teleName = foundTele ? (foundTele as any).display_name || foundTele.full_name || foundTele.email || "" : "";

      return [
        escapeCsv(c.id),
        escapeCsv(c.name || ""),
        escapeCsv(c.facility_name || ""),
        escapeCsv(c.phone || ""),
        escapeCsv(c.address || ""),
        escapeCsv(c.customer_channel || "direct_sales"),
        escapeCsv(getCustomerChannelLabel(c.customer_channel)),
        escapeCsv(c.customer_distance_type || "unknown"),
        escapeCsv(getCustomerDistanceLabel(c.customer_distance_type)),
        escapeCsv(c.care_model || "sale_owned"),
        escapeCsv(getCareModelLabel(c.care_model)),
        escapeCsv(c.owner_sale_id || ""),
        escapeCsv(saleName),
        escapeCsv(c.owner_tele_id || ""),
        escapeCsv(teleName),
        escapeCsv(c.created_at || new Date().toISOString())
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customers_ownership_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Đã xuất thành công ${filtered.length} khách hàng ra CSV`);
  };

  // Helper ánh xạ tên nhân sự hiển thị trên bảng
  const getStaffName = (staffId?: string | null) => {
    if (!staffId) return "Chưa phân công";

    // Tìm trong cả danh sách Sale và Tele
    const staff = [...salesUsers, ...teleUsers].find((item) => item.id === staffId);

    return staff?.full_name || (staff as any)?.display_name || staff?.email || "Không rõ";
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 font-sans selection:bg-primary/10">
      <header className="border-b border-white/20 bg-slate-900/95 backdrop-blur-md shadow-lg sticky top-0 z-20">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-[11px] font-bold text-white/70 hover:text-white transition-all flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl border border-white/10">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Trang chủ</span>
            </Link>
            <div className="h-6 w-[1px] bg-white/10"></div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2 drop-shadow-sm">
                <span className="bg-primary/20 p-1.5 rounded-lg border border-primary/30">👥</span>
                Quản lý Khách hàng & Tuyến chăm sóc
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handleExportCsv} 
              size="sm"
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white/90 font-bold backdrop-blur-sm transition-all"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Xuất CSV
            </Button>
            <Button onClick={() => handleOpen()} size="sm" className="font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all px-4">
              <Plus className="w-4 h-4 mr-1.5" /> Thêm Khách hàng
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-6 space-y-5">
        {/* QUICK STATS CARDS (RICH AESTHETICS / PREMIUM UI) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Card 1: Tổng khách hàng */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-primary/20 transition-all flex items-center justify-between gap-2 group">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tổng khách</div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : customers.length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Đại lý chính thức */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all flex items-center justify-between gap-2 group">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đại lý</div>
              <div className="text-xl font-black text-emerald-600 mt-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : customers.filter(c => c.lifecycle_stage === "customer" || c.lifecycle_stage === "loyal").length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Tiềm năng */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between gap-2 group">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiềm năng</div>
              <div className="text-xl font-black text-blue-600 mt-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : customers.filter(c => c.lifecycle_stage === "lead" || c.lifecycle_stage === "prospect").length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Target className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Cần phân công */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-red-200 transition-all flex items-center justify-between gap-2 group">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-red-400">Cần gán</div>
              <div className="text-xl font-black text-red-600 mt-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : customers.filter(c => !c.owner_sale_id && !c.owner_tele_id).length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
              <UserMinus className="w-5 h-5" />
            </div>
          </div>

          {/* Card 5: Khu vực tỉnh */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-purple-200 transition-all flex items-center justify-between gap-2 group col-span-2 sm:col-span-1">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Khu vực Tỉnh</div>
              <div className="text-xl font-black text-purple-600 mt-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : customers.filter(c => c.city && c.city.toLowerCase() !== "hà nội" && c.city.toLowerCase() !== "tp.hcm").length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <Map className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Tìm kiếm theo Tên, Spa/Clinic, Số điện thoại..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200 text-xs h-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60">
                <span>Hiển thị <strong className="text-purple-700 font-bold">{filtered.length}</strong> / {customers.length} khách</span>
              </div>
              
              {/* CHUYỂN ĐỔI GÓC NHÌN TABLE / KANBAN (RICH AESTHETICS) */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                    viewMode === "table" 
                      ? "bg-white text-slate-900 shadow-2xs" 
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Chế độ xem Bảng dữ liệu"
                >
                  <Table className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bảng</span>
                </button>
                <button
                  onClick={() => setViewMode("kanban")}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                    viewMode === "kanban" 
                      ? "bg-white text-slate-900 shadow-2xs" 
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Bảng Kanban Chuyển giao Khách hàng"
                >
                  <Kanban className="w-3.5 h-3.5 text-purple-600" />
                  <span>Kanban</span>
                </button>
              </div>
            </div>
          </div>

          {/* KHỐI CÔNG CỤ BỘ LỌC CAO CẤP (RICH AESTHETICS FILTER TOOLBAR) */}
          <div className="p-3 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Bộ lọc:</span>
              
              {/* Filter 1: Tuyến chăm sóc */}
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-white border-slate-200 font-medium">
                  <SelectValue placeholder="Tuyến chăm sóc" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold text-purple-700">Tất cả Tuyến</SelectItem>
                  {CUSTOMER_CHANNEL_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs font-medium">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filter 2: Khoảng cách */}
              <Select value={distanceFilter} onValueChange={setDistanceFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-white border-slate-200 font-medium">
                  <SelectValue placeholder="Khoảng cách" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold text-purple-700">Tất cả Vùng</SelectItem>
                  {CUSTOMER_DISTANCE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs font-medium">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filter 3: Mô hình chăm sóc */}
              <Select value={careModelFilter} onValueChange={setCareModelFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs bg-white border-slate-200 font-medium truncate">
                  <SelectValue placeholder="Mô hình chăm sóc" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold text-purple-700">Tất cả Mô hình</SelectItem>
                  {CARE_MODEL_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs font-medium">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filter nhanh: Chỉ xem khách cần phân công */}
              <Button
                variant={onlyNeedsAssignment ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlyNeedsAssignment(!onlyNeedsAssignment)}
                className={`h-8 text-xs font-bold rounded-lg transition-all ${
                  onlyNeedsAssignment 
                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs border-amber-600" 
                    : "border-amber-200 text-amber-700 hover:bg-amber-50"
                }`}
              >
                {onlyNeedsAssignment ? "⚠️ Chỉ xem khách cần phân công" : "⚠️ Cần phân công"}
              </Button>

              {/* Thùng rác (Chỉ Admin/Sub Admin) */}
              {(isAdmin || isSubAdmin) && (
                <Button
                  variant={showDeleted ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setShowDeleted(!showDeleted)}
                  className={`h-8 text-xs font-bold rounded-lg transition-all ${
                    showDeleted 
                      ? "bg-red-600 hover:bg-red-700 text-white shadow-2xs border-red-600" 
                      : "border-red-200 text-red-700 hover:bg-red-50"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {showDeleted ? "Đang xem Thùng rác" : "Xem khách đã xóa"}
                </Button>
              )}
            </div>

            {/* Nút Xoá bộ lọc */}
            {(channelFilter !== "all" || distanceFilter !== "all" || careModelFilter !== "all" || onlyNeedsAssignment) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setChannelFilter("all");
                  setDistanceFilter("all");
                  setCareModelFilter("all");
                  setOnlyNeedsAssignment(false);
                }}
                className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 font-bold px-2.5 rounded-lg border border-red-100"
              >
                Xoá bộ lọc
              </Button>
            )}
          </div>

          {viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3.5 pl-4 w-64">Thông tin & Cơ sở</th>
                    <th className="p-3.5 w-44">Phân loại & Tiềm năng</th>
                    <th className="p-3.5 w-32">Khu vực / Quy mô</th>
                    <th className="p-3.5 min-w-[280px]">Tuyến chăm sóc (Ownership Core)</th>
                    <th className="p-3.5 pr-4 text-right w-20">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Đang đồng bộ cơ sở dữ liệu khách hàng...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Không tìm thấy bản ghi khách hàng phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => {
                      // Chuẩn hóa hiển thị: Ưu tiên owner_sale_id, nếu chưa có thì fallback assigned_sale_id hoặc user_id cũ
                      const effectiveSaleId = c.owner_sale_id || (c as any).assigned_sale_id || c.user_id;
                      const saleName = getStaffName(effectiveSaleId);
                      const teleName = getStaffName(c.owner_tele_id);
                      
                      // Logic nhận diện rủi ro thiếu sót phân công (Needs Assignment)
                      const isAssignmentNeeded = 
                        (c.care_model === "sale_owned" && !c.owner_sale_id) ||
                        (c.care_model === "tele_owned" && !c.owner_tele_id) ||
                        !c.customer_channel;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 pl-4 cursor-pointer group" onClick={() => handlePreview(c)}>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 border border-slate-200 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                                <Building2 className="w-4 h-4 group-hover:text-primary transition-colors" />
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm leading-tight group-hover:text-primary transition-colors">{c.facility_name || "Spa tự do"}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <UserCircle className="w-3 h-3" /> {c.name || "Chưa tên"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 cursor-pointer" onClick={() => handlePreview(c)}>
                            <div className="flex flex-col gap-1.5">
                              {getLifecycleBadge(c.lifecycle_stage)}
                              {getPotentialBadge(c.potential_level)}
                            </div>
                          </td>
                          <td className="p-3.5 cursor-pointer" onClick={() => handlePreview(c)}>
                            <div className="flex flex-col gap-0.5">
                              <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-red-500" /> {c.city || "Chưa rõ"}
                              </div>
                              <div className="text-[10px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded w-fit">
                                {c.bed_count || 0} giường
                              </div>
                              <div className="text-[11px] font-mono text-slate-600 mt-1">{c.phone || "—"}</div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            {/* KHỐI HIỂN THỊ TUYẾN CHĂM SÓC TUYỆT ĐẸP MẮT */}
                            <div className="flex flex-col gap-1.5">
                              {/* Dòng 1: Badge Kênh & Khoảng cách */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100/50">
                                  {getCustomerChannelLabel(c.customer_channel)}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                                  {getCustomerDistanceLabel(c.customer_distance_type)}
                                </span>
                                {isAssignmentNeeded && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200 animate-pulse shadow-2xs">
                                    ⚠️ Cần phân công
                                  </span>
                                )}
                              </div>

                              {/* Dòng 2: Phụ trách chính & Mô hình */}
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-0.5">
                                <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                                  {getCareModelLabel(c.care_model)}
                                </span>
                                
                                {/* Người phụ trách Sale */}
                                {saleName ? (
                                  <span className="inline-flex items-center gap-1 text-slate-700 font-medium" title="Sale Thị trường phụ trách">
                                    <UserCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Sale: <strong>{saleName}</strong></span>
                                  </span>
                                ) : c.owner_sale_id ? (
                                  <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                    <UserCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Sale: <strong>Đã gán</strong></span>
                                  </span>
                                ) : null}

                                {/* Người phụ trách Tele */}
                                {teleName ? (
                                  <span className="inline-flex items-center gap-1 text-slate-700 font-medium" title="Trưởng Tele phụ trách">
                                    <Headset className="w-3 h-3 text-amber-600" />
                                    <span>Tele: <strong>{teleName}</strong></span>
                                  </span>
                                ) : c.owner_tele_id ? (
                                  <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                    <Headset className="w-3 h-3 text-amber-600" />
                                    <span>Tele: <strong>Đã gán</strong></span>
                                  </span>
                                ) : null}

                                {/* Nhãn trống nếu hoàn toàn tự do */}
                                {!c.owner_sale_id && !c.owner_tele_id && (
                                  <span className="inline-flex items-center gap-1 text-slate-400 italic bg-slate-100/80 px-1.5 py-0.5 rounded">
                                    Chưa phân công
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 pr-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpen(c)}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                                title="Chỉnh sửa Tuyến chăm sóc"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(c.id)}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                title="Xóa khách hàng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* KANBAN BOARD CHUYỂN GIAO & QUẢN TRỊ KHÁCH HÀNG (RICH AESTHETICS / PREMIUM UI) */
            <div className="p-4 bg-slate-50/50 overflow-x-auto">
              <div className="flex gap-4 min-w-[1200px] items-start">
                {/* Cột 1: Sale trực tiếp */}
                <div className="w-80 shrink-0 bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden flex flex-col max-h-[700px]">
                  <div className="p-3 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Sale trực tiếp</span>
                    </div>
                    <span className="text-[11px] font-extrabold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      {filtered.filter(c => c.customer_channel === "direct_sales" || !c.customer_channel).length}
                    </span>
                  </div>
                  <div className="p-2.5 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/30">
                    {filtered.filter(c => c.customer_channel === "direct_sales" || !c.customer_channel).map(c => {
                      const effectiveSaleId = c.owner_sale_id || (c as any).assigned_sale_id || c.user_id;
                      const sName = getStaffName(effectiveSaleId);
                      return (
                        <div key={c.id} className="p-3 bg-white border border-slate-100 hover:border-emerald-200 rounded-lg shadow-2xs hover:shadow-xs transition-all text-xs group relative overflow-hidden cursor-pointer" onClick={() => handlePreview(c)}>
                          <div className="absolute top-0 right-0 p-1">
                            {getPotentialBadge(c.potential_level)}
                          </div>
                          <div className="flex items-start justify-between gap-1">
                            <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1 pr-8">{c.facility_name || "Spa tự do"}</div>
                            <button onClick={(e) => { e.stopPropagation(); handleOpen(c); }} className="text-slate-300 hover:text-slate-900 shrink-0" title="Chỉnh sửa">✏️</button>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                            <UserCircle className="w-3 h-3" /> {c.name}
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            {getLifecycleBadge(c.lifecycle_stage)}
                            <span className="text-[9px] text-slate-400 bg-slate-50 px-1 py-0.5 rounded border border-slate-100">{c.city || "N/A"}</span>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="flex items-center gap-1 text-slate-600 font-medium truncate max-w-[140px]">
                              <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{sName || "Sale mặc định"}</span>
                            </span>
                            <span className="text-slate-400 font-mono">{c.phone || "—"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cột 2: Tele / Online */}
                <div className="w-80 shrink-0 bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden flex flex-col max-h-[700px]">
                  <div className="p-3 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-600"></div>
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Tele / Online</span>
                    </div>
                    <span className="text-[11px] font-extrabold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {filtered.filter(c => c.customer_channel === "tele_sales").length}
                    </span>
                  </div>
                  <div className="p-2.5 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/30">
                    {filtered.filter(c => c.customer_channel === "tele_sales").map(c => {
                      const tName = getStaffName(c.owner_tele_id);
                      return (
                        <div key={c.id} className="p-3 bg-white border border-slate-100 hover:border-amber-200 rounded-lg shadow-2xs hover:shadow-xs transition-all text-xs group cursor-pointer" onClick={() => handlePreview(c)}>
                          <div className="flex items-start justify-between gap-1">
                            <div className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-1">{c.name}</div>
                            <button onClick={(e) => { e.stopPropagation(); handleOpen(c); }} className="text-slate-400 hover:text-slate-900 shrink-0" title="Chỉnh sửa Phân tuyến">✏️</button>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">{c.facility_name || "Spa tự do"}</div>
                          <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="flex items-center gap-1 text-slate-600 font-medium truncate max-w-[140px]">
                              <Headset className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate">{tName || "Tele: Đã gán"}</span>
                            </span>
                            <span className="text-purple-700 font-semibold">{getCareModelLabel(c.care_model)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cột 3: Mô hình Lai (Hybrid / Hỗ trợ) */}
                <div className="w-80 shrink-0 bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden flex flex-col max-h-[700px]">
                  <div className="p-3 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Sale + Tele phối hợp</span>
                    </div>
                    <span className="text-[11px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {filtered.filter(c => c.customer_channel === "hybrid").length}
                    </span>
                  </div>
                  <div className="p-2.5 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/30">
                    {filtered.filter(c => c.customer_channel === "hybrid").map(c => {
                      const effectiveSaleId = c.owner_sale_id || (c as any).assigned_sale_id || c.user_id;
                      const sName = getStaffName(effectiveSaleId);
                      const tName = getStaffName(c.owner_tele_id);
                      return (
                        <div key={c.id} className="p-3 bg-white border border-slate-100 hover:border-blue-200 rounded-lg shadow-2xs hover:shadow-xs transition-all text-xs group">
                          <div className="flex items-start justify-between gap-1">
                            <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">{c.name}</div>
                            <button onClick={() => handleOpen(c)} className="text-slate-400 hover:text-slate-900 shrink-0" title="Chỉnh sửa Phân tuyến">✏️</button>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">{c.facility_name || "Spa tự do"}</div>
                          <div className="mt-2 pt-1.5 border-t border-slate-50 flex flex-col gap-1 text-[10px] text-slate-500">
                            <div className="flex items-center justify-between">
                              <span>S: <strong>{sName ? sName.slice(0,12) : "Sale"}</strong></span>
                              <span>T: <strong>{tName ? tName.slice(0,12) : "Tele"}</strong></span>
                            </div>
                            <div className="text-[9px] text-slate-400 bg-slate-50 px-1 py-0.5 rounded text-center truncate">
                              {getCareModelLabel(c.care_model)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cột 4: Rủi ro / Cần phân công */}
                <div className="w-80 shrink-0 bg-white border border-red-200/80 rounded-xl shadow-2xs overflow-hidden flex flex-col max-h-[700px]">
                  <div className="p-3 bg-red-50/80 border-b border-red-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                      <span className="text-xs font-bold text-red-800 uppercase tracking-wider">⚠️ Cần phân công</span>
                    </div>
                    <span className="text-[11px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      {filtered.filter(c => 
                        (c.care_model === "sale_owned" && !c.owner_sale_id) ||
                        (c.care_model === "tele_owned" && !c.owner_tele_id) ||
                        !c.customer_channel
                      ).length}
                    </span>
                  </div>
                  <div className="p-2.5 overflow-y-auto space-y-2.5 flex-1 bg-red-50/10">
                    {filtered.filter(c => 
                      (c.care_model === "sale_owned" && !c.owner_sale_id) ||
                      (c.care_model === "tele_owned" && !c.owner_tele_id) ||
                      !c.customer_channel
                    ).map(c => (
                      <div key={c.id} className="p-3 bg-white border border-red-200/80 hover:border-red-300 rounded-lg shadow-2xs hover:shadow-xs transition-all text-xs group">
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-bold text-slate-900 group-hover:text-red-700 transition-colors line-clamp-1">{c.name}</div>
                          <button onClick={() => handleOpen(c)} className="text-slate-400 hover:text-slate-900 shrink-0" title="Chỉnh sửa Phân tuyến">✏️</button>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">{c.facility_name || "Spa tự do"}</div>
                        <div className="mt-2 pt-1.5 border-t border-red-50 flex items-center justify-between text-[10px]">
                          <span className="bg-red-50 text-red-700 font-bold px-1.5 py-0.5 rounded border border-red-100/80">
                            Cần gán Owner
                          </span>
                          <span className="text-slate-400 font-mono">{c.phone || "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* DIALOG FORM BỔ SUNG SECTION "TUYẾN CHĂM SÓC" - OPTIMIZED UX/UI */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-[28px] bg-white/95 backdrop-blur-xl">
          {/* Header với Gradient mượt mà */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-8 py-6 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[120%] bg-primary rotate-12 blur-3xl"></div>
            </div>
            
            <div className="relative z-10">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-sm shadow-inner">
                    {editingId ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex flex-col">
                    <span>{editingId ? "Cập nhật Khách hàng" : "Thêm Khách hàng"}</span>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5">Hồ sơ & Phân tuyến Ownership</span>
                  </div>
                </DialogTitle>
              </DialogHeader>
            </div>
            
            <button 
              onClick={() => setOpen(false)} 
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/10 relative z-10"
            >
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>

          <div className="px-8 py-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-slate-50/30">
            <Tabs defaultValue="profile" className="w-full">
              {/* Tabs thiết kế dạng Segmented Control cao cấp */}
              <TabsList className="flex w-full mb-8 bg-slate-200/50 p-1.5 rounded-[18px] border border-slate-200/30">
                <TabsTrigger value="profile" className="flex-1 text-[11px] font-black rounded-[12px] py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50 transition-all uppercase tracking-wider">Hồ sơ</TabsTrigger>
                <TabsTrigger value="business" className="flex-1 text-[11px] font-black rounded-[12px] py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50 transition-all uppercase tracking-wider">Kinh doanh</TabsTrigger>
                <TabsTrigger value="dm" className="flex-1 text-[11px] font-black rounded-[12px] py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50 transition-all uppercase tracking-wider">Quyết định</TabsTrigger>
                <TabsTrigger value="care" className="flex-1 text-[11px] font-black rounded-[12px] py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:shadow-slate-200/50 transition-all uppercase tracking-wider">Chăm sóc</TabsTrigger>
              </TabsList>

              {/* TAB 1: HỒ SƠ CƠ SỞ & LIÊN HỆ */}
              <TabsContent value="profile" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Building2 className="w-3.5 h-3.5 text-primary/70" /> Tên cơ sở (Spa/Clinic) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.facility_name}
                      onChange={(e) => setForm({ ...form, facility_name: e.target.value })}
                      placeholder="VD: Desembre Premium Clinic"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <UserCircle className="w-3.5 h-3.5 text-primary/70" /> Người liên hệ
                    </Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="VD: Chị Lan Anh"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Phone className="w-3.5 h-3.5 text-primary/70" /> Số điện thoại
                    </Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="0912345678"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm font-mono focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <MapPin className="w-3.5 h-3.5 text-primary/70" /> Địa chỉ chi tiết
                    </Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Số nhà, tên đường, phường/xã..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Map className="w-3.5 h-3.5 text-primary/70" /> Tỉnh / Thành phố
                    </Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Hà Nội, TP.HCM..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Shield className="w-3.5 h-3.5 text-primary/70" /> Mã số thuế (B2B)
                    </Label>
                    <Input
                      value={form.tax_code}
                      onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
                      placeholder="MST doanh nghiệp"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm font-mono focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: NHU CẦU & CHUYÊN MÔN */}
              <TabsContent value="business" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Quy mô (Số giường)</Label>
                    <Input
                      type="number"
                      value={form.bed_count}
                      onChange={(e) => setForm({ ...form, bed_count: parseInt(e.target.value) || 0 })}
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Số lượng nhân sự</Label>
                    <Input
                      type="number"
                      value={form.staff_count}
                      onChange={(e) => setForm({ ...form, staff_count: parseInt(e.target.value) || 0 })}
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Chuyên môn tập trung
                    </Label>
                    <Input
                      value={form.main_service}
                      onChange={(e) => setForm({ ...form, main_service: e.target.value })}
                      placeholder="VD: Nám, mụn, trẻ hóa..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Thiết bị công nghệ</Label>
                    <Input
                      value={form.tech_equipment}
                      onChange={(e) => setForm({ ...form, tech_equipment: e.target.value })}
                      placeholder="VD: Laser, HIFU, Phi kim..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Nhãn hàng đang sử dụng</Label>
                    <Input
                      value={form.current_brands}
                      onChange={(e) => setForm({ ...form, current_brands: e.target.value })}
                      placeholder="Các thương hiệu mỹ phẩm hiện có..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: NGƯỜI QUYẾT ĐỊNH */}
              <TabsContent value="dm" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Tên người quyết định</Label>
                    <Input
                      value={form.decision_maker}
                      onChange={(e) => setForm({ ...form, decision_maker: e.target.value })}
                      placeholder="Họ tên Chủ Spa"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Vai trò</Label>
                    <Select value={form.decision_role} onValueChange={(v) => setForm({ ...form, decision_role: v })}>
                      <SelectTrigger className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                        <SelectItem value="OWNER" className="text-sm font-medium">Chủ sở hữu</SelectItem>
                        <SelectItem value="MANAGER" className="text-sm font-medium">Quản lý điều hành</SelectItem>
                        <SelectItem value="DOCTOR" className="text-sm font-medium">Bác sĩ chuyên trách</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-red-400" /> Ngày sinh
                    </Label>
                    <Input
                      type="date"
                      value={form.decision_maker_dob}
                      onChange={(e) => setForm({ ...form, decision_maker_dob: e.target.value })}
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Đặc điểm tính cách</Label>
                    <Input
                      value={form.personality_trait}
                      onChange={(e) => setForm({ ...form, personality_trait: e.target.value })}
                      placeholder="VD: Chú trọng chuyên môn..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Mail className="w-3.5 h-3.5 text-blue-400" /> Email liên hệ
                    </Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="example@gmail.com"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Ghi chú tiếp cận</Label>
                    <textarea
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      className="w-full min-h-[100px] p-4 text-sm border border-slate-200/60 rounded-2xl bg-white shadow-sm focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-300"
                      placeholder="Những điều cần lưu ý khi làm việc với khách hàng..."
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: CHĂM SÓC & PHÂN TUYẾN */}
              <TabsContent value="care" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                        <Target className="w-3.5 h-3.5 text-purple-600" /> Giai đoạn
                      </Label>
                      <Select value={form.lifecycle_stage} onValueChange={(v) => setForm({ ...form, lifecycle_stage: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-slate-50/50 border-slate-200/60 font-semibold text-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          <SelectItem value="lead" className="text-sm font-medium">Lead (Tiềm năng)</SelectItem>
                          <SelectItem value="prospect" className="text-sm font-medium">Prospect (Cơ hội)</SelectItem>
                          <SelectItem value="customer" className="text-sm font-medium">Customer (Đại lý)</SelectItem>
                          <SelectItem value="loyal" className="text-sm font-medium">Loyal (Thân thiết)</SelectItem>
                          <SelectItem value="churned" className="text-sm font-medium">Churned (Ngừng chăm)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Độ ưu tiên
                      </Label>
                      <Select value={form.potential_level} onValueChange={(v) => setForm({ ...form, potential_level: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-slate-50/50 border-slate-200/60 font-black">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          <SelectItem value="cold" className="text-sm font-bold text-slate-400">LẠNH</SelectItem>
                          <SelectItem value="warm" className="text-sm font-bold text-amber-500">ẤM</SelectItem>
                          <SelectItem value="hot" className="text-sm font-bold text-red-500">NÓNG 🔥</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Kênh tiếp cận</Label>
                      <Select value={form.customer_channel} onValueChange={(v: any) => setForm({ ...form, customer_channel: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          {CUSTOMER_CHANNEL_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-sm font-medium">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Khoảng cách</Label>
                      <Select value={form.customer_distance_type} onValueChange={(v: any) => setForm({ ...form, customer_distance_type: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          {CUSTOMER_DISTANCE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-sm font-medium">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Mô hình chăm sóc</Label>
                      <Select value={form.care_model} onValueChange={(v: any) => setForm({ ...form, care_model: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-bold text-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          {CARE_MODEL_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-sm font-bold">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Sale phụ trách
                      </Label>
                      <Select value={form.owner_sale_id} onValueChange={(v) => setForm({ ...form, owner_sale_id: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-medium">
                          <SelectValue placeholder="Chọn nhân sự Sale" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          <SelectItem value="none" className="text-sm italic text-slate-400">— Chưa phân công —</SelectItem>
                          {salesUsers.map(u => (
                            <SelectItem key={u.id} value={u.id} className="text-sm font-medium">👤 {u.full_name || u.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                        <Headset className="w-3.5 h-3.5 text-amber-600" /> Tele phụ trách
                      </Label>
                      <Select value={form.owner_tele_id} onValueChange={(v) => setForm({ ...form, owner_tele_id: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-medium">
                          <SelectValue placeholder="Chọn nhân sự Tele" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          <SelectItem value="none" className="text-sm italic text-slate-400">— Chưa phân công —</SelectItem>
                          {teleUsers.map(u => (
                            <SelectItem key={u.id} value={u.id} className="text-sm font-medium">🎧 {u.full_name || u.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 pt-2 px-1">
                      <div className="flex items-center space-x-3 bg-slate-100/50 p-4 rounded-[18px] border border-slate-200/40">
                        <input
                          type="checkbox"
                          id="marketing_opt_in"
                          checked={form.marketing_opt_in}
                          onChange={(e) => setForm({ ...form, marketing_opt_in: e.target.checked })}
                          className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary transition-all cursor-pointer"
                        />
                        <Label htmlFor="marketing_opt_in" className="text-[11px] font-black text-slate-700 cursor-pointer uppercase tracking-wider">
                          Đồng ý nhận tin nhắn Marketing / Khuyến mãi
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving} className="text-xs h-9 rounded-lg font-bold">
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving} className="text-xs h-9 rounded-lg font-bold bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {editingId ? "Lưu Tuyến chăm sóc" : "Hoàn tất Thêm mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerPreviewDrawer 
        customer={selectedCustomer}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        getStaffName={getStaffName}
      />
    </div>
  );
}
