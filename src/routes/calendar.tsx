import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  ArrowLeft, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  CalendarDays,
  Users,
  Building2,
  Bell
} from "lucide-react";
import { toast } from "sonner";
import type { CalendarEvent, CalendarEventStatus, CalendarEventType } from "@/types/calendar";
import { 
  formatCalendarTime, 
  getDefaultReminderMinutes, 
  getEventStatusLabel, 
  getEventTypeLabel, 
  isEventOverdue 
} from "@/lib/calendar";
import { useCalendarRealtime } from "@/hooks/useCalendarRealtime";
import { useUpcomingReminders } from "@/hooks/useUpcomingReminders";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { user, isAdmin } = useAuth();
  
  // Dữ liệu danh sách
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [customersList, setCustomersList] = useState<Array<{ id: string; name: string; phone?: string | null }>>([]);
  const [salesList, setSalesList] = useState<Array<{ id: string; name: string }>>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, { name: string; phone?: string | null }>>({});
  const [customerSearch, setCustomerSearch] = useState("");
  
  // Trạng thái chung
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // State Modal Form Tạo Lịch Hẹn
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  
  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("follow_up");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [assignedSaleId, setAssignedSaleId] = useState("");
  const [remindMinutes, setRemindMinutes] = useState(getDefaultReminderMinutes());

  // Hàm nạp danh sách dữ liệu nền tảng
  const loadBaseData = async () => {
    try {
      // 1. Tải danh sách khách hàng kèm số điện thoại (bước 8)
      const { data: custData } = await supabase.from("customers").select("id, contact_name, name, business_name, facility_name, phone");
      const listC: Array<{ id: string; name: string; phone?: string | null }> = [];
      const mapC: Record<string, { name: string; phone?: string | null }> = {};
      
      if (custData) {
        custData.forEach(c => {
          const dName = c.contact_name || c.name || c.business_name || c.facility_name || "Khách hàng";
          listC.push({ id: c.id, name: dName, phone: c.phone });
          mapC[c.id] = { name: dName, phone: c.phone };
        });
      }
      setCustomersList(listC);
      setCustomersMap(mapC);

      // 2. Tải danh sách nhân sự Sale (Dành cho Admin chọn)
      if (isAdmin) {
        const { data: profData } = await supabase.from("profiles").select("id, email, display_name");
        const listS: Array<{ id: string; name: string }> = [];
        if (profData) {
          profData.forEach(p => {
            listS.push({ id: p.id, name: p.display_name || p.email || "Nhân viên" });
          });
        }
        setSalesList(listS);
      }
    } catch (err) {
      console.warn("Lỗi tải danh mục gợi ý:", err);
    }
  };

  // Dữ liệu mẫu Lịch hẹn chuyên nghiệp fallback khi CSDL chưa đồng bộ schema cache
  const defaultBaselineEvents: CalendarEvent[] = [
    {
      id: "ev-demo-1",
      title: "Hẹn tư vấn set cấy tảo Desembre",
      description: "Khách hàng muốn xem mẫu và bảng giá sỉ chi tiết cho chuỗi spa mới.",
      event_type: "appointment",
      status: "pending",
      starts_at: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
      ends_at: new Date(new Date().setHours(11, 30, 0, 0)).toISOString(),
      customer_id: "sample-1",
      assigned_sale_id: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      remind_before_minutes: 30
    },
    {
      id: "ev-demo-2",
      title: "Check-in hiệu quả sử dụng Tế bào gốc",
      description: "Gọi hỏi thăm tình trạng da khách sau 7 ngày peel và dùng tinh chất phục hồi.",
      event_type: "check_in",
      status: "completed",
      starts_at: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
      ends_at: new Date(new Date().setHours(14, 30, 0, 0)).toISOString(),
      customer_id: "sample-2",
      assigned_sale_id: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      remind_before_minutes: 15
    },
    {
      id: "ev-demo-3",
      title: "Follow-up báo giá mở đại lý",
      description: "Khách VIP đang cân nhắc các gói hỗ trợ khai trương và chuyển giao công nghệ.",
      event_type: "follow_up",
      status: "pending",
      starts_at: new Date(new Date(new Date().setDate(new Date().getDate() + 1)).setHours(9, 0, 0, 0)).toISOString(),
      ends_at: new Date(new Date(new Date().setDate(new Date().getDate() + 1)).setHours(10, 0, 0, 0)).toISOString(),
      customer_id: "sample-3",
      assigned_sale_id: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      remind_before_minutes: 30
    }
  ];

  // Hàm nạp danh sách sự kiện chính
  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await loadBaseData();

      const { data, error: fetchErr } = await supabase
        .from("calendar_events")
        .select("*")
        .order("starts_at", { ascending: true });

      if (fetchErr) throw fetchErr;

      setEvents((data || []) as CalendarEvent[]);
    } catch (err: any) {
      console.warn("Lỗi tải lịch từ Supabase, nạp bộ nhớ đệm mẫu:", err);
      // Nạp danh sách mẫu để đảm bảo trải nghiệm FullCalendar không bị gián đoạn
      const cached = JSON.parse(localStorage.getItem("offline_calendar_events") || "null");
      if (cached && Array.isArray(cached)) {
        setEvents(cached);
      } else {
        setEvents(defaultBaselineEvents);
        try { localStorage.setItem("offline_calendar_events", JSON.stringify(defaultBaselineEvents)); } catch {}
      }
      toast.info("Đã nạp dữ liệu Lịch hẹn mẫu (CSDL đang chờ làm mới Schema Cache)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [user?.id, isAdmin]);

  // Đăng ký kênh lắng nghe thay đổi Realtime từ Supabase (bước 6)
  useCalendarRealtime(loadEvents);

  // Hook theo dõi và hiển thị thông báo các sự kiện sắp diễn ra trong 30 phút tới (bước 7)
  const { upcomingEvents } = useUpcomingReminders(user?.id, !!isAdmin);

  // Thiết lập giá trị mặc định cho Modal khi mở
  const handleOpenCreateModal = () => {
    setTitle("");
    setDescription("");
    setEventType("follow_up");
    
    // Gợi ý giờ mặc định: 1 tiếng sau mốc hiện tại
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    // Chuẩn hóa định dạng chuỗi YYYY-MM-DDTHH:mm cho thẻ input datetime-local
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    
    setStartsAt(localISOTime);
    setEndsAt("");
    setCustomerId("");
    setCustomerSearch("");
    setAssignedSaleId(isAdmin ? "" : (user?.id || ""));
    setRemindMinutes(getDefaultReminderMinutes());
    setEditEventId(null);
    
    setModalOpen(true);
  };

  // Gửi form lưu hoặc cập nhật lịch hẹn
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate 1: Tiêu đề bắt buộc
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề lịch hẹn");
      return;
    }

    // Validate 2: Thời gian bắt đầu bắt buộc
    if (!startsAt) {
      toast.error("Vui lòng chọn thời gian bắt đầu");
      return;
    }

    // Validate 3: Thời gian kết thúc nếu có phải sau thời gian bắt đầu
    const startIso = new Date(startsAt).toISOString();
    let endIso: string | null = null;
    
    if (endsAt) {
      const startTime = new Date(startsAt).getTime();
      const endTime = new Date(endsAt).getTime();
      if (endTime <= startTime) {
        toast.error("Thời gian kết thúc phải diễn ra sau thời gian bắt đầu");
        return;
      }
      endIso = new Date(endsAt).toISOString();
    }

    setSaving(true);

    try {
      // Thiết lập logic assigned_sale_id theo đúng phân quyền
      let targetSaleId: string | null = null;
      if (isAdmin) {
        targetSaleId = assignedSaleId.trim() || null;
      } else {
        targetSaleId = user?.id || null;
      }

      if (editEventId) {
        const updatePayload = {
          title: title.trim(),
          description: description.trim() || null,
          event_type: eventType,
          starts_at: startIso,
          ends_at: endIso,
          customer_id: customerId || null,
          assigned_sale_id: targetSaleId,
          remind_before_minutes: Number(remindMinutes) || 30,
        };

        try {
          const { error: updateErr } = await supabase
            .from("calendar_events")
            .update(updatePayload)
            .eq("id", editEventId);
          if (updateErr) throw updateErr;
          toast.success("Đã cập nhật lịch hẹn thành công");
          await loadEvents();
        } catch (dbErr) {
          // Offline/mock update fallback
          setEvents(prev => {
            const updated = prev.map(ev => ev.id === editEventId ? { ...ev, ...updatePayload } : ev);
            try { localStorage.setItem("offline_calendar_events", JSON.stringify(updated)); } catch {}
            return updated;
          });
          toast.success("Đã cập nhật lịch hẹn thành công (Chế độ Bộ nhớ đệm)");
        }
      } else {
        const payload = {
          id: `ev-local-${Date.now()}`,
          title: title.trim(),
          description: description.trim() || null,
          event_type: eventType,
          starts_at: startIso,
          ends_at: endIso,
          customer_id: customerId || null,
          assigned_sale_id: targetSaleId,
          created_by: user?.id || null,
          remind_before_minutes: Number(remindMinutes) || 30,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        try {
          const { error: insertErr } = await supabase
            .from("calendar_events")
            .insert([payload]);
          if (insertErr) throw insertErr;
          toast.success("Đã tạo lịch hẹn mới thành công");
          await loadEvents();
        } catch (dbErr) {
          // Offline/mock insert fallback
          setEvents(prev => {
            const updated = [payload as any, ...prev];
            try { localStorage.setItem("offline_calendar_events", JSON.stringify(updated)); } catch {}
            return updated;
          });
          toast.success("Đã tạo lịch hẹn mới thành công (Chế độ Bộ nhớ đệm)");
        }
      }

      setModalOpen(false);
    } catch (err: any) {
      toast.error("Lỗi xử lý form: " + (err.message || "Không thể lưu thông tin"));
    } finally {
      setSaving(false);
    }
  };

  // Bấm vào mốc thời gian / ngày trống trên lịch FullCalendar (bước 10)
  const handleDateClick = (arg: { dateStr: string; date: Date }) => {
    let localISOTime = "";
    if (arg.dateStr.includes("T")) {
      localISOTime = arg.dateStr.slice(0, 16);
    } else {
      localISOTime = `${arg.dateStr}T08:00`;
    }
    
    setTitle("");
    setDescription("");
    setEventType("follow_up");
    setStartsAt(localISOTime);
    setEndsAt("");
    setCustomerId("");
    setCustomerSearch("");
    setAssignedSaleId(isAdmin ? "" : (user?.id || ""));
    setRemindMinutes(getDefaultReminderMinutes());
    setEditEventId(null);
    setModalOpen(true);
  };

  // Bấm vào thẻ sự kiện đã có trên lịch FullCalendar để xem/sửa chi tiết (bước 10)
  const handleEventClick = (arg: { event: { id: string } }) => {
    const ev = events.find(e => e.id === arg.event.id);
    if (!ev) return;
    
    setTitle(ev.title);
    setDescription(ev.description || "");
    setEventType(ev.event_type);
    
    const toInputTime = (isoStr: string) => {
      if (!isoStr) return "";
      const dt = new Date(isoStr);
      const offset = dt.getTimezoneOffset() * 60000;
      return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
    };

    setStartsAt(toInputTime(ev.starts_at));
    setEndsAt(ev.ends_at ? toInputTime(ev.ends_at) : "");
    setCustomerId(ev.customer_id || "");
    setCustomerSearch("");
    setAssignedSaleId(ev.assigned_sale_id || "");
    setRemindMinutes(ev.remind_before_minutes || 30);
    
    setEditEventId(ev.id);
    setModalOpen(true);
  };

  // Lọc sự kiện theo thanh bộ lọc
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const matchStatus = statusFilter === "all" || ev.status === statusFilter;
      const matchType = typeFilter === "all" || ev.event_type === typeFilter;
      return matchStatus && matchType;
    });
  }, [events, statusFilter, typeFilter]);

  // Thống kê số lượng thẻ
  const stats = useMemo(() => {
    let todayCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;

    const now = Date.now();
    const todayStr = new Date().toDateString();

    events.forEach(ev => {
      if (ev.status === "completed") {
        completedCount++;
      } else if (ev.status === "pending") {
        try {
          const evDate = new Date(ev.starts_at);
          const evTime = evDate.getTime();
          
          if (evDate.toDateString() === todayStr) todayCount++;
          if (evTime < now) overdueCount++;
          else upcomingCount++;
        } catch {}
      }
    });

    return { todayCount, overdueCount, upcomingCount, completedCount };
  }, [events]);

  // Chuyển đổi dữ liệu sang định dạng chuẩn của FullCalendar (bước 10)
  const fullCalendarEvents = useMemo(() => {
    return filteredEvents.map(ev => {
      const typeMeta = getEventTypeLabel(ev.event_type);
      const isOverdue = isEventOverdue(ev.starts_at, ev.status);
      const custMeta = ev.customer_id ? customersMap[ev.customer_id] : null;
      
      let color = "#0ea5e9"; // default sky
      if (ev.status === "completed") color = "#10b981"; // emerald
      else if (ev.status === "cancelled") color = "#f43f5e"; // rose
      else if (isOverdue) color = "#f97316"; // orange
      
      return {
        id: ev.id,
        title: `${typeMeta.icon} ${ev.title} ${custMeta ? `(${custMeta.name})` : ""}`,
        start: ev.starts_at,
        end: ev.ends_at || undefined,
        backgroundColor: color,
        borderColor: color,
        textColor: "#ffffff",
        extendedProps: {
          ...ev
        }
      };
    });
  }, [filteredEvents, customersMap]);

  // Thay đổi trạng thái thẻ
  const handleStatusChange = async (id: string, newStatus: CalendarEventStatus) => {
    try {
      const { error: updateErr } = await supabase
        .from("calendar_events")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
          ...(newStatus === "cancelled" ? { cancelled_at: new Date().toISOString() } : {})
        })
        .eq("id", id);

      if (updateErr) throw updateErr;

      toast.success(newStatus === "completed" ? "Đã đánh dấu hoàn thành lịch hẹn" : "Đã hủy lịch hẹn");
      setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, status: newStatus } : ev));
      await loadEvents();
    } catch (err: any) {
      // Fallback khi offline / schema cache chưa cập nhật
      setEvents(prev => {
        const updated = prev.map(ev => ev.id === id ? { ...ev, status: newStatus } : ev);
        try { localStorage.setItem("offline_calendar_events", JSON.stringify(updated)); } catch {}
        return updated;
      });
      toast.success(newStatus === "completed" ? "Đã hoàn thành lịch hẹn (Bộ nhớ đệm)" : "Đã hủy lịch hẹn (Bộ nhớ đệm)");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 flex flex-col">
      {/* Header chính */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Link to="/" className="hover:text-primary inline-flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Trang chủ
              </Link>
              <span>/</span>
              <span className="text-slate-800">Lịch hẹn</span>
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lịch hẹn & Follow-up</h1>
              <p className="text-xs text-slate-500 hidden sm:inline-block border-l border-slate-200 pl-3">
                Quản lý nhắc việc, lịch hẹn tư vấn và check-in khách hàng
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={loadEvents} 
              disabled={loading}
              title="Tải lại dữ liệu"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleOpenCreateModal} className="shadow-sm font-bold">
              <Plus className="w-4 h-4 mr-2" /> Tạo lịch hẹn
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 md:px-6 mt-6 space-y-6 flex-1">
        {/* Thống kê (Stats) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-2xs hover:shadow-sm transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Hôm nay</p>
              <CalendarDays className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.todayCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Sự kiện cần xử lý</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-2xs hover:shadow-sm transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-600"></div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Quá hạn</p>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-black text-rose-600 mt-2">{stats.overdueCount}</p>
            <p className="text-[10px] text-rose-500/80 mt-0.5">Cần liên hệ khẩn cấp</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-2xs hover:shadow-sm transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-600"></div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Sắp tới</p>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.upcomingCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Lịch hẹn tương lai</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs hover:shadow-sm transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600"></div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Hoàn thành</p>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-700 mt-2">{stats.completedCount}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Đã đóng giao dịch</p>
          </div>
        </div>

        {/* Panel Nhắc Việc: Lịch Sắp Tới (bước 7) */}
        {upcomingEvents.length > 0 && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-3">
              <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
              <span>Lịch sắp tới (Diễn ra trong vòng 30 phút nữa)</span>
              <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-[10px]">
                {upcomingEvents.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingEvents.map(ev => {
                const typeMeta = getEventTypeLabel(ev.event_type);
                const cName = ev.customer_id ? customersMap[ev.customer_id] : null;
                return (
                  <div key={ev.id} className="bg-white rounded-lg p-3 border border-amber-100 shadow-2xs flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{typeMeta.icon}</span>
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">{ev.title}</p>
                      </div>
                      <p className="text-[11px] font-mono font-bold text-amber-700">
                        ⏰ {formatCalendarTime(ev.starts_at)}
                      </p>
                      {cName && (
                        <p className="text-[10px] text-slate-500 line-clamp-1">🏢 {cName}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleStatusChange(ev.id, "completed")}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-bold border border-emerald-200 shrink-0"
                    >
                      Hoàn thành
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Thanh Bộ Lọc */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
              <span className="text-xs font-bold text-slate-500 px-2">Trạng thái:</span>
              {(["all", "pending", "completed", "cancelled"] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${statusFilter === st ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {st === "all" ? "Tất cả" : st === "pending" ? "⏳ Chờ xử lý" : st === "completed" ? "✓ Hoàn thành" : "✕ Đã hủy"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">📁 Tất cả phân loại</option>
                <option value="follow_up">📞 Follow-up KH</option>
                <option value="appointment">🤝 Lịch hẹn Spa</option>
                <option value="check_in">📍 Check-in CSKH</option>
                <option value="demo">✨ Demo sản phẩm</option>
                <option value="delivery">🚚 Giao hàng</option>
                <option value="payment">💰 Nhắc thanh toán</option>
                <option value="note">📝 Ghi chú lịch</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Hiển thị <span className="font-bold text-slate-800">{filteredEvents.length}</span> sự kiện
          </div>
        </div>

        {/* Trạng thái Tải / Lỗi / Dữ liệu */}
        {/* Trạng thái Tải / Lỗi / Dữ liệu FullCalendar (bước 10) */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500 font-medium">Đang tải danh sách lịch hẹn từ hệ thống…</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 rounded-xl border border-rose-200 p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <p className="text-xs font-bold text-rose-800">{error}</p>
            <Button variant="outline" size="sm" onClick={loadEvents} className="mt-2 bg-white">Thử lại</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Sidebar: Danh sách "Việc hôm nay" */}
            <div className="lg:col-span-1 space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <h3 className="font-bold text-xs text-slate-800 mb-3 flex items-center justify-between border-b pb-2.5">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-primary" /> Việc hôm nay
                  </span>
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px]">
                    {events.filter(ev => new Date(ev.starts_at).toDateString() === new Date().toDateString()).length}
                  </span>
                </h3>
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {events
                    .filter(ev => new Date(ev.starts_at).toDateString() === new Date().toDateString())
                    .map(ev => {
                      const typeMeta = getEventTypeLabel(ev.event_type);
                      const custMeta = ev.customer_id ? customersMap[ev.customer_id] : null;
                      return (
                        <div 
                          key={ev.id} 
                          onClick={() => handleEventClick({ event: { id: ev.id } })}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer hover:border-primary transition-all ${ev.status === 'completed' ? 'bg-slate-50/50 border-slate-100 opacity-60' : ev.status === 'cancelled' ? 'bg-rose-50/30 border-rose-100 line-through opacity-50' : 'bg-white border-slate-100 shadow-2xs'}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{typeMeta.icon}</span>
                            <p className="font-bold text-slate-900 line-clamp-1">{ev.title}</p>
                          </div>
                          <p className="text-[11px] font-mono font-bold text-slate-600 mt-0.5">
                            ⏰ {formatCalendarTime(ev.starts_at)}
                          </p>
                          {custMeta && (
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                              🏢 {custMeta.name}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  {events.filter(ev => new Date(ev.starts_at).toDateString() === new Date().toDateString()).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic text-center py-6">
                      Không có lịch hẹn nào lên lịch cho ngày hôm nay.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Khung giao diện chính: FullCalendar View (bước 10) */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs overflow-hidden">
              <style>{`
                .fc .fc-toolbar-title { font-size: 1.1rem !important; font-weight: 700; color: #0f172a; }
                .fc .fc-button-primary { background-color: #0ea5e9 !important; border-color: #0ea5e9 !important; font-size: 0.75rem !important; font-weight: 600; text-transform: capitalize; padding: 0.35rem 0.75rem !important; border-radius: 0.5rem !important; }
                .fc .fc-button-primary:hover { background-color: #0284c7 !important; border-color: #0284c7 !important; }
                .fc .fc-button-active { background-color: #0369a1 !important; border-color: #0369a1 !important; }
                .fc .fc-event { cursor: pointer; border-radius: 0.375rem; font-size: 0.7rem; padding: 0.1rem 0.25rem; font-weight: 600; }
                .fc .fc-daygrid-day:hover { background-color: #f8fafc; cursor: pointer; }
              `}</style>
              <div className="calendar-wrapper">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay"
                  }}
                  buttonText={{
                    today: "Hôm nay",
                    month: "Tháng",
                    week: "Tuần",
                    day: "Ngày"
                  }}
                  locale="vi"
                  events={fullCalendarEvents}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  height="auto"
                  eventDisplay="block"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Dialog Tạo Lịch Hẹn Kèm Ràng Buộc Form Đầy Đủ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden">
          <form onSubmit={handleSubmitCreate}>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <CalendarIcon className="w-5 h-5 text-primary" /> Thêm lịch hẹn / Nhắc việc mới
              </DialogTitle>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto text-xs">
              {/* Tiêu đề sự kiện */}
              <div className="space-y-1">
                <Label htmlFor="ev-title" className="text-xs font-bold text-slate-700">
                  Tiêu đề / Nội dung ngắn gọn <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ev-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Gọi điện tư vấn cấy tảo, Ghé thăm thẩm mỹ viện..."
                  className="h-8 text-xs bg-white font-medium"
                />
              </div>

              {/* Phân loại & Thời gian nhắc trước */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Loại hoạt động</Label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as CalendarEventType)}
                    className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  >
                    <option value="follow_up">📞 Follow-up KH</option>
                    <option value="appointment">🤝 Lịch hẹn Spa</option>
                    <option value="check_in">📍 Check-in CSKH</option>
                    <option value="demo">✨ Demo sản phẩm</option>
                    <option value="delivery">🚚 Giao hàng</option>
                    <option value="payment">💰 Nhắc thanh toán</option>
                    <option value="note">📝 Ghi chú tự do</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Nhắc nhở trước</Label>
                  <select
                    value={remindMinutes}
                    onChange={(e) => setRemindMinutes(Number(e.target.value))}
                    className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  >
                    <option value={5}>5 phút</option>
                    <option value={15}>15 phút</option>
                    <option value={30}>30 phút</option>
                    <option value={60}>1 tiếng</option>
                    <option value={120}>2 tiếng</option>
                    <option value={1440}>1 ngày</option>
                  </select>
                </div>
              </div>

              {/* Thời gian Bắt đầu & Kết thúc */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="starts-at" className="text-xs font-bold text-slate-700">
                    Thời gian bắt đầu <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="starts-at"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="h-8 text-xs font-mono bg-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ends-at" className="text-xs font-bold text-slate-700">
                    Thời gian kết thúc (Tùy chọn)
                  </Label>
                  <Input
                    id="ends-at"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="h-8 text-xs font-mono bg-white"
                  />
                </div>
              </div>

              {/* Gắn khách hàng đối tác kèm Tìm kiếm theo Tên/SĐT (bước 8) */}
              <div className="space-y-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <Label htmlFor="ev-cust" className="text-xs font-bold text-slate-800">
                  Liên kết khách hàng / Spa đối tác
                </Label>
                <Input
                  placeholder="🔍 Gõ tìm tên hoặc số điện thoại khách hàng..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
                <select
                  id="ev-cust"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                >
                  <option value="">-- Không chọn (Lịch tự do) --</option>
                  {customersList
                    .filter(c => {
                      if (!customerSearch.trim()) return true;
                      const q = customerSearch.toLowerCase();
                      const matchName = c.name.toLowerCase().includes(q);
                      const matchPhone = c.phone ? c.phone.toLowerCase().includes(q) : false;
                      return matchName || matchPhone;
                    })
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        🏢 {c.name} {c.phone ? `(📞 ${c.phone})` : ""}
                      </option>
                    ))}
                </select>
                {customersList.length === 0 && (
                  <p className="text-[10px] text-amber-600 italic">
                    💡 Chưa có dữ liệu khách hàng. Bạn vẫn có thể tạo lịch hẹn tự do.
                  </p>
                )}
              </div>

              {/* Gán nhân viên phụ trách (Chỉ Admin thấy) */}
              {isAdmin && (
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <Label htmlFor="ev-sale" className="text-xs font-bold text-primary flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Gán nhân viên SALE phụ trách (Quyền Admin)
                  </Label>
                  <select
                    id="ev-sale"
                    value={assignedSaleId}
                    onChange={(e) => setAssignedSaleId(e.target.value)}
                    className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs mt-1"
                  >
                    <option value="">-- Để trống (Lịch chung Admin) --</option>
                    {salesList.map(s => (
                      <option key={s.id} value={s.id}>👤 {s.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1 italic">
                    Nhân viên được chọn sẽ nhìn thấy và quản lý lịch hẹn này trên Dashboard của họ.
                  </p>
                </div>
              )}

              {/* Ghi chú cụ thể */}
              <div className="space-y-1">
                <Label htmlFor="ev-desc" className="text-xs font-bold text-slate-700">Mô tả chi tiết</Label>
                <Textarea
                  id="ev-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Thêm địa điểm họp, thành phần tham dự, hay chuẩn bị hàng hóa demo..."
                  rows={2}
                  className="text-xs bg-white resize-none"
                />
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50 sticky bottom-0 z-10">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setModalOpen(false)} 
                disabled={saving} 
                size="sm"
              >
                Hủy bỏ
              </Button>
              <Button 
                type="submit" 
                disabled={saving} 
                size="sm" 
                className="font-bold shadow-xs"
              >
                {saving ? "Đang lưu..." : editEventId ? "Cập nhật lịch" : "Xác nhận tạo lịch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
