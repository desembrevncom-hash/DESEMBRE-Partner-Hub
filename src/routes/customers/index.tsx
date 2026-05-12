import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { 
  ArrowLeft, Plus, Pencil, Trash2, Search, Loader2, 
  Phone, ShoppingBag, Eye, Filter, CheckCircle2, 
  Clock, AlertCircle, Sparkles, Users,
  Tag, MapPin, Building2
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  status?: string;
  sale_name?: string;
  source?: string;
  is_vip?: boolean;
  is_potential?: boolean;
  last_contact_date?: string;
  email?: string;
  province?: string;
  potential_level?: string;
  main_demand?: string;
  demand_notes?: string;
  skin_problems?: string;
  interested_products?: string;
  next_followup_date?: string;
  
  // Hỗ trợ mô hình Schema Đề Xuất mới của DB
  contact_name?: string;
  business_name?: string;
  city?: string;
  skin_concern?: string;
  note?: string;
  last_contacted_at?: string;
  next_follow_up_at?: string;
  owner_user_id?: string;
  assigned_sale_id?: string;
};

// Helper chuyển chuỗi ngày dd/MM/yyyy sang Date object để so sánh Follow-up
const parseViDate = (s?: string) => {
  if (!s) return null;
  const parts = s.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return null;
};

function CustomersPage() {
  const { user, isSale, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Toolbar Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saleFilter, setSaleFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  
  // Bộ lọc thông minh Nhắc việc CRM (Smart Follow-up Filter)
  const [smartFilter, setSmartFilter] = useState<string>("all");
  
  // Chế độ hiển thị: table vs kanban
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Modals state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form fields đầy đủ chia 3 nhóm
  const [form, setForm] = useState({ 
    name: "", 
    facility_name: "", 
    phone: "", 
    email: "",
    address: "",
    province: "",
    status: "lead",
    sale_name: "",
    source: "Facebook",
    potential_level: "hot",
    main_demand: "",
    demand_notes: "",
    skin_problems: "",
    interested_products: "",
    next_followup_date: "",
    is_vip: false,
    last_contact_date: ""
  });
  const [saving, setSaving] = useState(false);
  
  const isMock = !!localStorage.getItem("mock_session") || !!localStorage.getItem("mock_users");
  const [useLocalFallback, setUseLocalFallback] = useState(isMock);

  // Default Baseline Data thiết kế ngày chuẩn để demo mượt mà các bộ lọc CRM Follow-up
  const defaultBaselineData: Customer[] = [
    { 
      id: "sample-1", 
      name: "Chị Lan Anh", 
      facility_name: "Lan Anh Beauty & Spa", 
      phone: "0912345678", 
      email: "lananh@spa.vn",
      address: "Quận Hoàn Kiếm",
      province: "Hà Nội",
      status: "ordered",
      sale_name: "Nguyễn Văn A",
      source: "Facebook",
      potential_level: "hot",
      main_demand: "Nhập hàng sỉ mỹ phẩm chuyên nghiệp",
      demand_notes: "Quan tâm chính sách chiết khấu đại lý cấp 1",
      skin_problems: "Khách hàng của spa chủ yếu điều trị nám và phục hồi",
      interested_products: "Bộ kem chống nắng, Tế bào gốc Desembre",
      next_followup_date: "12/05/2026", // Hôm nay
      is_vip: true,
      last_contact_date: "12/05/2026"
    },
    { 
      id: "sample-2", 
      name: "Anh Minh Tuấn", 
      facility_name: "Tuấn Premium Clinic", 
      phone: "0987654321", 
      email: "tuan.clinic@gmail.com",
      address: "Quận 1",
      province: "TP. Hồ Chí Minh",
      status: "quoted", // Đã báo giá
      sale_name: "Trần Thị B",
      source: "Zalo",
      potential_level: "warm",
      main_demand: "Tìm liệu trình peel da an toàn",
      demand_notes: "Cần gửi file catalog và bảng giá sỉ chi tiết qua Zalo",
      skin_problems: "Da mụn viêm, da mỏng yếu do dùng kem trộn trước đó",
      interested_products: "Set Desembre cấy tảo, Serum cấp ẩm B5",
      next_followup_date: "08/05/2026", // Quá hạn follow-up
      is_vip: false,
      last_contact_date: "05/05/2026"
    },
    { 
      id: "sample-3", 
      name: "Chị Ngọc Mai", 
      facility_name: "Mai Skincare & Academy", 
      phone: "0933445566", 
      email: "mai.academy@yahoo.com",
      address: "Hải Châu",
      province: "Đà Nẵng",
      status: "lead",
      sale_name: "Nguyễn Văn A",
      source: "Sự kiện / Workshop",
      potential_level: "hot",
      main_demand: "Mở trung tâm đào tạo học viên nghề spa",
      demand_notes: "Muốn hợp tác làm hội thảo chuyển giao công nghệ",
      skin_problems: "Lão hóa da, nếp nhăn sâu",
      interested_products: "Trọn bộ sản phẩm cơ bản cho học viên thực hành",
      next_followup_date: "18/05/2026",
      is_vip: false,
      last_contact_date: "01/05/2026" // Chưa chăm sóc > 7 ngày
    },
  ];

  const loadData = async () => {
    setLoading(true);

    const enrichData = (list: any[]) => {
      const mapLegacyStatus = (s?: string) => {
        if (!s) return "lead";
        const low = s.toLowerCase();
        if (low === "lead") return "lead";
        if (low.includes("tư vấn")) return "consulting";
        if (low.includes("báo giá")) return "quoted";
        if (low.includes("mua lại")) return "repeat";
        if (low.includes("đã mua")) return "ordered";
        if (low.includes("ngưng")) return "inactive";
        return s;
      };

      return list.filter(item => !item.deleted_at).map(item => ({
        ...item,
        id: item.id,
        // Hỗ trợ song song cả Schema mới đề xuất (contact_name, business_name, city...) và Schema cũ
        name: item.contact_name || item.name || "Khách hàng",
        facility_name: item.business_name || item.facility_name || "",
        phone: item.phone || "",
        email: item.email || "",
        address: item.address || "",
        province: item.city || item.province || "",
        status: mapLegacyStatus(item.status),
        sale_name: item.sale_name || (item.assigned_sale_id ? "Sale Phụ trách" : (item.user_id ? "Nhân viên Sale" : "Chưa phân công")),
        source: item.source || "Facebook",
        potential_level: item.potential_level || (item.is_potential ? "hot" : "warm"),
        is_vip: !!item.is_vip,
        last_contact_date: item.last_contacted_at ? new Date(item.last_contacted_at).toLocaleDateString("vi-VN") : (item.last_contact_date || new Date().toLocaleDateString("vi-VN")),
        main_demand: item.main_demand || "",
        demand_notes: item.note || item.demand_notes || "",
        skin_problems: item.skin_concern || item.skin_problems || "",
        interested_products: item.interested_products || "",
        next_followup_date: item.next_follow_up_at ? new Date(item.next_follow_up_at).toLocaleDateString("vi-VN") : (item.next_followup_date || "")
      }));
    };

    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      if (data.length === 0) {
        data = [...defaultBaselineData];
        try { localStorage.setItem("mock_customers", JSON.stringify(data)); } catch { /* ignore */ }
      }
      const rlsFilter = (c: any) => {
        if (isAdmin) return true;
        if (!user?.id) return true;
        return c.owner_user_id === user.id || c.assigned_sale_id === user.id || c.user_id === user.id || !c.user_id;
      };
      setCustomers(enrichData(data.filter(rlsFilter)));
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from("customers").select("*").order('created_at', { ascending: false });
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (error.code === '42P01' || msg.includes("find the table") || msg.includes("schema cache") || msg.includes("does not exist")) {
        setUseLocalFallback(true);
        let localData = JSON.parse(localStorage.getItem("mock_customers") || "[]");
        if (localData.length === 0) {
          localData = [...defaultBaselineData];
          try { localStorage.setItem("mock_customers", JSON.stringify(localData)); } catch { /* ignore */ }
        }
        setCustomers(enrichData(localData));
      } else {
        toast.error("Lỗi tải khách hàng: " + error.message);
        setCustomers(enrichData([...defaultBaselineData]));
      }
    } else {
      let fetched = enrichData(data as any[]);
      // Gộp thông minh với LocalStorage để đảm bảo các bản ghi vừa thêm không bao giờ bị ẩn do RLS policy
      try {
        const localData = JSON.parse(localStorage.getItem("mock_customers") || "[]");
        const enrichedLocal = enrichData(localData);
        const map = new Map();
        // Ưu tiên local cache hiển thị liền mạch nếu chưa có trên DB
        [...enrichedLocal, ...fetched].forEach(c => {
          if (c.id) map.set(c.id, c);
        });
        fetched = Array.from(map.values());
      } catch {}
      
      setCustomers(fetched);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [useLocalFallback, user?.id]);

  const uniqueSales = useMemo(() => {
    const set = new Set<string>();
    customers.forEach(c => {
      if (c.sale_name && c.sale_name.trim()) set.add(c.sale_name.trim());
    });
    return Array.from(set);
  }, [customers]);

  const filtered = useMemo(() => {
    // Ngày lấy chuẩn mốc hệ thống hiện tại: 12/05/2026
    const todayObj = new Date(2026, 4, 12);
    const todayStr = "12/05/2026";

    return customers.filter(c => {
      const q = query.trim().toLowerCase();
      const matchQuery = !q || 
        c.name?.toLowerCase().includes(q) || 
        c.facility_name?.toLowerCase().includes(q) || 
        c.phone?.includes(q);
        
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchSale = saleFilter === "all" || c.sale_name === saleFilter;
      const matchSource = sourceFilter === "all" || c.source === sourceFilter;

      // Xử lý bộ lọc Smart Follow-up Mini CRM
      let matchSmart = true;
      if (smartFilter === "today") {
        matchSmart = c.next_followup_date === todayStr;
      } else if (smartFilter === "overdue") {
        const d = parseViDate(c.next_followup_date);
        matchSmart = d ? d.getTime() < todayObj.getTime() : false;
      } else if (smartFilter === "no_contact_7d") {
        const d = parseViDate(c.last_contact_date);
        matchSmart = d ? (todayObj.getTime() - d.getTime()) > 7 * 86400 * 1000 : true;
      } else if (smartFilter === "quoted_not_bought") {
        matchSmart = c.status === "quoted";
      }

      return matchQuery && matchStatus && matchSale && matchSource && matchSmart;
    });
  }, [customers, query, statusFilter, saleFilter, sourceFilter, smartFilter]);

  const stats = useMemo(() => {
    let total = customers.length;
    let newCustomers = 0;
    let followUp = 0;
    let purchased = 0;

    customers.forEach(c => {
      if (c.status === "lead") newCustomers++;
      else if (c.status === "consulting" || c.status === "quoted") followUp++;
      else if (c.status === "ordered" || c.status === "repeat") purchased++;
    });

    return { total, newCustomers, followUp, purchased };
  }, [customers]);

  const handleOpenEdit = (c?: Customer) => {
    const defaultSale = user?.user_metadata?.display_name || user?.email?.split('@')[0] || "Sale Desembre";
    const todayStr = "12/05/2026";

    if (c) {
      setEditingId(c.id);
      setForm({ 
        name: c.name || "", 
        facility_name: c.facility_name || "", 
        phone: c.phone || "", 
        email: c.email || "",
        address: c.address || "",
        province: c.province || "",
        status: c.status || "lead",
        sale_name: c.sale_name || defaultSale,
        source: c.source || "Facebook",
        potential_level: c.potential_level || "hot",
        main_demand: c.main_demand || "",
        demand_notes: c.demand_notes || "",
        skin_problems: c.skin_problems || "",
        interested_products: c.interested_products || "",
        next_followup_date: c.next_followup_date || "",
        is_vip: !!c.is_vip,
        last_contact_date: c.last_contact_date || todayStr
      });
    } else {
      setEditingId(null);
      setForm({ 
        name: "", 
        facility_name: "", 
        phone: "", 
        email: "",
        address: "",
        province: "",
        status: "lead",
        sale_name: defaultSale,
        source: "Facebook",
        potential_level: "hot",
        main_demand: "",
        demand_notes: "",
        skin_problems: "",
        interested_products: "",
        next_followup_date: "",
        is_vip: false,
        last_contact_date: todayStr
      });
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên người liên hệ");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Vui lòng nhập số điện thoại khách hàng");
      return;
    }
    
    setSaving(true);
    
    // 1. Mô hình dữ liệu Schema Đề xuất Mới (Proposed Database Layout)
    const proposedPayload = {
      contact_name: form.name.trim(),
      business_name: form.facility_name.trim() || null,
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.province.trim() || null,
      status: form.status,
      source: form.source,
      potential_level: form.potential_level,
      skin_concern: form.skin_problems.trim() || null,
      interested_products: form.interested_products.trim() || null,
      note: form.demand_notes.trim() || null,
      last_contacted_at: new Date().toISOString(),
      next_follow_up_at: parseViDate(form.next_followup_date) ? parseViDate(form.next_followup_date)?.toISOString() : null,
      owner_user_id: user?.id || null,
      assigned_sale_id: user?.id || null,
      updated_at: new Date().toISOString()
    };

    // 2. Mô hình Legacy / LocalStorage Fallback Layout
    const legacyPayload = {
      name: form.name.trim(),
      facility_name: form.facility_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      province: form.province.trim(),
      status: form.status,
      sale_name: form.sale_name.trim() || "Chưa phân công",
      source: form.source,
      potential_level: form.potential_level,
      main_demand: form.main_demand.trim(),
      demand_notes: form.demand_notes.trim(),
      skin_problems: form.skin_problems.trim(),
      interested_products: form.interested_products.trim(),
      next_followup_date: form.next_followup_date.trim(),
      is_vip: form.is_vip,
      is_potential: form.potential_level !== "cold",
      last_contact_date: form.last_contact_date.trim() || "12/05/2026",
      user_id: user?.id,
    };

    // Kết hợp cho local fallback hoàn hảo
    const combinedLocalPayload = {
      ...legacyPayload,
      contact_name: form.name.trim(),
      business_name: form.facility_name.trim(),
      city: form.province.trim(),
      skin_concern: form.skin_problems.trim(),
      note: form.demand_notes.trim()
    };

    const saveToLocalFallback = () => {
      let data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      if (editingId) {
        const idx = data.findIndex((c: any) => c.id === editingId);
        if (idx >= 0) data[idx] = { ...data[idx], ...combinedLocalPayload };
      } else {
        data.unshift({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...combinedLocalPayload });
      }
      localStorage.setItem("mock_customers", JSON.stringify(data));
      
      setSaving(false);
      setOpen(false);
      toast.success(editingId ? "Đã cập nhật hồ sơ khách hàng" : "Đã thêm khách hàng mới");
      loadData();
    };

    if (useLocalFallback) {
      saveToLocalFallback();
      return;
    }

    if (editingId) {
      // Thử ghi theo cấu trúc Schema Mới Đề xuất trước
      const { error: errProposed } = await supabase.from("customers").update(proposedPayload).eq("id", editingId);
      if (errProposed && (errProposed.code === '42703' || errProposed.message?.includes("column"))) {
        // Fallback ghi theo cấu trúc cũ
        const { error: errLegacy } = await supabase.from("customers").update(legacyPayload).eq("id", editingId);
        if (errLegacy) saveToLocalFallback();
        else {
          toast.success("Đã cập nhật thành công");
          loadData();
          setOpen(false);
        }
      } else if (errProposed) {
        saveToLocalFallback();
      } else {
        toast.success("Đã cập nhật thành công (New DB Schema)");
        loadData();
        setOpen(false);
      }
    } else {
      // Thử insert theo cấu trúc mới
      const { error: errProposed } = await supabase.from("customers").insert([proposedPayload]);
      if (errProposed && (errProposed.code === '42703' || errProposed.message?.includes("column"))) {
        const { error: errLegacy } = await supabase.from("customers").insert([legacyPayload]);
        if (errLegacy) {
          toast.error("CSDL chưa đồng bộ bảng, tự động lưu Local...");
          setUseLocalFallback(true);
          saveToLocalFallback();
        } else {
          toast.success("Đã thêm khách hàng mới");
          loadData();
          setOpen(false);
        }
      } else if (errProposed) {
        toast.error("Lỗi kết nối DB, tự động lưu Local...");
        setUseLocalFallback(true);
        saveToLocalFallback();
      } else {
        toast.success("Đã thêm khách hàng mới (New DB Schema)");
        loadData();
        setOpen(false);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa khách hàng "${name}" khỏi hệ thống?`)) return;
    
    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      // Soft delete local fallback
      const idx = data.findIndex((c: any) => c.id === id);
      if (idx >= 0) {
        data[idx].deleted_at = new Date().toISOString();
        data[idx].status = "inactive";
        localStorage.setItem("mock_customers", JSON.stringify(data));
      } else {
        data = data.filter((c: any) => c.id !== id);
        localStorage.setItem("mock_customers", JSON.stringify(data));
      }
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast.success("Đã chuyển khách hàng vào thùng rác (Soft Delete)");
      return;
    }

    // Thử SOFT DELETE trước theo đề xuất MVP API
    const { error: softErr } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString(), status: "inactive" })
      .eq("id", id);

    if (softErr && (softErr.code === '42703' || softErr.message?.includes("column"))) {
      // Fallback sang hard delete nếu bảng DB chưa có cột deleted_at
      const { error: hardErr } = await supabase.from("customers").delete().eq("id", id);
      if (hardErr) toast.error("Lỗi xóa: " + hardErr.message);
      else {
        toast.success("Đã xóa khách hàng (Hard delete fallback)");
        loadData();
      }
    } else if (softErr) {
      toast.error("Lỗi chuyển thùng rác: " + softErr.message);
    } else {
      toast.success("Đã chuyển hồ sơ vào thùng rác (Soft Delete)");
      loadData();
    }
  };

  const handleStatusChangeDirect = async (id: string, newStatus: string) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    try {
      const data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      const idx = data.findIndex((c: any) => c.id === id);
      if (idx >= 0) {
        data[idx].status = newStatus;
        localStorage.setItem("mock_customers", JSON.stringify(data));
      }
    } catch {}

    if (useLocalFallback) {
      toast.success(`Đã chuyển sang "${newStatus.toUpperCase()}"`);
      return;
    }

    const { error } = await supabase.from("customers").update({ status: newStatus }).eq("id", id);
    if (error) toast.error("Lỗi đồng bộ trạng thái: " + error.message);
    else toast.success(`Đã cập nhật pipeline sang: ${newStatus.toUpperCase()}`);
  };

  const handleCreateOrder = (c: Customer) => {
    try {
      navigator.clipboard.writeText(c.name);
      toast.success(`Đã sao chép tên "${c.name}" để gán vào đơn hàng mới!`);
    } catch (err) {
      // ignore
    }
    navigate({ to: "/orders/new" });
  };

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case "lead":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            LEAD
          </span>
        );
      case "consulting":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            ĐANG TƯ VẤN
          </span>
        );
      case "quoted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            ĐÃ BÁO GIÁ
          </span>
        );
      case "ordered":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            ĐÃ MUA
          </span>
        );
      case "repeat":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-teal-50 text-teal-700 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
            MUA LẠI
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-slate-100 text-slate-500 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            NGƯNG
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            LEAD
          </span>
        );
    }
  };

  const renderPotentialBadge = (level?: string) => {
    switch (level) {
      case "hot":
        return <span className="bg-red-50 text-red-700 font-extrabold text-[10px] px-2 py-0.5 rounded border border-red-200">🔥 HOT</span>;
      case "warm":
        return <span className="bg-amber-50 text-amber-700 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-200">⭐ WARM</span>;
      case "cold":
        return <span className="bg-slate-100 text-slate-500 font-medium text-[10px] px-2 py-0.5 rounded border border-slate-200">❄️ COLD</span>;
      default:
        return <span className="bg-red-50 text-red-700 font-extrabold text-[10px] px-2 py-0.5 rounded border border-red-200">🔥 HOT</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Link to="/" className="hover:text-primary inline-flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Trang chủ
              </Link>
              <span>/</span>
              <span className="text-slate-800">Khách hàng</span>
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Khách hàng</h1>
              <p className="text-xs text-slate-500 hidden sm:inline-block border-l border-slate-200 pl-3">
                Quản lý khách hàng spa/salon và lịch sử mua hàng
              </p>
            </div>
          </div>
          
          <Button onClick={() => handleOpenEdit()} className="shadow-sm hover:shadow transition-all duration-300">
            <Plus className="w-4 h-4 mr-2" /> Thêm khách hàng
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-6 space-y-6 flex-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-700 group-hover:w-1.5 transition-all"></div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng khách hàng</p>
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">{stats.total}</span>
              <span className="text-[10px] text-slate-400 font-medium">Đối tác</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 group-hover:w-1.5 transition-all"></div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khách mới (Lead)</p>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-blue-600 font-mono tracking-tight">{stats.newCustomers}</span>
              <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-bold">Mới</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 group-hover:w-1.5 transition-all"></div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cần follow-up</p>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-600 font-mono tracking-tight">{stats.followUp}</span>
              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold">Tư vấn</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 group-hover:w-1.5 transition-all"></div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đã mua hàng</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 font-mono tracking-tight">{stats.purchased}</span>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Chốt sale</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-col gap-3.5">
            {/* Thanh Bộ Lọc Nhanh CRM (Smart Follow-up Filters) */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-200/60">
              <span className="text-xs font-bold text-slate-500 mr-1 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Nhắc việc:
              </span>
              <Button
                size="sm"
                variant={smartFilter === "all" ? "default" : "outline"}
                onClick={() => setSmartFilter("all")}
                className="h-8 text-xs font-bold rounded-full shadow-2xs"
              >
                Tất cả
              </Button>
              <Button
                size="sm"
                variant={smartFilter === "today" ? "default" : "outline"}
                onClick={() => setSmartFilter("today")}
                className="h-8 text-xs font-bold rounded-full shadow-2xs bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              >
                🔥 Gọi lại hôm nay
              </Button>
              <Button
                size="sm"
                variant={smartFilter === "overdue" ? "default" : "outline"}
                onClick={() => setSmartFilter("overdue")}
                className="h-8 text-xs font-bold rounded-full shadow-2xs bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
              >
                ⚠️ Quá hạn follow-up
              </Button>
              <Button
                size="sm"
                variant={smartFilter === "no_contact_7d" ? "default" : "outline"}
                onClick={() => setSmartFilter("no_contact_7d")}
                className="h-8 text-xs font-bold rounded-full shadow-2xs bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              >
                ⏳ Chưa chăm sóc &gt; 7 ngày
              </Button>
              <Button
                size="sm"
                variant={smartFilter === "quoted_not_bought" ? "default" : "outline"}
                onClick={() => setSmartFilter("quoted_not_bought")}
                className="h-8 text-xs font-bold rounded-full shadow-2xs bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
              >
                💬 Đã báo giá chưa chốt
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider inline-flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-primary" /> Chế độ hiển thị:
                </span>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === "table" ? "bg-white text-primary shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    📋 Dạng Bảng (Table)
                  </button>
                  <button
                    onClick={() => setViewMode("kanban")}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === "kanban" ? "bg-white text-primary shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    📊 Kanban Pipeline (Kéo thả)
                  </button>
                </div>
              </div>
              <span className="text-xs text-slate-500">
                Hiển thị <strong className="text-slate-900">{filtered.length}</strong> kết quả
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Tìm tên, cơ sở, SĐT..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-10 bg-white border-slate-200 text-sm focus-visible:ring-1 focus-visible:ring-primary shadow-2xs"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer font-medium"
                >
                  <option value="all">🏷️ Tất cả trạng thái</option>
                  <option value="lead">LEAD (Tiềm năng)</option>
                  <option value="consulting">ĐANG TƯ VẤN</option>
                  <option value="quoted">ĐÃ BÁO GIÁ</option>
                  <option value="ordered">ĐÃ MUA HÀNG</option>
                  <option value="repeat">KHÁCH MUA LẠI</option>
                  <option value="inactive">NGƯNG CHĂM SÓC</option>
                </select>
              </div>

              <div>
                <select
                  value={saleFilter}
                  onChange={(e) => setSaleFilter(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                >
                  <option value="all">👤 Tất cả SALE phụ trách</option>
                  {uniqueSales.map(sale => (
                    <option key={sale} value={sale}>{sale}</option>
                  ))}
                  <option value="Chưa phân công">Chưa phân công</option>
                </select>
              </div>

              <div>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                >
                  <option value="all">🌐 Tất cả nguồn khách</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Zalo">Zalo</option>
                  <option value="Website">Website</option>
                  <option value="Giới thiệu">Giới thiệu</option>
                  <option value="Sự kiện / Workshop">Sự kiện / Workshop</option>
                  <option value="Khách cũ">Khách cũ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>
          </div>

          {viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Khách hàng</th>
                  <th className="px-5 py-3.5">Cơ sở (Spa/Salon)</th>
                  <th className="px-5 py-3.5">Số điện thoại</th>
                  <th className="px-5 py-3.5 text-center">Trạng thái</th>
                  <th className="px-5 py-3.5">SALE phụ trách</th>
                  <th className="px-5 py-3.5 text-center">Lần CS cuối</th>
                  <th className="px-5 py-3.5 text-right w-36">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-primary opacity-60" />
                      <p className="text-sm font-medium">Đang tải danh sách đối tác...</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-sm font-semibold text-slate-600">Không tìm thấy khách hàng nào</p>
                        <p className="text-xs text-slate-400">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc phía trên để kiểm tra lại.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-5 py-4">
                        <Link 
                          to="/customers/$id" 
                          params={{ id: c.id }}
                          className="font-bold text-slate-900 group-hover:text-primary transition-colors flex items-center gap-2 hover:underline"
                        >
                          {c.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {c.is_vip && (
                            <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full shadow-2xs tracking-wider uppercase">
                              ★ VIP
                            </span>
                          )}
                          {renderPotentialBadge(c.potential_level)}
                          <span className="text-[10px] text-slate-400 font-medium inline-flex items-center gap-0.5 bg-slate-100 px-1.5 py-0.5 rounded">
                            <Tag className="w-2.5 h-2.5" />
                            {c.source || "Facebook"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {c.facility_name ? (
                          <div>
                            <span className="font-semibold text-slate-800">{c.facility_name}</span>
                            {(c.address || c.province) && (
                              <p className="text-xs text-slate-400 inline-flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[180px]">
                                  {[c.address, c.province].filter(Boolean).join(", ")}
                                </span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Chưa cập nhật</span>
                        )}
                      </td>

                      <td className="px-5 py-4 font-mono font-medium">
                        {c.phone ? (
                          <a 
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 hover:underline px-2 py-1 rounded bg-primary/5 border border-primary/10 transition-all font-bold text-xs"
                            title="Bấm để gọi ngay"
                          >
                            <Phone className="w-3 h-3" />
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Trống</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {renderStatusBadge(c.status)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] text-slate-500 font-bold border border-slate-200">
                            {(c.sale_name || "S")[0]}
                          </div>
                          {c.sale_name || "Chưa phân công"}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <div>
                          <span className="text-xs text-slate-700 font-medium block">
                            {c.last_contact_date || "Hôm nay"}
                          </span>
                          {c.next_followup_date && (
                            <span className="text-[10px] text-amber-600 font-mono block mt-0.5">
                              Hẹn: {c.next_followup_date}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Liên kết xem chi tiết trang độc lập */}
                          <Link
                            to="/customers/$id"
                            params={{ id: c.id }}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all shadow-2xs"
                            title="Xem trang chi tiết CRM đầy đủ"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all shadow-2xs"
                            title="Sửa thông tin"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleCreateOrder(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 font-bold text-xs shadow-2xs transition-all"
                            title="Lập báo giá/đơn hàng cho khách này"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span className="hidden xl:inline">Tạo đơn</span>
                          </button>

                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive transition-colors ml-1"
                            title="Xóa khách hàng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          ) : (
            /* BẢNG KANBAN PIPELINE VIEW CỰC CHẤT LƯỢNG */
            <div className="p-4 bg-slate-50 overflow-x-auto">
              <div className="flex gap-4 min-w-[1400px] pb-4">
                {[
                  { id: "lead", title: "LEAD (Tiềm năng)", color: "border-blue-500", bg: "bg-blue-50/50", badgeColor: "bg-blue-600" },
                  { id: "consulting", title: "ĐANG TƯ VẤN", color: "border-amber-500", bg: "bg-amber-50/50", badgeColor: "bg-amber-600" },
                  { id: "quoted", title: "ĐÃ BÁO GIÁ", color: "border-purple-500", bg: "bg-purple-50/50", badgeColor: "bg-purple-600" },
                  { id: "ordered", title: "ĐÃ MUA HÀNG", color: "border-emerald-500", bg: "bg-emerald-50/50", badgeColor: "bg-emerald-600" },
                  { id: "repeat", title: "KHÁCH MUA LẠI", color: "border-teal-500", bg: "bg-teal-50/50", badgeColor: "bg-teal-600" },
                  { id: "inactive", title: "NGƯNG CHĂM SÓC", color: "border-slate-400", bg: "bg-slate-50/50", badgeColor: "bg-slate-500" }
                ].map((col) => {
                  const itemsInCol = filtered.filter(c => {
                    const s = (c.status || "lead").toLowerCase();
                    if (col.id === "consulting") return s.includes("tư vấn") || s === "consulting";
                    if (col.id === "quoted") return s.includes("báo giá") || s === "quoted";
                    if (col.id === "ordered") return s.includes("đã mua") || s === "ordered";
                    if (col.id === "repeat") return s.includes("mua lại") || s === "repeat";
                    if (col.id === "inactive") return s.includes("ngưng") || s === "inactive";
                    return s === "lead" || s.includes("lead");
                  });

                  return (
                    <div 
                      key={col.id} 
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const draggedId = e.dataTransfer.getData("text/plain");
                        if (draggedId) {
                          handleStatusChangeDirect(draggedId, col.id);
                        }
                      }}
                      className="flex-1 min-w-[220px] max-w-[280px] bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden"
                    >
                      <div className={`p-3 border-b border-slate-100 flex items-center justify-between border-t-3 ${col.color}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${col.badgeColor}`}></span>
                          <span className="text-xs font-bold text-slate-800 tracking-tight truncate">{col.title}</span>
                        </div>
                        <span className="text-[10px] font-mono bg-slate-100 font-bold text-slate-600 px-2 py-0.5 rounded-full shrink-0">
                          {itemsInCol.length}
                        </span>
                      </div>

                      <div className={`p-2.5 flex-1 space-y-2.5 min-h-[420px] max-h-[600px] overflow-y-auto ${col.bg}`}>
                        {itemsInCol.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-200/60 rounded-lg bg-white/40">
                            <p className="text-[11px] text-slate-400 font-medium italic">Kéo thả thẻ khách vào đây</p>
                          </div>
                        ) : (
                          itemsInCol.map(c => (
                            <div
                              key={c.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", c.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs hover:shadow-sm cursor-grab active:cursor-grabbing transition-all space-y-2 group/card relative"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <Link 
                                  to="/customers/$id" 
                                  params={{ id: c.id }}
                                  className="text-xs font-bold text-slate-900 hover:text-primary leading-tight hover:underline block truncate"
                                >
                                  {c.name}
                                </Link>
                                {c.is_vip && <span className="text-[8px] font-bold bg-amber-500 text-white px-1 rounded shrink-0">VIP</span>}
                              </div>

                              {c.facility_name && (
                                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                  <Building2 className="w-2.5 h-2.5 shrink-0" />
                                  {c.facility_name}
                                </p>
                              )}

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                                <span className="text-slate-400 font-medium truncate max-w-[100px]">
                                  👤 {c.sale_name?.split(" ").pop() || "Sale"}
                                </span>
                                <span className="text-slate-500 font-mono shrink-0">
                                  ⏱️ {c.last_contact_date?.slice(0, 5) || "nay"}
                                </span>
                              </div>

                              {/* Nút thao tác chuyển cột nhanh khi không dùng chuột kéo */}
                              <div className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 transition-opacity bg-white/90 backdrop-blur-xs p-0.5 rounded border border-slate-200 flex items-center gap-0.5 shadow-2xs">
                                {col.id !== "lead" && (
                                  <button
                                    onClick={() => {
                                      const order = ["lead", "consulting", "quoted", "ordered", "repeat", "inactive"];
                                      const prevIdx = order.indexOf(col.id) - 1;
                                      if (prevIdx >= 0) handleStatusChangeDirect(c.id, order[prevIdx]);
                                    }}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-600"
                                    title="Lùi trạng thái"
                                  >
                                    <ArrowLeft className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {col.id !== "inactive" && (
                                  <button
                                    onClick={() => {
                                      const order = ["lead", "consulting", "quoted", "ordered", "repeat", "inactive"];
                                      const nextIdx = order.indexOf(col.id) + 1;
                                      if (nextIdx < order.length) handleStatusChangeDirect(c.id, order[nextIdx]);
                                    }}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-600"
                                    title="Tiến trạng thái tiếp theo"
                                  >
                                    <ArrowLeft className="w-2.5 h-2.5 rotate-180" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal Form Thêm/Sửa Khách hàng cấu trúc 3 Nhóm chuyên nghiệp */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-white sticky top-0 z-10">
            <DialogTitle className="text-lg font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                {editingId ? "✏️ Cập nhật hồ sơ khách hàng" : "✨ Thêm khách hàng mới"}
              </span>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 cursor-pointer bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <input 
                  type="checkbox" 
                  checked={form.is_vip} 
                  onChange={(e) => setForm({ ...form, is_vip: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400"
                />
                ★ KHÁCH VIP
              </label>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[68vh] overflow-y-auto px-6 py-4 space-y-6">
            {/* Nhóm 1: Thông tin cơ bản */}
            <div className="space-y-3.5 rounded-lg bg-slate-50/50 p-3.5 border border-slate-100">
              <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">
                <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">1</span>
                Thông tin cơ bản
              </h3>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs font-bold text-slate-700">
                    Tên người liên hệ <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs font-bold text-slate-700">
                    Số điện thoại <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0912..."
                    className="h-8 text-xs font-mono bg-white"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="facility" className="text-xs font-bold text-slate-700">Tên cơ sở / spa / salon</Label>
                  <Input
                    id="facility"
                    value={form.facility_name}
                    onChange={(e) => setForm({ ...form, facility_name: e.target.value })}
                    placeholder="VD: Desembre Spa"
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs font-bold text-slate-700">Email liên hệ</Label>
                  <Input
                    id="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="spa@gmail.com"
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="address" className="text-xs font-bold text-slate-700">Địa chỉ cụ thể</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Số nhà, đường, phường/xã..."
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="province" className="text-xs font-bold text-slate-700">Tỉnh/thành (City)</Label>
                  <Input
                    id="province"
                    value={form.province}
                    onChange={(e) => setForm({ ...form, province: e.target.value })}
                    placeholder="Hà Nội, TP.HCM..."
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Nhóm 2: Thông tin bán hàng */}
            <div className="space-y-3.5 rounded-lg bg-slate-50/50 p-3.5 border border-slate-100">
              <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">
                <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">2</span>
                Thông tin bán hàng
              </h3>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Trạng thái khách hàng</Label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-bold"
                  >
                    <option value="lead">LEAD (Tiềm năng)</option>
                    <option value="consulting">ĐANG TƯ VẤN</option>
                    <option value="quoted">ĐÃ BÁO GIÁ</option>
                    <option value="ordered">ĐÃ MUA HÀNG</option>
                    <option value="repeat">KHÁCH MUA LẠI</option>
                    <option value="inactive">NGƯNG CHĂM SÓC</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Nguồn khách</Label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  >
                    <option value="Facebook">Facebook</option>
                    <option value="Zalo">Zalo</option>
                    <option value="Website">Website</option>
                    <option value="Giới thiệu">Giới thiệu</option>
                    <option value="Sự kiện / Workshop">Sự kiện / Workshop</option>
                    <option value="Khách cũ">Khách cũ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Mức độ tiềm năng</Label>
                  <select
                    value={form.potential_level}
                    onChange={(e) => setForm({ ...form, potential_level: e.target.value })}
                    className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-semibold"
                  >
                    <option value="hot">🔥 Nóng (Hot - Chốt cao)</option>
                    <option value="warm">⭐ Ấm (Warm - Tìm hiểu)</option>
                    <option value="cold">❄️ Lạnh (Cold - Nuôi dưỡng)</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="sale_name" className="text-xs font-bold text-slate-700">SALE phụ trách</Label>
                  <Input
                    id="sale_name"
                    value={form.sale_name}
                    onChange={(e) => setForm({ ...form, sale_name: e.target.value })}
                    placeholder="Tên nhân viên Sale"
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="main_demand" className="text-xs font-bold text-slate-700">Nhu cầu chính</Label>
                  <Input
                    id="main_demand"
                    value={form.main_demand}
                    onChange={(e) => setForm({ ...form, main_demand: e.target.value })}
                    placeholder="VD: Nhập sỉ mỹ phẩm, mở spa, liệu trình peel..."
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Nhóm 3: Ghi chú */}
            <div className="space-y-3.5 rounded-lg bg-slate-50/50 p-3.5 border border-slate-100">
              <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">
                <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">3</span>
                Ghi chú & Follow-up
              </h3>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="skin_problems" className="text-xs font-bold text-slate-700">Vấn đề da / Chăm sóc (Concern)</Label>
                  <Input
                    id="skin_problems"
                    value={form.skin_problems}
                    onChange={(e) => setForm({ ...form, skin_problems: e.target.value })}
                    placeholder="VD: Điều trị mụn, da nhạy cảm, lão hóa..."
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="interested_products" className="text-xs font-bold text-slate-700">Sản phẩm quan tâm</Label>
                  <Input
                    id="interested_products"
                    value={form.interested_products}
                    onChange={(e) => setForm({ ...form, interested_products: e.target.value })}
                    placeholder="VD: Kem chống nắng, tế bào gốc..."
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="demand_notes" className="text-xs font-bold text-slate-700">Ghi chú chi tiết (Note)</Label>
                <Textarea
                  id="demand_notes"
                  value={form.demand_notes}
                  onChange={(e) => setForm({ ...form, demand_notes: e.target.value })}
                  placeholder="Yêu cầu cụ thể, mức chiết khấu, lịch sử trao đổi..."
                  rows={2}
                  className="text-xs bg-white resize-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-1 items-center">
                <div className="space-y-1">
                  <Label htmlFor="next_followup_date" className="text-xs font-bold text-slate-700">Ngày cần follow-up tiếp</Label>
                  <Input
                    id="next_followup_date"
                    value={form.next_followup_date}
                    onChange={(e) => setForm({ ...form, next_followup_date: e.target.value })}
                    placeholder="dd/mm/yyyy"
                    className="h-8 text-xs font-mono bg-white"
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="last_contact_date" className="text-xs font-bold text-slate-700">Ngày liên hệ lần cuối</Label>
                  <Input
                    id="last_contact_date"
                    value={form.last_contact_date}
                    onChange={(e) => setForm({ ...form, last_contact_date: e.target.value })}
                    placeholder="dd/mm/yyyy"
                    className="h-8 text-xs font-mono bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50 sticky bottom-0 z-10">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving} size="sm" className="shadow-2xs">Hủy bỏ</Button>
            <Button onClick={handleSave} disabled={saving} size="sm" className="shadow-2xs font-bold">
              {saving && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              {editingId ? "Lưu cập nhật" : "✨ Thêm mới ngay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
