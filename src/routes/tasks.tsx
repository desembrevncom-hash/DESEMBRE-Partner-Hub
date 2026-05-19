import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Play, 
  PhoneOff, 
  Flame, 
  UserCheck, 
  Plus, 
  Search, 
  Loader2, 
  AlertCircle, 
  Calendar, 
  ListTodo,
  FileText
} from "lucide-react";
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

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

type TaskItem = {
  id: string;
  customer_id?: string | null;
  lead_id?: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  owner_tele_id?: string | null;
  task_type: string;
  title: string;
  note?: string | null;
  priority: string;
  status: string;
  due_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  result?: string | null;
  next_action?: string | null;
  created_at: string;
  // Bổ sung dữ liệu join/map tĩnh
  customer_name?: string;
  customer_phone?: string;
  customer?: {
    id: string;
    contact_name?: string | null;
    name?: string | null;
    business_name?: string | null;
    facility_name?: string | null;
    phone?: string | null;
  } | null;
};

const TASK_TYPE_LABELS: Record<string, string> = {
  call: "📞 Gọi điện thoại",
  reactivation: "✨ Chăm sóc lại (Khách cũ)",
  event_invite: "🎟️ Mời sự kiện",
  check_in: "👋 Thăm hỏi định kỳ",
  lead_qualification: "🎯 Đánh giá tiềm năng",
  quote_follow_up: "💰 Theo dõi báo giá",
  reorder_reminder: "📦 Nhắc đặt hàng lại",
};

const STATUS_LABELS: Record<string, { text: string; bg: string; text_color: string }> = {
  pending: { text: "⏳ Chờ xử lý", bg: "bg-amber-50", text_color: "text-amber-700" },
  in_progress: { text: "▶️ Đang thực hiện", bg: "bg-blue-50", text_color: "text-blue-700" },
  completed: { text: "✅ Đã hoàn thành", bg: "bg-emerald-50", text_color: "text-emerald-700" },
  failed: { text: "❌ Thất bại", bg: "bg-red-50", text_color: "text-red-700" },
  cancelled: { text: "🚫 Đã hủy", bg: "bg-slate-50", text_color: "text-slate-600" },
};

const RESULT_LABELS: Record<string, string> = {
  interested: "🔥 Có quan tâm",
  not_interested: "🧊 Không quan tâm",
  no_answer: "🔇 Không nghe máy",
  wrong_number: "📵 Sai số / Nhầm máy",
  call_back_later: "⏰ Hẹn gọi lại sau",
  qualified: "⭐ Tiềm năng cao",
  transfer_to_sale: "➡️ Cần chuyển Sale",
};

export function TasksPage() {
  const { user, isAdmin, isSubAdmin, isTeleLead, isSale, isTelesale } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Bộ lọc danh sách
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Danh sách nhân sự phụ trách để ánh xạ và tạo việc
  const [staffList, setStaffList] = useState<Array<{ id: string; display_name?: string; email?: string }>>([]);
  const [customersList, setCustomersList] = useState<Array<{ id: string; name: string; phone?: string }>>([]);

  const isMock = !!localStorage.getItem("mock_session") || !!localStorage.getItem("mock_tasks");
  const [useLocalFallback, setUseLocalFallback] = useState(isMock);

  // Modal tạo task mới
  const [openInsert, setOpenInsert] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    task_type: "call",
    priority: "normal",
    assigned_to: "",
    customer_id: "",
    due_at: "",
    note: "",
  });

  // Tải danh sách nhân sự tham chiếu
  useEffect(() => {
    async function fetchReferences() {
      if (!user) return;
      try {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, full_name, email");
        if (profs) {
          setStaffList(profs.map((p: any) => ({
            id: p.id,
            display_name: p.display_name || p.full_name || p.email?.split("@")[0],
            email: p.email
          })));
        }

        let fetchedCustomers: any[] = [];
        let query = supabase.from("customers").select("id, name, phone").is("deleted_at", null);

        if (isAdmin || isSubAdmin) {
          const { data } = await query;
          fetchedCustomers = data || [];
        } else if (isTeleLead) {
          const { data } = await query.eq("owner_tele_id", user.id);
          fetchedCustomers = data || [];
        } else if (isSale) {
          const { data } = await query.eq("owner_sale_id", user.id);
          fetchedCustomers = data || [];
        } else if (isTelesale) {
          const { data: tasksData } = await supabase
            .from("customer_tasks")
            .select("customer_id")
            .eq("assigned_to", user.id);
          
          const customerIds = Array.from(new Set((tasksData || []).map(t => t.customer_id).filter(Boolean)));
          if (customerIds.length > 0) {
            const { data: custData } = await query.in("id", customerIds);
            fetchedCustomers = custData || [];
          }
        }
        setCustomersList(fetchedCustomers);
      } catch (err) {
        console.error("Error loading references in tasks board:", err);
      }
    }
    fetchReferences();
  }, [user, isAdmin, isSubAdmin, isTeleLead, isSale, isTelesale]);

  const loadTasks = async () => {
    setLoading(true);

    const defaultBaselineTasks: TaskItem[] = [
      {
        id: "task-1",
        title: "Gọi tư vấn liệu trình Desembre cho Spa mới",
        task_type: "call",
        priority: "high",
        status: "pending",
        created_at: new Date().toISOString(),
        customer_name: "Lan Anh Beauty & Spa",
        customer_phone: "0912345678",
        due_at: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        id: "task-2",
        title: "Chăm sóc lại khách tỉnh xa chưa nhập hàng 2 tháng",
        task_type: "reactivation",
        priority: "normal",
        status: "in_progress",
        created_at: new Date().toISOString(),
        customer_name: "Tuấn Premium Clinic",
        customer_phone: "0987654321",
        result: "interested",
      },
    ];

    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_tasks") || "[]");
      if (data.length === 0) {
        data = [...defaultBaselineTasks];
        try { localStorage.setItem("mock_tasks", JSON.stringify(data)); } catch { /* ignore */ }
      }
      setTasks(data);
      setLoading(false);
      return;
    }

    try {
      // Tối ưu hóa truy vấn RLS: Lấy toàn bộ task mà dải bảo mật cho phép đọc
      const { data, error } = await supabase
        .from("customer_tasks")
        .select(`
          *,
          customer:customers(
            id,
            contact_name,
            name,
            business_name,
            facility_name,
            phone
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      // Hậu xử lý ánh xạ thông tin khách hàng từ DB Join
      const finalTasks: TaskItem[] = [];
      const loaded = (data as any) || [];

      for (const t of loaded) {
        let cName = "Khách tự do";
        let cPhone = "—";

        if (t.customer) {
          cName = t.customer.contact_name || t.customer.name || "Khách hàng";
          cPhone = t.customer.phone || "—";
        }

        finalTasks.push({
          ...t,
          customer_name: cName,
          customer_phone: cPhone,
        });
      }

      if (finalTasks.length === 0 && (isAdmin || isSubAdmin)) {
        // Tự động đẩy danh sách mẫu nếu DB trống trơn để tối ưu UI Demo
        setTasks([...defaultBaselineTasks]);
      } else {
        setTasks(finalTasks);
      }
    } catch {
      setUseLocalFallback(true);
      let localData = JSON.parse(localStorage.getItem("mock_tasks") || "[]");
      if (localData.length === 0) {
        localData = [...defaultBaselineTasks];
        try { localStorage.setItem("mock_tasks", JSON.stringify(localData)); } catch { /* ignore */ }
      }
      setTasks(localData);
      toast.success("Đã kích hoạt dải dữ liệu tác vụ dự phòng cục bộ");
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, [useLocalFallback, user?.id, customersList.length]);

  // Bộ lọc tính toán
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Lọc từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchCust = t.customer_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchCust) return false;
      }

      // Lọc trạng thái
      if (statusFilter !== "all") {
        if (statusFilter === "overdue") {
          if (t.status === "completed" || t.status === "cancelled") return false;
          if (!t.due_at) return false;
          return new Date(t.due_at).getTime() < Date.now();
        }
        if (t.status !== statusFilter) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, statusFilter]);

  // CÁC THАО TÁC XỬ LÝ NHANH CỦA NHÂN VIÊN (QUICK UPDATE ACTIONS)
  const updateTaskFields = async (taskId: string, fields: Partial<TaskItem>, successMsg: string) => {
    // 1. Cập nhật giao diện lập tức (Optimistic updates)
    setTasks(prev => prev.map(item => {
      if (item.id === taskId) {
        return { ...item, ...fields, updated_at: new Date().toISOString() };
      }
      return item;
    }));

    // 2. Ghi đệm cache nếu dùng Fallback
    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_tasks") || "[]");
      data = data.map((item: any) => item.id === taskId ? { ...item, ...fields } : item);
      localStorage.setItem("mock_tasks", JSON.stringify(data));
      toast.success(successMsg);
      return;
    }

    // 3. Ghi thực tế xuống Supabase
    const { error } = await supabase.from("customer_tasks").update(fields).eq("id", taskId);
    if (error) {
      toast.error("Lỗi đồng bộ trạng thái: " + error.message);
      // Khôi phục nếu lỗi
      loadTasks();
    } else {
      toast.success(successMsg);
    }
  };

  const handleStartTask = (id: string) => {
    updateTaskFields(id, { 
      status: "in_progress", 
      started_at: new Date().toISOString() 
    }, "▶️ Đã bắt đầu thực hiện công việc!");
  };

  const handleCompleteTask = (id: string) => {
    updateTaskFields(id, { 
      status: "completed", 
      completed_at: new Date().toISOString() 
    }, "✅ Đã đánh dấu hoàn thành tác vụ!");
  };

  const handleNoAnswer = (id: string) => {
    updateTaskFields(id, { 
      result: "no_answer",
      status: "completed",
      completed_at: new Date().toISOString() 
    }, "🔇 Đã ghi nhận: Khách không nghe máy.");
  };

  const handleMarkInterested = (id: string) => {
    updateTaskFields(id, { 
      result: "interested" 
    }, "🔥 Ghi nhận thành công: Khách có quan tâm!");
  };

  const handleTransferToSale = (id: string) => {
    updateTaskFields(id, { 
      result: "transfer_to_sale" 
    }, "➡️ Đã gắn cờ: Cần chuyển giao Sale thị trường chăm sóc tiếp!");
  };

  // Tạo tác vụ phân công mới
  const handleSaveInsert = async () => {
    if (!form.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề công việc");
      return;
    }

    setInserting(true);

    const payload = {
      title: form.title.trim(),
      task_type: form.task_type,
      priority: form.priority,
      assigned_to: form.assigned_to || user?.id || null,
      assigned_by: user?.id || null,
      customer_id: form.customer_id || null,
      owner_tele_id: isTeleLead ? user?.id : null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      note: form.note.trim() || null,
      status: "pending",
    };

    if (useLocalFallback) {
      const newItem = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...payload,
        customer_name: customersList.find(c => c.id === payload.customer_id)?.name || "Khách tự do",
      };
      let data = JSON.parse(localStorage.getItem("mock_tasks") || "[]");
      data.unshift(newItem);
      localStorage.setItem("mock_tasks", JSON.stringify(data));
      setTasks(data);
      setInserting(false);
      setOpenInsert(false);
      toast.success("Đã phân công công việc thành công!");
      return;
    }

    const { error } = await supabase.from("customer_tasks").insert([payload]);
    setInserting(false);

    if (error) {
      toast.error("Lỗi giao việc: " + error.message);
    } else {
      toast.success("✨ Đã khởi tạo và phân công tác vụ mới thành công!");
      setOpenInsert(false);
      loadTasks();
    }
  };

  const getStaffLabel = (id?: string | null) => {
    if (!id) return "—";
    const found = staffList.find(s => s.id === id);
    return found ? found.display_name || found.email : "ID: " + id.slice(0,6);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-12 font-sans">
      {/* HEADER GIAO DIỆN PREMIUM */}
      <header className="border-b border-border bg-white shadow-2xs sticky top-0 z-20">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xs font-semibold text-slate-500 hover:text-primary transition-colors flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Trang chủ</span>
            </Link>
            <div className="h-4 w-[1px] bg-slate-200"></div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" />
              <span>Danh sách Công việc & Tác vụ chăm sóc</span>
            </h1>
          </div>
          <div>
            <Button onClick={() => setOpenInsert(true)} size="sm" className="font-bold bg-primary hover:bg-primary/90 shadow-xs">
              <Plus className="w-4 h-4 mr-1.5" /> Giao việc nhanh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-6 space-y-5">
        {/* THỐNG KÊ NHANH (RICH AESTHETICS COUNTERS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">⏳ Chờ xử lý</div>
            <div className="text-base font-extrabold text-amber-600 mt-0.5">
              {tasks.filter(t => t.status === "pending").length}
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">▶️ Đang thực hiện</div>
            <div className="text-base font-extrabold text-blue-600 mt-0.5">
              {tasks.filter(t => t.status === "in_progress").length}
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">✅ Đã hoàn thành</div>
            <div className="text-base font-extrabold text-emerald-600 mt-0.5">
              {tasks.filter(t => t.status === "completed").length}
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">⏰ Quá hạn (Overdue)</div>
            <div className="text-base font-extrabold text-red-600 mt-0.5">
              {tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_at && new Date(t.due_at).getTime() < Date.now()).length}
            </div>
          </div>
        </div>

        {/* THANH BỘ LỌC TÁC VỤ */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm kiếm tiêu đề hoặc tên khách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === "all" ? "bg-slate-900 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === "pending" ? "bg-amber-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Chờ xử lý
            </button>
            <button
              onClick={() => setStatusFilter("in_progress")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === "in_progress" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Đang làm
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === "completed" ? "bg-emerald-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Hoàn thành
            </button>
            <button
              onClick={() => setStatusFilter("overdue")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                statusFilter === "overdue" ? "bg-red-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ⚠️ Quá hạn
            </button>
          </div>
        </div>

        {/* LƯỚI CARD TÁC VỤ (RICH AESTHETICS DESIGNS) */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            <span>Đang nạp dải công việc từ hệ thống...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium">Không tìm thấy công việc nào tương ứng với bộ lọc hiện tại.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map(t => {
              const st = STATUS_LABELS[t.status] || STATUS_LABELS.pending;
              const isOverdue = t.status !== "completed" && t.status !== "cancelled" && t.due_at && new Date(t.due_at).getTime() < Date.now();
              const isAssignedToMe = t.assigned_to === user?.id;

              return (
                <div 
                  key={t.id} 
                  className={`bg-white border rounded-xl shadow-2xs hover:shadow-md transition-all flex flex-col overflow-hidden relative ${
                    isOverdue ? "border-red-300 bg-red-50/10" : "border-slate-200/80"
                  }`}
                >
                  {/* Nhãn viền ưu tiên */}
                  <div className={`h-1.5 w-full ${
                    t.priority === "high" ? "bg-red-500" : t.priority === "low" ? "bg-slate-300" : "bg-blue-500"
                  }`}></div>

                  <div className="p-4 flex-1 space-y-3">
                    {/* Hàng 1: Loại hình & Trạng thái */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                        {TASK_TYPE_LABELS[t.task_type] || t.task_type}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text_color}`}>
                        {st.text}
                      </span>
                    </div>

                    {/* Tiêu đề chính */}
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2" title={t.title}>
                        {t.title}
                      </h3>
                      {t.note && (
                        <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded border border-slate-100 line-clamp-2">
                          📝 {t.note}
                        </p>
                      )}
                    </div>

                    {/* Thông tin Khách hàng liên quan */}
                    <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800">
                        {t.customer_id ? (
                          <Link 
                            to="/customers/$id" 
                            params={{ id: t.customer_id }}
                            className="hover:underline hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1 truncate"
                          >
                            👤 <span className="truncate">{t.customer_name}</span>
                          </Link>
                        ) : (
                          <span className="truncate flex items-center gap-1">
                            👤 <span>{t.customer_name}</span>
                          </span>
                        )}
                      </div>
                      {t.customer && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          🏢 {t.customer.business_name || t.customer.facility_name || "Chưa có cơ sở"}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 font-mono">
                        Liên hệ: <strong className="text-slate-700">{t.customer_phone || "—"}</strong>
                      </div>
                    </div>

                    {/* Thông tin Người thực hiện & Hạn chót */}
                    <div className="pt-1 text-[11px] space-y-1 text-slate-500 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span>Phụ trách: <strong>{getStaffLabel(t.assigned_to)}</strong></span>
                        {isAssignedToMe && <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1 rounded">Của bạn</span>}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Hạn chót:</span>
                        </span>
                        <span className={`font-mono font-medium ${isOverdue ? "text-red-600 font-bold animate-pulse" : "text-slate-700"}`}>
                          {t.due_at ? new Date(t.due_at).toLocaleDateString("vi-VN", { hour: '2-digit', minute: '2-digit' }) : "Không thời hạn"}
                        </span>
                      </div>
                    </div>

                    {/* Kết quả phản hồi (Result Badge) */}
                    {t.result && (
                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-1.5 text-center">
                        <span className="text-[11px] font-bold text-purple-800">
                          {RESULT_LABELS[t.result] || t.result}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* KHỐI NÚT BẤM THАО TÁC NHANH (QUICK ACTIONS TOOLBAR) */}
                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-xs">
                    {/* Nhóm cập nhật tiến độ */}
                    {t.status === "pending" && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleStartTask(t.id)}
                        className="h-8 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50 col-span-2"
                      >
                        <Play className="w-3 h-3 mr-1 fill-current" /> Bắt đầu làm
                      </Button>
                    )}

                    {t.status === "in_progress" && (
                      <Button 
                        size="sm" 
                        onClick={() => handleCompleteTask(t.id)}
                        className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white col-span-2 shadow-2xs"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Hoàn thành
                      </Button>
                    )}

                    {/* Nhóm Đánh dấu nhanh kết quả cuộc gọi */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleNoAnswer(t.id)}
                      className="h-7 text-[11px] text-slate-600 hover:bg-slate-200/60 font-medium"
                      title="Ghi nhận Không nghe máy"
                    >
                      <PhoneOff className="w-3 h-3 mr-1 text-slate-400" /> Không nghe
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMarkInterested(t.id)}
                      className="h-7 text-[11px] text-amber-700 hover:bg-amber-50 font-medium"
                      title="Đánh dấu Có quan tâm"
                    >
                      <Flame className="w-3 h-3 mr-1 text-amber-500 fill-current" /> Quan tâm
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTransferToSale(t.id)}
                      className="h-7 text-[11px] font-bold text-purple-700 hover:bg-purple-50 border-purple-200 col-span-2"
                    >
                      ➡️ Cần chuyển giao Sale thị trường
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* DIALOG THÊM TÁC VỤ MỚI */}
      <Dialog open={openInsert} onOpenChange={setOpenInsert}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-900">
              ✨ Phân công tác vụ Chăm sóc mới
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Tiêu đề công việc <span className="text-red-500">*</span></Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="VD: Gọi điện chăm sóc hỏi thăm chất lượng sản phẩm..."
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Loại hình</Label>
                <Select value={form.task_type} onValueChange={val => setForm({ ...form, task_type: val })}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs font-medium">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Độ ưu tiên</Label>
                <Select value={form.priority} onValueChange={val => setForm({ ...form, priority: val })}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high" className="text-xs font-bold text-red-600">🔴 Cao (High)</SelectItem>
                    <SelectItem value="normal" className="text-xs font-medium text-slate-700">🔵 Bình thường</SelectItem>
                    <SelectItem value="low" className="text-xs text-slate-400">⚪ Thấp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Giao cho nhân sự (Assigned to)</Label>
              <Select value={form.assigned_to} onValueChange={val => setForm({ ...form, assigned_to: val })}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Chọn nhân viên thực hiện" />
                </SelectTrigger>
                <SelectContent className="max-h-40">
                  <SelectItem value="" className="text-xs italic text-slate-400">— Giao cho chính tôi —</SelectItem>
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      👤 {s.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Khách hàng liên quan</Label>
              <Select value={form.customer_id} onValueChange={val => setForm({ ...form, customer_id: val })}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Chọn khách hàng" />
                </SelectTrigger>
                <SelectContent className="max-h-40">
                  <SelectItem value="" className="text-xs italic text-slate-400">— Khách tự do (Không đính kèm) —</SelectItem>
                  {customersList.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      👥 {c.name} {c.phone ? `(${c.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Hạn chót (Due Date)</Label>
              <Input
                type="datetime-local"
                value={form.due_at}
                onChange={e => setForm({ ...form, due_at: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Ghi chú hướng dẫn</Label>
              <Input
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="VD: Cần nhấn mạnh chương trình chiết khấu 30%..."
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setOpenInsert(false)} disabled={inserting} className="h-8 text-xs font-bold">
              Hủy
            </Button>
            <Button onClick={handleSaveInsert} disabled={inserting} className="h-8 text-xs font-bold bg-primary hover:bg-primary/90">
              {inserting && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Giao việc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
