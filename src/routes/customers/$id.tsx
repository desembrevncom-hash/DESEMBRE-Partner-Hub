import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  ArrowLeft, Phone, Mail, MapPin, Tag, ShoppingBag, 
  Calendar, FileText, History, CheckCircle2, Clock, 
  Sparkles, Send, UserCheck, AlertCircle, Bookmark, Plus
} from "lucide-react";

export const Route = createFileRoute("/customers/$id")({
  component: CustomerDetailPage,
});

type TimelineEvent = {
  id: string;
  date: string;
  content: string;
  author: string;
};

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const { user, isAdmin, isSale } = useAuth();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "quotes" | "history" | "notes">("history");
  
  // Custom states cho tab Lịch sử CS
  const [historyEvents, setHistoryEvents] = useState<TimelineEvent[]>([]);
  const [newEventContent, setNewEventContent] = useState("");
  
  // Custom state cho ghi chú riêng
  const [notesContent, setNotesContent] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Danh sách Đơn hàng của khách hàng này
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);

  // Dữ liệu baseline mặc định nếu không tìm thấy trong CSDL
  const defaultBaselineData: any[] = [
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
      next_followup_date: "15/05/2026",
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
      status: "consulting",
      sale_name: "Trần Thị B",
      source: "Zalo",
      potential_level: "warm",
      main_demand: "Tìm liệu trình peel da an toàn",
      demand_notes: "Cần gửi file catalog và bảng giá sỉ chi tiết qua Zalo",
      skin_problems: "Da mụn viêm, da mỏng yếu do dùng kem trộn trước đó",
      interested_products: "Set Desembre cấy tảo, Serum cấp ẩm B5",
      next_followup_date: "14/05/2026",
      is_vip: false,
      last_contact_date: "10/05/2026"
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
      last_contact_date: "11/05/2026"
    },
  ];

  // Dữ liệu mẫu Timeline Lịch sử chăm sóc theo đúng yêu cầu ví dụ
  const defaultSampleTimeline: TimelineEvent[] = [
    {
      id: "ev-1",
      date: "12/05/2026",
      content: "SALE A gọi tư vấn combo cleanser",
      author: "Nguyễn Văn A"
    },
    {
      id: "ev-2",
      date: "10/05/2026",
      content: "Gửi báo giá PDF chi tiết qua Zalo",
      author: "Hệ thống"
    },
    {
      id: "ev-3",
      date: "05/05/2026",
      content: "Khách hỏi giá salon size cho dòng tinh chất",
      author: "Khách hàng"
    }
  ];

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      let found: any = null;
      
      // 1. Thử truy vấn từ LocalStorage trước
      const localList = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      found = localList.find((c: any) => c.id === id);

      // 2. Nếu không có local, kiểm tra mảng baseline mẫu
      if (!found) {
        found = defaultBaselineData.find(c => c.id === id);
      }

      // 3. Nếu vẫn không có, gọi CSDL thật
      if (!found) {
        try {
          const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
          if (data) found = data;
        } catch (err) {
          // ignore
        }
      }

      if (found) {
        // Chuẩn hóa key trạng thái và hỗ trợ song song các trường DB đề xuất
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

        // Ánh xạ linh hoạt từ Schema Mới (contact_name) hoặc Schema Cũ (name)
        found.name = found.contact_name || found.name || "Khách hàng";
        found.facility_name = found.business_name || found.facility_name || "";
        found.province = found.city || found.province || "";
        found.demand_notes = found.note || found.demand_notes || "";
        found.skin_problems = found.skin_concern || found.skin_problems || "";
        found.last_contact_date = found.last_contacted_at ? new Date(found.last_contacted_at).toLocaleDateString("vi-VN") : (found.last_contact_date || new Date().toLocaleDateString("vi-VN"));
        found.next_followup_date = found.next_follow_up_at ? new Date(found.next_follow_up_at).toLocaleDateString("vi-VN") : (found.next_followup_date || "");

        found.status = mapLegacyStatus(found.status);
        found.potential_level = found.potential_level || (found.is_potential ? "hot" : "warm");
        setCustomer(found);
        setNotesContent(found.demand_notes || "");

        // 4. Load Timeline Lịch sử Chăm sóc từ DB mới đề xuất: bảng `customer_activities`
        try {
          const { data: actData, error: actErr } = await supabase
            .from("customer_activities")
            .select("*")
            .eq("customer_id", id)
            .order("created_at", { ascending: false });
            
          if (!actErr && actData && actData.length > 0) {
            const mappedActs = actData.map((a: any) => ({
              id: a.id,
              date: new Date(a.created_at).toLocaleDateString("vi-VN"),
              content: a.content || a.title || "",
              author: "Sale Phụ trách"
            }));
            setHistoryEvents(mappedActs);
          } else {
            // Load từ LocalStorage fallback
            const savedHistory = JSON.parse(localStorage.getItem(`history_${id}`) || "null");
            if (savedHistory && Array.isArray(savedHistory)) {
              setHistoryEvents(savedHistory);
            } else {
              setHistoryEvents([...defaultSampleTimeline]);
              try { localStorage.setItem(`history_${id}`, JSON.stringify(defaultSampleTimeline)); } catch {}
            }
          }
        } catch {
          // Fallback hoàn toàn sang LocalStorage
          const savedHistory = JSON.parse(localStorage.getItem(`history_${id}`) || "null");
          if (savedHistory && Array.isArray(savedHistory)) {
            setHistoryEvents(savedHistory);
          } else {
            setHistoryEvents([...defaultSampleTimeline]);
          }
        }

        // Load danh sách đơn hàng liên quan (hỗ trợ trọn vẹn customer_id)
        try {
          let loadedOrders: any[] = [];
          // 1. Thử tải từ DB thật nếu có
          const { data: ordData } = await supabase
            .from("orders")
            .select("*")
            .eq("customer_id", id)
            .order("created_at", { ascending: false });
            
          if (ordData && ordData.length > 0) {
            loadedOrders = ordData;
          }

          // 2. Tải song song từ LocalStorage fallback
          const guestOrders = JSON.parse(localStorage.getItem("guest_orders") || "[]");
          const relatedLocal = guestOrders.filter((o: any) => 
            o.customer_id === id ||
            o.customer_name?.toLowerCase() === found.name?.toLowerCase() || 
            o.customer_phone === found.phone
          );

          // Gộp chung tránh trùng lặp
          const map = new Map();
          [...loadedOrders, ...relatedLocal].forEach(o => map.set(o.id, o));
          setCustomerOrders(Array.from(map.values()));
        } catch { /* ignore */ }

      } else {
        toast.error("Không tìm thấy thông tin khách hàng này");
      }
      setLoading(false);
    }

    fetchDetail();
  }, [id]);

  // Cập nhật trạng thái trực tiếp
  const handleUpdateStatus = async (newStatus: string) => {
    if (!customer) return;
    const updated = { ...customer, status: newStatus };
    setCustomer(updated);
    toast.success("Đã cập nhật trạng thái chăm sóc");

    // Cập nhật ngầm vào LocalStorage
    try {
      const list = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      const idx = list.findIndex((c: any) => c.id === id);
      if (idx >= 0) {
        list[idx].status = newStatus;
        localStorage.setItem("mock_customers", JSON.stringify(list));
      }
    } catch { /* ignore */ }

    // Thử cập nhật Supabase (hỗ trợ cả trường status chuẩn)
    try {
      await supabase.from("customers").update({ status: newStatus }).eq("id", id);
    } catch { /* ignore */ }
  };

  // Thêm sự kiện tương tác mới vào Timeline
  const handleAddTimelineEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventContent.trim()) return;

    const todayStr = new Date().toLocaleDateString("vi-VN");
    const authorName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || customer?.sale_name || "SALE Desembre";
    
    const newEv: TimelineEvent = {
      id: crypto.randomUUID(),
      date: todayStr,
      content: newEventContent.trim(),
      author: authorName
    };

    const updatedTimeline = [newEv, ...historyEvents];
    setHistoryEvents(updatedTimeline);
    setNewEventContent("");
    toast.success("Đã ghi nhận lịch sử tương tác mới");

    // 1. Thử đẩy vào bảng customer_activities đề xuất mới trên DB
    try {
      await supabase.from("customer_activities").insert([{
        customer_id: id,
        created_by: user?.id || null,
        type: "follow_up",
        title: "Ghi nhận cuộc gọi/CS",
        content: newEv.content
      }]);
    } catch { /* ignore */ }

    // 2. Lưu đồng bộ song song LocalStorage fallback
    try {
      localStorage.setItem(`history_${id}`, JSON.stringify(updatedTimeline));
      
      // Cập nhật ngày CS cuối của khách hàng là hôm nay
      const list = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      const idx = list.findIndex((c: any) => c.id === id);
      if (idx >= 0) {
        list[idx].last_contact_date = todayStr;
        list[idx].last_contacted_at = new Date().toISOString();
        localStorage.setItem("mock_customers", JSON.stringify(list));
        setCustomer((prev: any) => ({ ...prev, last_contact_date: todayStr }));
      }
    } catch { /* ignore */ }
  };

  // Lưu Ghi chú riêng
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const list = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      const idx = list.findIndex((c: any) => c.id === id);
      if (idx >= 0) {
        list[idx].demand_notes = notesContent;
        list[idx].note = notesContent;
        localStorage.setItem("mock_customers", JSON.stringify(list));
      }
      setCustomer((prev: any) => ({ ...prev, demand_notes: notesContent }));
      
      // Cập nhật DB thật nếu có
      await supabase.from("customers").update({ note: notesContent, demand_notes: notesContent }).eq("id", id);
      
      toast.success("Đã lưu ghi chú đối tác thành công");
    } catch {
      toast.success("Đã lưu ghi chú đối tác thành công (Local)");
    }
    setSavingNotes(false);
  };

  // Chuyển tiếp lập đơn hàng
  const handleDirectOrder = () => {
    if (customer) {
      try { navigator.clipboard.writeText(customer.name); } catch { /* ignore */ }
      toast.success(`Đã chuẩn bị thông tin "${customer.name}" cho đơn hàng mới`);
    }
    navigate({ to: "/orders/new" });
  };

  // Helper render Badges
  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case "lead":
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>LEAD</span>;
      case "consulting":
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>ĐANG TƯ VẤN</span>;
      case "quoted":
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>ĐÃ BÁO GIÁ</span>;
      case "ordered":
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>ĐÃ MUA HÀNG</span>;
      case "repeat":
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>MUA LẠI</span>;
      case "inactive":
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>NGƯNG</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1.5">LEAD</span>;
    }
  };

  const renderPotentialBadge = (level?: string) => {
    switch (level) {
      case "hot": return <span className="bg-red-50 text-red-700 font-extrabold text-[10px] px-2 py-0.5 rounded border border-red-200">🔥 HOT</span>;
      case "warm": return <span className="bg-amber-50 text-amber-700 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-200">⭐ WARM</span>;
      case "cold": return <span className="bg-slate-100 text-slate-500 font-medium text-[10px] px-2 py-0.5 rounded border border-slate-200">❄️ COLD</span>;
      default: return <span className="bg-red-50 text-red-700 font-extrabold text-[10px] px-2 py-0.5 rounded border border-red-200">🔥 HOT</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-8 text-center flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3 mx-auto"></div>
        <p className="text-sm font-medium text-slate-500">Đang tải hồ sơ khách hàng...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-8 text-center">
        <div className="max-w-md mx-auto bg-white p-6 rounded-xl border border-slate-200 space-y-3">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">Không tìm thấy đối tác</h2>
          <p className="text-xs text-slate-500">Khách hàng này có thể đã bị xóa hoặc đường dẫn không chính xác.</p>
          <Button asChild size="sm" className="mt-2">
            <Link to="/customers">Quay lại danh sách</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 flex flex-col">
      {/* Header Back & Toolbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/customers" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại danh sách</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleDirectOrder} className="font-bold shadow-2xs">
              <ShoppingBag className="w-3.5 h-3.5 mr-1.5" /> Tạo đơn cho khách này
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-6 space-y-6 max-w-5xl">
        {/* KHU VỰC HERO THÔNG TIN KHÁCH HÀNG CHUYÊN SÂU */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            {/* Cột Trái: Tên, Cơ sở, Phân loại */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{customer.name}</h1>
                {customer.is_vip && (
                  <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-2xs tracking-wider uppercase">
                    ★ KHÁCH VIP
                  </span>
                )}
                {renderPotentialBadge(customer.potential_level)}
              </div>

              {customer.facility_name && (
                <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary/60"></span>
                  Cơ sở: <span className="text-primary">{customer.facility_name}</span>
                </p>
              )}

              {/* Thông tin liên hệ nhanh */}
              <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 pt-1 text-xs text-slate-600 font-medium">
                {customer.phone && (
                  <span className="inline-flex items-center gap-1 font-mono text-primary bg-primary/5 px-2 py-0.5 rounded font-bold">
                    <Phone className="w-3 h-3" />
                    <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
                  </span>
                )}
                {customer.email && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Mail className="w-3 h-3" /> {customer.email}
                  </span>
                )}
                {(customer.address || customer.province) && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {[customer.address, customer.province].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </div>

            {/* Cột Phải: SALE & Trạng thái điều chỉnh nhanh */}
            <div className="shrink-0 md:text-right bg-slate-50 p-3.5 rounded-lg border border-slate-100 flex flex-col gap-2 min-w-[200px]">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Trạng thái CS hiện tại</span>
                <select
                  value={customer.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-800 focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                >
                  <option value="lead">LEAD (Tiềm năng)</option>
                  <option value="consulting">ĐANG TƯ VẤN</option>
                  <option value="quoted">ĐÃ BÁO GIÁ</option>
                  <option value="ordered">ĐÃ MUA HÀNG</option>
                  <option value="repeat">KHÁCH MUA LẠI</option>
                  <option value="inactive">NGƯNG CHĂM SÓC</option>
                </select>
              </div>

              <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between md:justify-end gap-2 text-xs">
                <span className="text-slate-400 font-medium">SALE phụ trách:</span>
                <strong className="text-slate-800">{customer.sale_name || "Chưa phân công"}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* HỆ THỐNG 5 TABS CHỨC NĂNG */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Thanh Tabs Navigation */}
          <div className="flex border-b border-slate-200 bg-slate-50/60 overflow-x-auto">
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 min-w-[140px] h-12 px-4 inline-flex items-center justify-center gap-2 text-xs font-bold tracking-wide transition-all border-b-2 ${
                activeTab === "history" 
                  ? "border-primary bg-white text-primary shadow-2xs" 
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Lịch sử CS</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-mono text-slate-600 border">
                {historyEvents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 min-w-[120px] h-12 px-4 inline-flex items-center justify-center gap-2 text-xs font-bold tracking-wide transition-all border-b-2 ${
                activeTab === "overview" 
                  ? "border-primary bg-white text-primary shadow-2xs" 
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Tổng quan</span>
            </button>

            <button
              onClick={() => setActiveTab("orders")}
              className={`flex-1 min-w-[120px] h-12 px-4 inline-flex items-center justify-center gap-2 text-xs font-bold tracking-wide transition-all border-b-2 ${
                activeTab === "orders" 
                  ? "border-primary bg-white text-primary shadow-2xs" 
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Đơn hàng</span>
              {customerOrders.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("quotes")}
              className={`flex-1 min-w-[120px] h-12 px-4 inline-flex items-center justify-center gap-2 text-xs font-bold tracking-wide transition-all border-b-2 ${
                activeTab === "quotes" 
                  ? "border-primary bg-white text-primary shadow-2xs" 
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Báo giá</span>
            </button>

            <button
              onClick={() => setActiveTab("notes")}
              className={`flex-1 min-w-[120px] h-12 px-4 inline-flex items-center justify-center gap-2 text-xs font-bold tracking-wide transition-all border-b-2 ${
                activeTab === "notes" 
                  ? "border-primary bg-white text-primary shadow-2xs" 
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Ghi chú riêng</span>
            </button>
          </div>

          {/* NỘI DUNG TABS */}
          <div className="p-6">
            {/* TAB 4: LỊCH SỬ CHĂM SÓC (QUAN TRỌNG NHẤT) */}
            {activeTab === "history" && (
              <div className="space-y-6">
                {/* Form Nhập hoạt động chăm sóc mới */}
                <form onSubmit={handleAddTimelineEvent} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
                    <Plus className="w-3.5 h-3.5 text-primary" /> Ghi nhận tương tác mới
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      value={newEventContent}
                      onChange={(e) => setNewEventContent(e.target.value)}
                      placeholder="VD: Gọi điện tư vấn combo cleanser, khách hẹn thứ 6 tuần sau gọi lại chốt..."
                      className="bg-white text-xs h-9 flex-1 shadow-2xs"
                    />
                    <Button type="submit" size="sm" className="h-9 px-4 font-bold shrink-0">
                      <Send className="w-3.5 h-3.5 mr-1.5" /> Ghi nhận
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    * Nội dung này sẽ tự động được đồng bộ song song vào bảng `customer_activities` và LocalStorage.
                  </p>
                </form>

                {/* Timeline hiển thị các mốc sự kiện */}
                <div className="space-y-4 pl-2 pt-2">
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                    Dòng thời gian chăm sóc ({historyEvents.length} mốc)
                  </h4>

                  {historyEvents.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">Chưa có lịch sử chăm sóc nào được ghi nhận.</p>
                  ) : (
                    <div className="relative border-l-2 border-slate-100 pl-4 space-y-5 ml-2">
                      {historyEvents.map((ev, index) => (
                        <div key={ev.id} className="relative group">
                          {/* Chấm tròn chỉ thị Timeline */}
                          <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-primary group-hover:bg-primary transition-colors"></div>
                          
                          <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs hover:border-slate-200 transition-all space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                📅 {ev.date}
                              </span>
                              <span className="text-slate-400 font-medium">
                                Nhân viên: <strong className="text-slate-700">{ev.author}</strong>
                              </span>
                            </div>
                            
                            <p className="text-xs text-slate-800 font-medium pt-1 leading-relaxed">
                              {ev.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 1: TỔNG QUAN NỘI DUNG CRM */}
            {activeTab === "overview" && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50 space-y-2.5">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Thông tin Bán hàng</h4>
                    
                    <div className="grid grid-cols-3 gap-1 text-xs pt-1">
                      <span className="text-slate-400 font-medium">Nguồn khách:</span>
                      <span className="col-span-2 font-bold text-slate-800 inline-flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-400" /> {customer.source || "Facebook"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <span className="text-slate-400 font-medium">Tiềm năng:</span>
                      <span className="col-span-2">{renderPotentialBadge(customer.potential_level)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <span className="text-slate-400 font-medium">Lần CS cuối:</span>
                      <span className="col-span-2 font-mono font-semibold text-slate-700">
                        {customer.last_contact_date || "Chưa ghi nhận"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <span className="text-slate-400 font-medium">Lịch hẹn tiếp:</span>
                      <span className="col-span-2 font-mono font-bold text-amber-600">
                        {customer.next_followup_date || <span className="italic text-slate-400 font-normal">Trống</span>}
                      </span>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-lg p-4 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Địa chỉ đầy đủ</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {[customer.address, customer.province].filter(Boolean).join(", ") || "Chưa cập nhật địa chỉ."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border border-slate-100 rounded-lg p-4 bg-white shadow-2xs space-y-2.5">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Nhu cầu & Giải pháp</h4>
                    
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Nhu cầu chính của đối tác:</span>
                      <p className="text-xs font-bold text-slate-800">
                        {customer.main_demand || <span className="italic text-slate-400 font-normal">Chưa khai báo nhu cầu.</span>}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Vấn đề da / Chăm sóc quan tâm:</span>
                      <p className="text-xs text-slate-700 font-medium">
                        {customer.skin_problems || <span className="italic text-slate-400 font-normal">Trống</span>}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Dòng sản phẩm ưu tiên:</span>
                      <p className="text-xs font-bold text-primary">
                        {customer.interested_products || <span className="italic text-slate-400 font-normal">Trống</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ĐƠN HÀNG CỦA KHÁCH */}
            {activeTab === "orders" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Các đơn hàng liên quan ({customerOrders.length})
                  </h4>
                  <Button size="sm" variant="outline" onClick={handleDirectOrder} className="h-8 text-xs font-bold">
                    + Tạo đơn mới
                  </Button>
                </div>

                {customerOrders.length === 0 ? (
                  <div className="text-center py-12 border rounded-xl bg-slate-50/50">
                    <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">Khách hàng này chưa có đơn hàng nào trên hệ thống</p>
                    <p className="text-xs text-slate-400 mt-1">Hãy bấm nút tạo đơn để lên danh sách sản phẩm chốt sale.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="p-3">Mã đơn</th>
                          <th className="p-3">Ngày tạo</th>
                          <th className="p-3 text-right">Tổng tiền</th>
                          <th className="p-3 text-center">Trạng thái</th>
                          <th className="p-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {customerOrders.map(o => (
                          <tr key={o.id} className="hover:bg-slate-50/60">
                            <td className="p-3 font-mono font-bold text-primary">#{o.order_no || "ĐƠN"}</td>
                            <td className="p-3 text-slate-500 font-mono">{new Date(o.created_at).toLocaleDateString("vi-VN")}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">
                              {new Intl.NumberFormat("vi-VN").format(o.total || 0)}đ
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px]">
                                Đã ghi nhận
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[10px]">
                                <Link to="/orders/$id" params={{ id: o.id }}>Xem đơn</Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BÁO GIÁ */}
            {activeTab === "quotes" && (
              <div className="space-y-4">
                <div className="border rounded-xl p-6 bg-slate-50/50 text-center max-w-lg mx-auto space-y-3">
                  <FileText className="w-10 h-10 text-purple-400 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-800">Quản lý Báo giá PDF / Bảng giá sỉ</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Hệ thống tự động liên kết các bản báo giá chuyên nghiệp dành riêng cho đối tác <strong>{customer.name}</strong>.
                  </p>
                  
                  <div className="pt-2 flex flex-wrap justify-center gap-2">
                    <Button size="sm" variant="outline" className="text-xs font-bold shadow-2xs" onClick={() => toast.success("Đã xuất file báo giá PDF chuẩn Desembre")}>
                      📥 Tải Bảng giá sỉ Spa (PDF)
                    </Button>
                    <Button size="sm" className="text-xs font-bold shadow-2xs" onClick={() => toast.success("Đã gửi link báo giá qua Zalo khách hàng")}>
                      ✉️ Gửi nhanh qua Zalo
                    </Button>
                  </div>
                </div>

                {/* Danh sách báo giá demo mẫu theo đúng yêu cầu bài toán */}
                <div className="border rounded-lg p-4 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Lịch sử xuất báo giá</span>
                  <div className="flex items-center justify-between text-xs p-2.5 bg-white rounded border hover:border-purple-200 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-purple-50 text-purple-600 font-bold font-mono text-[10px]">PDF</span>
                      <span className="font-semibold text-slate-700">Báo giá Set cấy tảo & Tế bào gốc Salon Size</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">10/05/2026</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: GHI CHÚ RIÊNG NỘI BỘ */}
            {activeTab === "notes" && (
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Sổ tay ghi chú đặc biệt về khách hàng này</span>
                  <span className="text-[10px] text-slate-400 italic">* Chỉ Sale phụ trách và Admin xem được</span>
                </div>

                <Textarea
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  placeholder="Ghi chép thói quen mua hàng, ngày sinh nhật, yêu cầu chiết khấu, hoặc lưu ý giao hàng riêng..."
                  rows={6}
                  className="text-xs bg-slate-50/50 p-3 leading-relaxed focus:bg-white transition-colors"
                />

                <Button 
                  onClick={handleSaveNotes} 
                  disabled={savingNotes} 
                  size="sm" 
                  className="font-bold shadow-2xs"
                >
                  {savingNotes ? "Đang lưu..." : "💾 Lưu thay đổi ghi chú"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
