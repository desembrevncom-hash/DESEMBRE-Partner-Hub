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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Bell,
  Target,
  ExternalLink,
  MapPin,
  Megaphone,
  TrendingUp,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import type { 
  PersonalEvent, 
  CompanyEvent, 
  EventRegistration, 
  UnifiedCalendarEvent,
  CalendarEventStatus,
  PersonalEventType,
  CompanyEventType,
  RegistrationStatus
} from "@/types/calendar";
import { 
  formatCalendarTime, 
  getDefaultReminderMinutes, 
  getEventStatusLabel, 
  getPersonalEventTypeLabel,
  getCompanyEventTypeLabel,
  getAttendeeStatusMeta,
  getCampaignStatusLabel,
  isEventOverdue 
} from "@/lib/calendar";
import { buildGoogleCalendarLink } from "@/lib/googleCalendar";

const formatGCalDescription = (custName: string, custPhone?: string | null, descText?: string | null) => {
  return descText && descText.trim() 
    ? descText.trim() 
    : "Chương trình đào tạo và chuyển giao phác đồ chuyên sâu từ hệ thống DESEMBRE Partner Hub. Quý khách vui lòng tham dự đúng giờ để công tác đón tiếp được chu đáo nhất.";
};
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
  const { user, isAdmin, isSubAdmin, isManager } = useAuth();
  
  // Dữ liệu danh sách
  const [events, setEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [customersList, setCustomersList] = useState<Array<{ id: string; name: string; phone?: string | null; email?: string | null }>>([]);
  const [salesList, setSalesList] = useState<Array<{ id: string; name: string }>>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, { name: string; phone?: string | null; email?: string | null }>>({});
  const [customerSearch, setCustomerSearch] = useState("");
  
  // Trạng thái chung
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  // State Modal Form Tạo Lịch Hẹn
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editEventType, setEditEventType] = useState<'personal' | 'company'>('personal');
  const [isSyncingGCal, setIsSyncingGCal] = useState(false);
  
  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [personalType, setPersonalType] = useState<PersonalEventType>("follow_up");
  const [companyType, setCompanyType] = useState<CompanyEventType>("workshop");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [assignedSaleId, setAssignedSaleId] = useState("");
  const [remindMinutes, setRemindMinutes] = useState(getDefaultReminderMinutes());
  
  // Fields cho Company Event
  const [modalRegistrations, setModalRegistrations] = useState<EventRegistration[]>([]);
  const [attendeeSelectId, setAttendeeSelectId] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [eventCapacity, setEventCapacity] = useState<number | "">("");
  const [regDeadline, setRegDeadline] = useState("");
  const [campaignStatus, setCampaignStatus] = useState<"draft" | "published" | "closed" | "completed" | "cancelled">("draft");
  
  // Quick Add Attendee fields
  const [newAttendeeNote, setNewAttendeeNote] = useState("");
  const [newAttendeeStatus, setNewAttendeeStatus] = useState<RegistrationStatus>("registered");
  const [isQuickAddCustomer, setIsQuickAddCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickCustomerEmail, setQuickCustomerEmail] = useState("");

  // States cho tính năng Tự động Follow-up sau sự kiện
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [pendingFollowUpReg, setPendingFollowUpReg] = useState<EventRegistration | null>(null);

  const [modalTab, setModalTab] = useState<"personal" | "company">("personal");

  // Hàm nạp danh sách dữ liệu nền tảng
  const loadBaseData = async () => {
    try {
      // 1. Tải danh sách khách hàng kèm số điện thoại và email
      const { data: custData } = await supabase.from("customers").select("id, contact_name, name, business_name, facility_name, phone, email");
      const listC: Array<{ id: string; name: string; phone?: string | null; email?: string | null }> = [];
      const mapC: Record<string, { name: string; phone?: string | null; email?: string | null }> = {};
      
      if (custData) {
        custData.forEach((c: any) => {
          const dName = c.contact_name || c.name || c.business_name || c.facility_name || "Khách hàng";
          listC.push({ id: c.id, name: dName, phone: c.phone, email: c.email });
          mapC[c.id] = { name: dName, phone: c.phone, email: c.email };
        });
      }
      setCustomersList(listC as any);
      setCustomersMap(mapC);

      // 2. Tải danh sách nhân sự Sale (Dành cho Quản lý chọn)
      if (isManager) {
        const { data: profData } = await supabase.from("profiles").select("id, email, display_name");
        const listS: Array<{ id: string; name: string }> = [];
        if (profData) {
          profData.forEach((p: any) => {
            listS.push({ id: p.id, name: p.display_name || p.email || "Nhân viên" });
          });
        }
        setSalesList(listS);
      }
    } catch (err) {
      console.warn("Lỗi tải danh mục gợi ý:", err);
    }
  };

  // Hàm nạp danh sách sự kiện chính từ nhiều bảng
  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await loadBaseData();

      // 1. Tải Lịch cá nhân
      const { data: pData, error: pErr } = await supabase
        .from("calendar_events")
        .select("*")
        .order("starts_at", { ascending: true });
      if (pErr) throw pErr;

      // 2. Tải Sự kiện Công ty
      const { data: cData, error: cErr } = await supabase
        .from("company_events")
        .select("*")
        .order("starts_at", { ascending: true });
      if (cErr) throw cErr;

      // 3. Tải danh sách đăng ký
      const { data: rData, error: rErr } = await supabase
        .from("event_registrations")
        .select("*");
      if (rErr) throw rErr;

      // Gộp và chuẩn hóa dữ liệu
      const personalEvents: UnifiedCalendarEvent[] = (pData || []).map((ev: any) => ({ ...ev, _ui_type: 'personal' }));
      const companyEvents: UnifiedCalendarEvent[] = (cData || []).map((ev: any) => {
        const registrations = (rData || []).filter((r: any) => r.event_id === ev.id);
        return { ...ev, _ui_type: 'company', registrations };
      });

      const combined = [...personalEvents, ...companyEvents];
      setEvents(combined);
      
      // Cache lại cho offline mode
      try { localStorage.setItem("offline_calendar_events_v3", JSON.stringify(combined)); } catch {}
      
    } catch (err: any) {
      console.warn("Lỗi tải lịch từ Supabase (Có thể do chưa chạy SQL Migration):", err);
      
      // Tạo dữ liệu Fallback mẫu để đảm bảo giao diện luôn hiển thị trực quan
      const now = new Date();
      const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
      
      const samplePersonal: UnifiedCalendarEvent[] = [
        {
          id: "mock-pers-1",
          title: "Gọi tư vấn chị Lan Anh",
          description: "Khách quan tâm bộ sản phẩm trị nám chuyên sâu Desembre",
          event_type: "follow_up",
          status: "pending",
          starts_at: `${currentMonthStr}-15T09:30:00`,
          remind_before_minutes: 30,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          customer_name: "Chị Lan Anh",
          _ui_type: "personal"
        },
        {
          id: "mock-pers-2",
          title: "Giao hàng Spa Minh Tuấn",
          description: "Giao set tinh chất cô đặc Ampoule",
          event_type: "delivery",
          status: "completed",
          starts_at: `${currentMonthStr}-10T14:00:00`,
          remind_before_minutes: 60,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          customer_name: "Anh Minh Tuấn",
          _ui_type: "personal"
        }
      ];

      const sampleCompany: UnifiedCalendarEvent[] = [
        {
          id: "mock-comp-1",
          title: "Workshop: Kỹ thuật Trị liệu Chuyên sâu 2026",
          description: "Cập nhật phác đồ điều trị mới nhất dành cho hệ thống đại lý và đối tác Spa chiến lược.",
          event_type: "workshop",
          status: "published",
          starts_at: `${currentMonthStr}-20T08:30:00`,
          ends_at: `${currentMonthStr}-20T12:00:00`,
          location: "Hội trường Grand Palace, Hà Nội",
          capacity: 50,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          _ui_type: "company",
          registrations: [
            {
              id: "reg-1",
              event_id: "mock-comp-1",
              customer_name: "Chị Mai Hương (Hương Spa)",
              customer_phone: "0911223344",
              status: "registered",
              created_at: now.toISOString(),
              updated_at: now.toISOString()
            },
            {
              id: "reg-2",
              event_id: "mock-comp-1",
              customer_name: "Anh Tuấn Đạt (Đạt Clinic)",
              customer_phone: "0988776655",
              status: "attended",
              created_at: now.toISOString(),
              updated_at: now.toISOString()
            },
            {
              id: "reg-3",
              event_id: "mock-comp-1",
              customer_name: "Chị Bích Ngọc (Ngọc Beauty)",
              customer_phone: "0900112233",
              status: "converted",
              created_at: now.toISOString(),
              updated_at: now.toISOString()
            }
          ]
        }
      ];

      const fallbackData = [...samplePersonal, ...sampleCompany];
      
      const cached = JSON.parse(localStorage.getItem("offline_calendar_events_v3") || "null");
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setEvents(cached);
      } else {
        setEvents(fallbackData);
      }
      
      toast.error("CSDL chưa chạy Migration bảng sự kiện. Đã tự động hiển thị dữ liệu mô phỏng cao cấp.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [user?.id, isManager]);

  // Đăng ký kênh lắng nghe thay đổi Realtime
  useCalendarRealtime(loadEvents);

  // Hook theo dõi và hiển thị thông báo các sự kiện sắp diễn ra
  const { upcomingEvents } = useUpcomingReminders(user?.id, !!isManager);

  // Thiết lập giá trị mặc định cho Modal khi mở
  const handleOpenCreateModal = (forcedTab?: "personal" | "company") => {
    setTitle("");
    setDescription("");
    setPersonalType("follow_up");
    setCompanyType("workshop");
    
    const targetTab = forcedTab || modalTab;
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const baseDateStr = new Date(now.getTime() - offset).toISOString().slice(0, 10);
    
    if (targetTab === "company") {
      setStartsAt(`${baseDateStr}T08:30`);
      setEndsAt(`${baseDateStr}T12:00`);
      setRegDeadline(`${baseDateStr}T12:00`);
    } else {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
      const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
      setStartsAt(localISOTime);
      setEndsAt("");
      setRegDeadline("");
    }
    
    setCustomerId("");
    setCustomerSearch("");
    setAssignedSaleId(isManager ? "" : (user?.id || ""));
    setRemindMinutes(getDefaultReminderMinutes());
    setEditEventId(null);
    setModalRegistrations([]);
    setAttendeeSelectId("");
    setEventLocation("");
    setEventCapacity("");
    setCampaignStatus("published");
    setNewAttendeeNote("");
    setIsQuickAddCustomer(false);
    setQuickCustomerName("");
    setQuickCustomerPhone("");
    setQuickCustomerEmail("");
    
    if (forcedTab) {
      setModalTab(forcedTab);
    }
    setModalOpen(true);
  };

  // Hàm kích hoạt Đồng bộ thủ công Chiến dịch Công ty lên Google Calendar
  const handleTriggerGCalSync = async () => {
    if (!editEventId) return;
    setIsSyncingGCal(true);
    try {
      const res = await supabase.functions.invoke("sync-company-event-to-google", {
        body: { companyEventId: editEventId }
      });
      if (res.error) throw res.error;
      toast.success("Đã đồng bộ Google Calendar");
      await loadEvents();
    } catch (err: any) {
      toast.error("Lỗi đồng bộ: " + (err.message || JSON.stringify(err)));
    } finally {
      setIsSyncingGCal(false);
    }
  };

  // Gửi form lưu hoặc cập nhật lịch hẹn
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề lịch hẹn");
      return;
    }

    if (!startsAt) {
      toast.error("Vui lòng chọn thời gian bắt đầu");
      return;
    }

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
      let targetSaleId: string | null = null;
      if (isManager) {
        targetSaleId = assignedSaleId.trim() || null;
      } else {
        targetSaleId = user?.id || null;
      }

      const isCompanyMode = modalTab === "company";
      
      if (editEventId) {
        if (editEventType === 'company') {
          const payload = {
            title: title.trim(),
            description: description.trim() || null,
            event_type: companyType,
            starts_at: startIso,
            ends_at: endIso,
            location: eventLocation.trim() || null,
            meeting_url: meetingUrl.trim() || null,
            capacity: Number(eventCapacity) || null,
            registration_deadline: regDeadline ? new Date(regDeadline).toISOString() : null,
            status: campaignStatus,
            updated_at: new Date().toISOString()
          };
          const { error: err } = await supabase.from("company_events").update(payload).eq("id", editEventId);
          if (err) throw err;
          toast.success("Cập nhật Chiến dịch thành công");

          // Tự động nạp Master Event lên Google Calendar ngay cho Admin nghiệm thu
          try {
            supabase.functions.invoke('send-gcal-invite', {
              body: {
                registration_id: editEventId || "master_update",
                event_title: title.trim(),
                starts_at: startsAt,
                ends_at: endsAt || startsAt,
                location: eventLocation.trim() || meetingUrl.trim() || "Hệ thống DESEMBRE",
                description: description.trim(),
                attendee_email: user?.email || "desembrevn.com@gmail.com",
                attendee_name: "Ban Quản Trị DESEMBRE"
              }
            }).then();
          } catch (_) {}
        } else {
          const payload = {
            title: title.trim(),
            description: description.trim() || null,
            event_type: personalType,
            starts_at: startIso,
            ends_at: endIso,
            customer_id: customerId || null,
            assigned_sale_id: targetSaleId,
            remind_before_minutes: Number(remindMinutes) || 30,
            updated_at: new Date().toISOString()
          };
          const { error: err } = await supabase.from("calendar_events").update(payload).eq("id", editEventId);
          if (err) throw err;
          toast.success("Cập nhật Lịch cá nhân thành công");
        }
      } else {
        // TẠO MỚI
        if (isCompanyMode && isManager) {
          const payload = {
            title: title.trim(),
            description: description.trim() || null,
            event_type: companyType,
            starts_at: startIso,
            ends_at: endIso,
            location: eventLocation.trim() || null,
            meeting_url: meetingUrl.trim() || null,
            capacity: Number(eventCapacity) || null,
            registration_deadline: regDeadline ? new Date(regDeadline).toISOString() : null,
            status: campaignStatus,
            created_by: user?.id || null,
          };
          const { data: newEv, error: err } = await supabase.from("company_events").insert([payload]).select().single();
          if (err) throw err;
          toast.success("Khởi tạo Chiến dịch mới thành công");

          // Tự động nạp Master Event lên Google Calendar ngay khi vừa tạo xong
          try {
            supabase.functions.invoke('send-gcal-invite', {
              body: {
                registration_id: newEv?.id || "master_init",
                event_title: title.trim(),
                starts_at: startsAt,
                ends_at: endsAt || startsAt,
                location: eventLocation.trim() || meetingUrl.trim() || "Hệ thống DESEMBRE",
                description: description.trim(),
                attendee_email: user?.email || "desembrevn.com@gmail.com",
                attendee_name: "Ban Quản Trị DESEMBRE"
              }
            }).then();
          } catch (_) {}
        } else {
          const payload = {
            title: title.trim(),
            description: description.trim() || null,
            event_type: personalType,
            starts_at: startIso,
            ends_at: endIso,
            customer_id: customerId || null,
            assigned_sale_id: targetSaleId,
            created_by: user?.id || null,
            remind_before_minutes: Number(remindMinutes) || 30,
            status: "pending",
          };
          const { error: err } = await supabase.from("calendar_events").insert([payload]);
          if (err) throw err;
          toast.success("Tạo Lịch làm việc mới thành công");
        }
      }

      await loadEvents();
      setModalOpen(false);
    } catch (err: any) {
      toast.error("Lỗi xử lý form: " + (err.message || "Không thể lưu thông tin"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (id: string, type: 'personal' | 'company') => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa lịch trình này?")) return;
    try {
      setSaving(true);
      const table = type === 'company' ? 'company_events' : 'calendar_events';
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Xóa lịch trình thành công");
      setModalOpen(false);
      loadEvents();
    } catch (err: any) {
      toast.error("Lỗi khi xóa: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDateClick = (arg: { dateStr: string; date: Date }) => {
    const isCompTab = isManager;
    const baseDateStr = arg.dateStr.slice(0, 10);
    
    setTitle("");
    setDescription("");
    setPersonalType("follow_up");
    setCompanyType("workshop");
    
    if (isCompTab) {
      setStartsAt(`${baseDateStr}T08:30`);
      setEndsAt(`${baseDateStr}T12:00`);
      setRegDeadline(`${baseDateStr}T12:00`);
    } else {
      let localISOTime = "";
      if (arg.dateStr.includes("T")) {
        localISOTime = arg.dateStr.slice(0, 16);
      } else {
        localISOTime = `${baseDateStr}T08:00`;
      }
      setStartsAt(localISOTime);
      setEndsAt("");
      setRegDeadline("");
    }
    
    setCustomerId("");
    setCustomerSearch("");
    setAssignedSaleId(isManager ? "" : (user?.id || ""));
    setRemindMinutes(getDefaultReminderMinutes());
    setEditEventId(null);
    setCampaignStatus("published");
    setModalTab(isCompTab ? "company" : "personal");
    setModalOpen(true);
  };

  const handleEventClick = (arg: { event: { id: string } }) => {
    const ev = events.find(e => e.id === arg.event.id);
    if (!ev) return;
    
    setTitle(ev.title);
    setDescription(ev.description || "");
    
    const toInputTime = (isoStr: string) => {
      if (!isoStr) return "";
      const dt = new Date(isoStr);
      const offset = dt.getTimezoneOffset() * 60000;
      return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
    };

    setStartsAt(toInputTime(ev.starts_at));
    setEndsAt(ev.ends_at ? toInputTime(ev.ends_at) : "");
    setEditEventType(ev._ui_type);
    setModalTab(ev._ui_type);

    if (ev._ui_type === 'company') {
      setCompanyType(ev.event_type);
      setEventLocation(ev.location || "");
      setMeetingUrl(ev.meeting_url || "");
      setEventCapacity(ev.capacity || "");
      setRegDeadline(ev.registration_deadline ? toInputTime(ev.registration_deadline) : "");
      setCampaignStatus(ev.status);
      setModalRegistrations(ev.registrations || []);
      
      setCustomerId("");
      setAssignedSaleId("");
    } else {
      setPersonalType(ev.event_type);
      setCustomerId(ev.customer_id || "");
      setAssignedSaleId(ev.assigned_sale_id || "");
      setRemindMinutes(ev.remind_before_minutes || 30);
      
      setEventLocation("");
      setMeetingUrl("");
      setEventCapacity("");
      setRegDeadline("");
      setModalRegistrations([]);
    }

    setEditEventId(ev.id);
    setCustomerSearch("");
    setAttendeeSelectId("");
    setNewAttendeeNote("");
    setIsQuickAddCustomer(false);
    setQuickCustomerName("");
    setQuickCustomerPhone("");
    setQuickCustomerEmail("");
    setModalOpen(true);
  };

  const handleAddAttendee = async () => {
    let finalCustomerId = attendeeSelectId;
    let finalCustomerName = quickCustomerName.trim();
    let finalCustomerPhone = quickCustomerPhone.trim();
    let finalCustomerEmail: string | null = null;

    if (!isQuickAddCustomer) {
      if (!finalCustomerId) {
        toast.error("Vui lòng chọn khách hàng");
        return;
      }
      const cMeta = customersMap[finalCustomerId];
      finalCustomerName = cMeta?.name || "Khách hàng";
      finalCustomerPhone = cMeta?.phone || "";
      finalCustomerEmail = cMeta?.email || null;
    } else {
      if (!finalCustomerName) {
        toast.error("Vui lòng nhập tên khách hàng mới");
        return;
      }
      finalCustomerEmail = quickCustomerEmail.trim() || null;
    }

    if (modalRegistrations.some(r => (r.customer_id && r.customer_id === finalCustomerId) || (r.customer_phone && r.customer_phone === finalCustomerPhone))) {
      toast.warning("Khách hàng này đã có trong danh sách đăng ký");
      return;
    }

    try {
      setSaving(true);
      
      const eventDatePart = endsAt ? endsAt.slice(0, 10) : startsAt.slice(0, 10);
      const startTimePart = startsAt.includes("T") ? startsAt.slice(11, 16) : "08:30";
      const endTimePart = endsAt && endsAt.includes("T") ? endsAt.slice(11, 16) : "12:00";

      const calLink = buildGoogleCalendarLink({
        title: title || "Sự kiện DESEMBRE Partner",
        startsAt: `${eventDatePart}T${startTimePart}`,
        endsAt: `${eventDatePart}T${endTimePart}`,
        location: eventLocation || meetingUrl || null,
        description: formatGCalDescription(finalCustomerName, finalCustomerPhone, description)
      });

      const newRegPayload = {
        event_id: editEventId,
        customer_id: isQuickAddCustomer ? null : finalCustomerId,
        customer_name: finalCustomerName,
        customer_phone: finalCustomerPhone,
        attendee_email: finalCustomerEmail,
        add_to_calendar_url: calLink || null,
        registered_by: user?.id,
        assigned_sale_id: user?.id,
        status: newAttendeeStatus,
        note: newAttendeeNote.trim() || null
      };

      if (editEventId) {
        const { data: insertedData, error: err } = await supabase
          .from("event_registrations")
          .insert([newRegPayload])
          .select()
          .single();
        if (err) throw err;
        
        if (insertedData) {
          const freshReg = {
            ...insertedData,
            added_by_sale_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || "SALE"
          };
          setModalRegistrations(prev => [freshReg as any, ...prev]);
        }
        
        toast.success("Đăng ký khách hàng thành công");
        await loadEvents();
      } else {
        toast.error("Vui lòng tạo và lưu Sự kiện trước khi thêm danh sách khách mời.");
      }

      setAttendeeSelectId("");
      setNewAttendeeNote("");
      setQuickCustomerName("");
      setQuickCustomerPhone("");
      setQuickCustomerEmail("");
      setIsQuickAddCustomer(false);
    } catch (err: any) {
      toast.error("Lỗi đăng ký: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAttendee = async (regId: string, assignedSaleId: string) => {
    if (!isManager && assignedSaleId !== user?.id) {
      toast.error("Bạn chỉ có quyền xóa khách do mình phụ trách");
      return;
    }

    try {
      const { error: err } = await supabase.from("event_registrations").delete().eq("id", regId);
      if (err) throw err;
      toast.success("Đã gỡ khách hàng khỏi danh sách");
      await loadEvents();
    } catch (err: any) {
      toast.error("Lỗi khi xóa: " + err.message);
    }
  };

  const handleCopyCalendarMessage = async (reg: EventRegistration) => {
    try {
      // Nghiệp vụ thực tế: startsAt là mốc mở form mời, endsAt là mốc ngày giờ tổ chức sự kiện thực tế.
      // Do đó toàn bộ thời gian sự kiện GCal và tin nhắn phải lấy theo mốc ngày kết thúc (endsAt).
      const targetDatePart = endsAt ? endsAt.slice(0, 10) : startsAt.slice(0, 10);
      const targetEndTimePart = endsAt && endsAt.includes("T") ? endsAt.slice(11, 16) : "21:00";
      const targetStartTimePart = startsAt.includes("T") ? startsAt.slice(11, 16) : "18:00";

      const computedTargetStart = `${targetDatePart}T${targetStartTimePart}`;
      const computedTargetEnd = `${targetDatePart}T${targetEndTimePart}`;

      let calUrl = buildGoogleCalendarLink({
        title: title || "Sự kiện DESEMBRE Partner",
        startsAt: computedTargetStart,
        endsAt: computedTargetEnd,
        location: eventLocation || meetingUrl || null,
        description: formatGCalDescription(reg.customer_name, reg.customer_phone, description)
      });

      if (reg.id && calUrl) {
        supabase.from("event_registrations").update({ add_to_calendar_url: calUrl }).eq("id", reg.id).then();
        setModalRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, add_to_calendar_url: calUrl } : r));
      }

      // Format chuỗi hiển thị đúng mốc cuối cùng của ngày kết thúc: "21h00 ngày 19/05/2026"
      const formattedTimeStr = targetEndTimePart.replace(":", "h");
      const partsD = targetDatePart.split("-");
      const fullDateStr = partsD.length === 3 ? `${partsD[2]}/${partsD[1]}/${partsD[0]}` : targetDatePart;

      const timeLine = `${formattedTimeStr} ngày ${fullDateStr}`;

      const locLine = eventLocation || meetingUrl || "Hệ thống DESEMBRE";

      const greeting = reg.customer_name 
        ? `Chị/Anh ${reg.customer_name} ơi, em gửi lịch sự kiện Desembre ạ.` 
        : `Chị/Anh ơi, em gửi lịch sự kiện Desembre ạ.`;

      const msg = `${greeting}\n\nTên sự kiện: ${title || "Sự kiện DESEMBRE Partner"}\nThời gian: ${timeLine}\nĐịa điểm: ${locLine}\n\nAnh/Chị bấm link này để thêm vào Google Calendar và nhận nhắc lịch:\n${calUrl}`;

      await navigator.clipboard.writeText(msg);
      toast.success("Đã copy tin nhắn gửi khách");

      if (reg.id) {
        const sentAt = new Date().toISOString();
        const sentBy = user?.id || null;
        supabase
          .from("event_registrations")
          .update({ 
            calendar_link_sent_at: sentAt,
            calendar_link_sent_by: sentBy
          })
          .eq("id", reg.id)
          .then();

        setModalRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, calendar_link_sent_at: sentAt, calendar_link_sent_by: sentBy } as any : r));
      }
    } catch (err) {
      toast.error("Lỗi copy link lịch: Trình duyệt từ chối quyền Clipboard");
    }
  };

  const handleExportCampaignCSV = () => {
    if (modalRegistrations.length === 0) {
      toast.warning("Chưa có dữ liệu khách hàng để xuất");
      return;
    }

    try {
      const headers = ["STT", "Tên khách hàng", "Số điện thoại", "Email", "Trạng thái", "Ghi chú", "Nhân viên SALE", "Ngày đăng ký"];
      
      const escapeCell = (cell: any) => {
        if (cell === null || cell === undefined) return '""';
        const str = String(cell).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = modalRegistrations.map((reg, index) => {
        const stMeta = getAttendeeStatusMeta(reg.status);
        const saleName = reg.added_by_sale_name || "Khác/Admin";
        const createdStr = reg.created_at ? new Date(reg.created_at).toLocaleString("vi-VN") : "";
        return [
          index + 1,
          reg.customer_name || "",
          reg.customer_phone || "",
          reg.attendee_email || "",
          stMeta.label || "",
          reg.note || "",
          saleName,
          createdStr
        ].map(escapeCell).join(",");
      });

      const csvContent = "\uFEFF" + [headers.map(escapeCell).join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const safeTitle = (title || "Danh_sach_khach_hang").replace(/[^a-zA-Z0-9]/g, "_");
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `DESEMBRE_Campaign_${safeTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Đã xuất danh sách thành công! Bạn có thể Import file CSV này thẳng vào Google Sheets.");
    } catch (err: any) {
      toast.error("Lỗi khi xuất file: " + err.message);
    }
  };

  const handleSendRealGCalInvite = async (reg: EventRegistration) => {
    let targetEmail = reg.attendee_email;
    if (!targetEmail) {
      const input = window.prompt(`Khách mời "${reg.customer_name || 'Khách hàng'}" chưa có Email.\nVui lòng nhập địa chỉ Email để hệ thống gửi thư mời chính thức:`, "");
      if (!input || !input.trim()) {
        toast.warning("Đã hủy: Cần có địa chỉ Email để thực hiện gửi lời mời Google Calendar.");
        return;
      }
      targetEmail = input.trim();
      
      // Cập nhật ngầm vào CSDL Supabase
      supabase.from("event_registrations").update({ attendee_email: targetEmail }).eq("id", reg.id).then();
      setModalRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, attendee_email: targetEmail } as any : r));
    }

    const tid = toast.loading("Đang kết nối với Google Calendar và gửi thiệp mời từ Công ty...");
    try {
      const payload = {
        registration_id: reg.id,
        event_title: title || "Sự kiện DESEMBRE Partner",
        starts_at: startsAt,
        ends_at: endsAt || startsAt,
        location: eventLocation || meetingUrl || "Hệ thống DESEMBRE Việt Nam",
        description: description,
        attendee_email: targetEmail,
        attendee_name: reg.customer_name || "Khách Quý"
      };

      let success = false;

      try {
        const { data, error } = await supabase.functions.invoke('send-gcal-invite', {
          body: payload
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        success = data?.success || true;
      } catch (sdkErr: any) {
        console.warn("Lỗi định tuyến Supabase Invoke, tự động kích hoạt fetch fallback:", sdkErr);
        // Fallback trực tiếp gọi fetch API với xác thực Header tiêu chuẩn
        const session = (await supabase.auth.getSession()).data?.session;
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-gcal-invite`;
        const rawRes = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const resData = await rawRes.json().catch(() => null);
        if (!rawRes.ok || resData?.error) {
          throw new Error(resData?.error || sdkErr.message || "Lỗi giao tiếp máy chủ Edge Function");
        }
        success = resData?.success || true;
      }

      if (!success) {
        throw new Error("Không nhận được tín hiệu phản hồi hợp lệ từ Google");
      }

      toast.success("Đã gửi thư mời chính thức thành công!", { id: tid });
      
      setModalRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, google_invite_status: "invited", attendee_email: targetEmail } as any : r));
    } catch (err: any) {
      toast.error(`Gửi thất bại: ${err.message}`, { id: tid });
    }
  };

  const handleUpdateAttendeeStatus = async (regId: string, assignedSaleId: string, nextStatus: RegistrationStatus) => {
    if (!isManager && assignedSaleId !== user?.id) {
      toast.error("Bạn chỉ có quyền cập nhật khách do mình phụ trách");
      return;
    }

    try {
      const { error: err } = await supabase
        .from("event_registrations")
        .update({ 
          status: nextStatus,
          updated_at: new Date().toISOString(),
          ...(nextStatus === 'attended' ? { checked_in_at: new Date().toISOString() } : {})
        })
        .eq("id", regId);
      
      if (err) throw err;
      toast.success("Cập nhật trạng thái thành công");
      
      if (nextStatus === 'attended') {
        const reg = modalRegistrations.find(r => r.id === regId);
        if (reg) {
          setPendingFollowUpReg({ ...reg, status: 'attended' });
          setShowFollowUpDialog(true);
        }
      }

      await loadEvents();
    } catch (err: any) {
      toast.error("Lỗi cập nhật: " + err.message);
    }
  };

  const handleCreateFollowUp = async (days: number) => {
    if (!pendingFollowUpReg) return;
    
    try {
      setSaving(true);
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + days);
      followUpDate.setHours(9, 0, 0, 0);

      const payload = {
        title: `📞 Follow-up: ${pendingFollowUpReg.customer_name}`,
        description: `Lịch tự động sau sự kiện. (Nhu cầu: ${pendingFollowUpReg.note || "N/A"})`,
        event_type: 'follow_up',
        starts_at: followUpDate.toISOString(),
        customer_id: pendingFollowUpReg.customer_id || null,
        assigned_sale_id: pendingFollowUpReg.assigned_sale_id || user?.id,
        created_by: user?.id,
        status: 'pending',
        remind_before_minutes: 30
      };

      const { error } = await supabase.from("calendar_events").insert([payload]);
      if (error) throw error;

      toast.success(`Đã lên lịch Follow-up sau ${days} ngày`);
      setShowFollowUpDialog(false);
      setPendingFollowUpReg(null);
      loadEvents();
    } catch (err: any) {
      toast.error("Lỗi tạo follow-up: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const adminStats = useMemo(() => {
    if (!isManager) return null;
    
    const companyEvs = events.filter(e => e._ui_type === 'company');
    const allRegs = companyEvs.flatMap(e => e.registrations || []);
    
    const totalEvents = companyEvs.length;
    const totalRegs = allRegs.length;
    const totalAttended = allRegs.filter(r => r.status === 'attended' || r.status === 'converted').length;
    const totalConverted = allRegs.filter(r => r.status === 'converted').length;
    
    const salePerformance = Object.entries(
      allRegs.reduce((acc, reg) => {
        const sName = reg.added_by_sale_name || "Admin/Khác";
        if (!acc[sName]) acc[sName] = { reg: 0, att: 0, conv: 0 };
        acc[sName].reg++;
        if (reg.status === 'attended' || reg.status === 'converted') acc[sName].att++;
        if (reg.status === 'converted') acc[sName].conv++;
        return acc;
      }, {} as Record<string, { reg: number, att: number, conv: number }>)
    ).sort((a, b) => b[1].conv - a[1].conv);

    return {
      totalEvents,
      totalRegs,
      totalAttended,
      totalConverted,
      salePerformance
    };
  }, [events, isManager]);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const isMyPersonalEvent = ev._ui_type === 'personal' && (ev.assigned_sale_id === user?.id || ev.created_by === user?.id);
      const isCompanyEvent = ev._ui_type === 'company';
      
      const hasViewAccess = isManager || isMyPersonalEvent || isCompanyEvent;
      if (!hasViewAccess) return false;

      const matchStatus = statusFilter === "all" || ev.status === statusFilter;
      const matchType = typeFilter === "all" || ev.event_type === typeFilter;
      
      let matchGroup = true;
      if (groupFilter === "personal") {
        matchGroup = ev._ui_type === 'personal';
      } else if (groupFilter === "company") {
        matchGroup = ev._ui_type === 'company';
      }

      return matchStatus && matchType && matchGroup;
    });
  }, [events, statusFilter, typeFilter, groupFilter, isManager, user?.id]);

  const fullCalendarEvents = useMemo(() => {
    return filteredEvents.map(ev => {
      const isCompany = ev._ui_type === 'company';
      const typeMeta = isCompany 
        ? getCompanyEventTypeLabel(ev.event_type as CompanyEventType)
        : getPersonalEventTypeLabel(ev.event_type as PersonalEventType);
        
      const isOverdue = !isCompany && isEventOverdue(ev.starts_at, (ev as PersonalEvent).status);
      const custMeta = !isCompany && (ev as PersonalEvent).customer_id ? customersMap[(ev as PersonalEvent).customer_id!] : null;
      
      let color = "#0ea5e9";
      let statusPrefix = "";
      
      if (isCompany) {
        if (ev.status === 'draft') {
          color = "#d97706";
          statusPrefix = "📝 [Nháp] ";
        } else if (ev.status === 'completed') {
          color = "#10b981";
          statusPrefix = "✓ [Xong] ";
        } else if (ev.status === 'closed') {
          color = "#be123c";
          statusPrefix = "🔒 [Đóng] ";
        } else if (ev.status === 'cancelled') {
          color = "#64748b";
          statusPrefix = "🚫 [Hủy] ";
        } else {
          color = "#8b5cf6";
          statusPrefix = "📢 ";
        }
      } else {
        const pEv = ev as PersonalEvent;
        if (pEv.status === "completed") {
          color = "#10b981";
          statusPrefix = "✓ ";
        } else if (pEv.status === "cancelled") {
          color = "#94a3b8";
          statusPrefix = "🚫 ";
        } else if (isOverdue) {
          color = "#ef4444";
          statusPrefix = "⚠️ [Quá hạn] ";
        } else if (pEv.event_type === "check_in") {
          color = "#f97316";
        }
      }
      
      const myRegsCount = isCompany && ev.registrations 
        ? ev.registrations.filter((r: any) => r.assigned_sale_id === user?.id || r.registered_by === user?.id).length 
        : 0;

      const saleStatsLabel = (!isManager && isCompany && myRegsCount > 0) ? ` [👤 Khách: ${myRegsCount}]` : "";
      
      return {
        id: ev.id,
        title: `${statusPrefix}${typeMeta.icon} ${ev.title}${custMeta ? ` (${custMeta.name})` : ""}${saleStatsLabel}`,
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
  }, [filteredEvents, customersMap, isManager, user?.id]);

  const stats = useMemo(() => {
    let todayCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;

    const now = Date.now();
    const todayStr = new Date().toDateString();

    filteredEvents.forEach(ev => {
      if (ev.status === "completed") {
        completedCount++;
      } else if (ev.status === "cancelled") {
        // bỏ qua
      } else {
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
  }, [filteredEvents]);

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
      setEvents(prev => prev.map(ev => ev.id === id ? ({ ...ev, status: newStatus } as any) : ev));
      await loadEvents();
    } catch (err: any) {
      setEvents(prev => {
        const updated = prev.map(ev => ev.id === id ? ({ ...ev, status: newStatus } as any) : ev);
        try { localStorage.setItem("offline_calendar_events", JSON.stringify(updated)); } catch {}
        return updated;
      });
      toast.success(newStatus === "completed" ? "Đã hoàn thành lịch hẹn (Bộ nhớ đệm)" : "Đã hủy lịch hẹn (Bộ nhớ đệm)");
    }
  };

  const isCompanyEditDisabled = !isManager && !!editEventId && editEventType === 'company';

  const currentActiveCompEv = editEventId ? events.find(e => e.id === editEventId) as CompanyEvent | undefined : undefined;
  const currentSyncStatus = currentActiveCompEv?.google_sync_status || 'not_synced';

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
            {isManager && (
              <Button 
                onClick={() => handleOpenCreateModal("company")} 
                className="bg-purple-600 hover:bg-purple-700 shadow-sm font-bold text-white"
              >
                <Plus className="w-4 h-4 mr-2" /> Tạo sự kiện công ty
              </Button>
            )}
            <Button 
              onClick={() => handleOpenCreateModal("personal")} 
              variant={isManager ? "outline" : "default"}
              className="shadow-sm font-bold"
            >
              <Plus className="w-4 h-4 mr-2" /> Tạo lịch hẹn
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-6 space-y-6 flex-1">
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

        {/* Dashboard Chiến dịch (Dành cho Quản lý) */}
        {isManager && events.some(e => e._ui_type === "company") && (
          <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
            <div className="bg-purple-600 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Target className="w-4 h-4" />
                <h2 className="text-sm font-bold uppercase tracking-wide">Tổng quan Chiến dịch & Sự kiện Công ty</h2>
              </div>
              <span className="bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {events.filter(e => e._ui_type === "company" && (e as CompanyEvent).status !== "completed").length} Đang diễn ra
              </span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events
                .filter(e => e._ui_type === "company")
                .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
                .slice(0, 3)
                .map(ev => {
                  const companyEv = ev as CompanyEvent;
                  const registrations = companyEv.registrations || [];
                  const regCount = registrations.length;
                  const convCount = registrations.filter(r => r.status === "converted").length;
                  const attendCount = registrations.filter(r => r.status === "attended" || r.status === "converted").length;
                  const max = companyEv.capacity || 0;
                  const progress = max > 0 ? (regCount / max) * 100 : 0;
                  
                  return (
                    <div 
                      key={companyEv.id} 
                      onClick={() => handleEventClick({ event: { id: companyEv.id } })}
                      className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 cursor-pointer transition-all flex flex-col gap-2 shadow-2xs"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-900 line-clamp-1 flex-1 pr-2">{companyEv.title}</h3>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          companyEv.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                          companyEv.status === 'published' ? 'bg-purple-100 text-purple-700' : 
                          companyEv.status === 'closed' ? 'bg-rose-100 text-rose-700' : 
                          companyEv.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {companyEv.status === 'draft' ? '📝 NHÁP' :
                           companyEv.status === 'published' ? '📢 LIVE' :
                           companyEv.status === 'closed' ? '🔒 ĐÓNG' :
                           companyEv.status === 'completed' ? '✓ XONG' :
                           companyEv.status === 'cancelled' ? '🚫 HỦY' : ""}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Tiến độ đăng ký</span>
                          <span className="font-bold text-slate-700">{regCount}{max > 0 ? `/${max}` : ""} khách</span>
                        </div>
                        {max > 0 && (
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${progress >= 100 ? 'bg-rose-500' : progress >= 80 ? 'bg-amber-500' : 'bg-purple-500'}`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            ></div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-4 pt-1">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 uppercase font-bold">Tham gia</span>
                          <span className="text-xs font-black text-emerald-600">{attendCount}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 uppercase font-bold">Chốt đơn</span>
                          <span className="text-xs font-black text-yellow-600">{convCount}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 uppercase font-bold">ROI</span>
                          <span className="text-xs font-black text-purple-600">
                            {regCount > 0 ? `${((convCount / regCount) * 100).toFixed(0)}%` : "0%"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

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
                const isCompany = ev._ui_type === 'company';
                const typeMeta = isCompany 
                  ? getCompanyEventTypeLabel(ev.event_type as CompanyEventType)
                  : getPersonalEventTypeLabel(ev.event_type as PersonalEventType);
                const cName = !isCompany && ev.customer_id ? customersMap[ev.customer_id]?.name : null;
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
                      {isCompany && (
                        <p className="text-[10px] text-purple-600 font-bold">🏢 Sự kiện công ty</p>
                      )}
                    </div>
                    {!isCompany && (
                      <button
                        onClick={() => handleStatusChange(ev.id, "completed")}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-bold border border-emerald-200 shrink-0"
                      >
                        Hoàn thành
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dashboard Hiệu quả Sự kiện cho Quản lý */}
        {isManager && adminStats && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Hiệu suất Sự kiện tháng này</h3>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">Cập nhật thời gian thực</div>
            </div>
            
            <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="grid grid-cols-2 gap-3 lg:col-span-1">
                {[
                  { label: "Tổng sự kiện", val: adminStats.totalEvents, icon: "📁", color: "text-slate-900" },
                  { label: "Tổng Đăng ký", val: adminStats.totalRegs, icon: "👥", color: "text-blue-600" },
                  { label: "Tham gia", val: adminStats.totalAttended, icon: "✓", color: "text-emerald-600" },
                  { label: "Chốt đơn", val: adminStats.totalConverted, icon: "💰", color: "text-yellow-600" }
                ].map((s, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">{s.icon} {s.label}</span>
                    <span className={`text-xl font-black ${s.color}`}>{s.val}</span>
                    {i === 2 && adminStats.totalRegs > 0 && (
                      <span className="text-[10px] text-slate-400 ml-2 font-bold">({((adminStats.totalAttended / adminStats.totalRegs) * 100).toFixed(0)}%)</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">🏆 Hiệu quả theo SALE</span>
                  <span className="text-[9px] text-slate-400 italic">Xếp hạng theo số đơn chốt</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400">
                        <th className="text-left py-2 font-bold uppercase text-[9px]">Nhân viên</th>
                        <th className="text-center py-2 font-bold uppercase text-[9px]">Đăng ký</th>
                        <th className="text-center py-2 font-bold uppercase text-[9px]">Tham gia</th>
                        <th className="text-center py-2 font-bold uppercase text-[9px]">Đơn chốt</th>
                        <th className="text-right py-2 font-bold uppercase text-[9px]">Tỷ lệ (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {adminStats.salePerformance.map(([name, stat], i) => (
                        <tr key={name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 font-bold text-slate-700">
                            {i === 0 && "🥇 "}
                            {i === 1 && "🥈 "}
                            {i === 2 && "🥉 "}
                            {name}
                          </td>
                          <td className="text-center py-2.5 font-bold text-slate-600">{stat.reg}</td>
                          <td className="text-center py-2.5 font-bold text-emerald-600">{stat.att}</td>
                          <td className="text-center py-2.5 font-bold text-yellow-600">{stat.conv}</td>
                          <td className="text-right py-2.5 font-mono font-bold text-purple-600">
                            {stat.reg > 0 ? ((stat.conv / stat.reg) * 100).toFixed(0) : 0}%
                          </td>
                        </tr>
                      ))}
                      {adminStats.salePerformance.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 italic">Chưa có dữ liệu đóng góp từ nhân viên.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

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
                <option value="company_event">🏢 Sự kiện công ty</option>
                <option value="follow_up">📞 Follow-up KH</option>
                <option value="appointment">🤝 Lịch hẹn Spa</option>
                <option value="check_in">📍 Check-in CSKH</option>
                <option value="demo">✨ Demo sản phẩm</option>
                <option value="delivery">🚚 Giao hàng</option>
                <option value="payment">💰 Nhắc thanh toán</option>
                <option value="note">📝 Ghi chú lịch</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setGroupFilter("all")}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${groupFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
              >
                Mọi lịch trình
              </button>
              <button
                onClick={() => setGroupFilter("personal")}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${groupFilter === 'personal' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'}`}
              >
                👤 Lịch cá nhân
              </button>
              <button
                onClick={() => setGroupFilter("company")}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${groupFilter === 'company' ? 'bg-white text-purple-600 shadow-2xs' : 'text-slate-600'}`}
              >
                🏢 Sự kiện công ty
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Hiển thị <span className="font-bold text-slate-800">{filteredEvents.length}</span> sự kiện
          </div>
        </div>

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
                      const isCompany = ev._ui_type === 'company';
                      const typeMeta = isCompany 
                        ? getCompanyEventTypeLabel(ev.event_type as CompanyEventType)
                        : getPersonalEventTypeLabel(ev.event_type as PersonalEventType);
                      const custName = !isCompany && ev.customer_id ? customersMap[ev.customer_id]?.name : null;
                      
                      return (
                        <div 
                          key={ev.id} 
                          onClick={() => handleEventClick({ event: { id: ev.id } })}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer hover:border-primary transition-all ${!isCompany && (ev as PersonalEvent).status === 'completed' ? 'bg-slate-50/50 border-slate-100 opacity-60' : !isCompany && (ev as PersonalEvent).status === 'cancelled' ? 'bg-rose-50/30 border-rose-100 line-through opacity-50' : 'bg-white border-slate-100 shadow-2xs'}`}
                        >
                          <div className="flex items-center gap-1.5 justify-between">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span>{typeMeta.icon}</span>
                              <p className="font-bold text-slate-900 line-clamp-1">{ev.title}</p>
                            </div>
                            {isCompany ? (
                              <span className={`shrink-0 text-[8px] px-1 py-0.2 rounded font-bold ${
                                ev.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                                ev.status === 'published' ? 'bg-purple-100 text-purple-700' :
                                ev.status === 'closed' ? 'bg-rose-100 text-rose-700' :
                                ev.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {ev.status === 'draft' ? '📝 NHÁP' :
                                 ev.status === 'published' ? '📢 LIVE' :
                                 ev.status === 'closed' ? '🔒 ĐÓNG' :
                                 ev.status === 'completed' ? '✓ XONG' : '🚫 HỦY'}
                              </span>
                            ) : (
                              <span className={`shrink-0 text-[8px] px-1 py-0.2 rounded font-bold ${
                                (ev as PersonalEvent).status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                (ev as PersonalEvent).status === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {(ev as PersonalEvent).status === 'completed' ? '✓ Xong' :
                                 (ev as PersonalEvent).status === 'cancelled' ? '🚫 Hủy' : '⏳ Chờ'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono font-bold text-slate-600 mt-1">
                            ⏰ {formatCalendarTime(ev.starts_at)}
                          </p>
                          {custName && (
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                              🏢 {custName}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50">
                            {isCompany ? (
                              <span className="text-[10px] text-purple-600 font-bold">
                                🏢 Sự kiện công ty
                              </span>
                            ) : (
                              <span className="text-[10px] text-blue-600 font-bold">
                                👤 Lịch cá nhân
                              </span>
                            )}
                            <button
                              type="button"
                              title="Xóa sự kiện này"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvent(ev.id, ev._ui_type);
                              }}
                              className="text-slate-300 hover:text-rose-600 p-0.5 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <form onSubmit={handleSubmitCreate}>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                  {editEventId ? <RotateCcw className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                  {editEventId ? "Cập nhật thông tin" : "Tạo mới lịch trình"}
                </DialogTitle>
                {isManager && !editEventId && (
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                      type="button"
                      onClick={() => setModalTab("personal")}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${modalTab === 'personal' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500'}`}
                    >
                      CÁ NHÂN
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setModalTab("company");
                        if (!endsAt) {
                          const baseD = startsAt ? startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
                          setEndsAt(`${baseD}T12:00`);
                          setRegDeadline(`${baseD}T12:00`);
                          if (startsAt && startsAt.includes("T") && Number(startsAt.slice(11, 13)) >= 12) {
                            setStartsAt(`${baseD}T08:30`);
                          }
                        }
                      }}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${modalTab === 'company' ? 'bg-white shadow-xs text-purple-600' : 'text-slate-500'}`}
                    >
                      CÔNG TY
                    </button>
                  </div>
                )}
                {editEventId && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${editEventType === 'company' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {editEventType === 'company' ? 'Chiến dịch' : 'Lịch cá nhân'}
                  </span>
                )}
              </div>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="space-y-1">
                <Label htmlFor="ev-title" className="text-xs font-bold text-slate-700">
                  Tiêu đề / Nội dung ngắn gọn <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ev-title"
                  value={title}
                  disabled={isCompanyEditDisabled}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nội dung chính..."
                  className="h-8 text-xs bg-white font-medium focus:ring-primary"
                />
              </div>

              <Tabs value={modalTab} onValueChange={(v: any) => setModalTab(v)} className="w-full">
                <TabsContent value="personal" className="mt-0 space-y-4 border-none p-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Loại hoạt động</Label>
                      <select
                        value={personalType}
                        onChange={(e) => setPersonalType(e.target.value as PersonalEventType)}
                        className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
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
                        className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value={15}>15 phút</option>
                        <option value={30}>30 phút</option>
                        <option value={60}>1 tiếng</option>
                        <option value={1440}>1 ngày</option>
                        <option value={0}>Không nhắc</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Gán cho khách hàng (CRM)</Label>
                    <div className="relative">
                      <select
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- Không chọn / Khách hàng chưa có --</option>
                        {customersList.map(c => (
                          <option key={c.id} value={c.id}>{c.name} {c.phone ? `- ${c.phone}` : ""}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Phần chọn Sale phụ trách (Chỉ dành cho Quản lý) */}
                  {isManager && (
                    <div className="space-y-1 pt-2 border-t border-slate-100">
                      <Label className="text-xs font-bold text-purple-700 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Gán nhân viên SALE phụ trách
                      </Label>
                      <select
                        value={assignedSaleId}
                        onChange={(e) => setAssignedSaleId(e.target.value)}
                        className="w-full h-8 px-2 py-1 bg-purple-50/50 border border-purple-100 rounded-md text-xs font-bold text-purple-900 focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="">-- Tự do / Admin quản lý chung --</option>
                        {salesList.map(s => (
                          <option key={s.id} value={s.id}>👤 {s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="company" className="mt-0 space-y-4 border-none p-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Loại chiến dịch</Label>
                      <select
                        value={companyType}
                        disabled={isCompanyEditDisabled}
                        onChange={(e) => setCompanyType(e.target.value as CompanyEventType)}
                        className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="workshop">🏢 Workshop Offline</option>
                        <option value="training">🎓 Đào tạo / Chuyển giao</option>
                        <option value="livestream">📱 Livestream / Webinar</option>
                        <option value="product_demo">✨ Demo sản phẩm mới</option>
                        <option value="promotion">🎁 Chương trình KM</option>
                        <option value="internal_meeting">👥 Họp nội bộ</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Trạng thái vận hành</Label>
                      <select
                        value={campaignStatus}
                        disabled={isCompanyEditDisabled}
                        onChange={(e: any) => setCampaignStatus(e.target.value)}
                        className="w-full h-8 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold focus:ring-1 focus:ring-primary"
                      >
                        <option value="draft">📝 Bản nháp</option>
                        <option value="published">🟢 Đang mở đăng ký</option>
                        <option value="closed">🔴 Đã đóng đăng ký</option>
                        <option value="completed">✓ Đã hoàn thành</option>
                        <option value="cancelled">✕ Đã huỷ</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Địa điểm
                      </Label>
                      <Input
                        value={eventLocation}
                        disabled={isCompanyEditDisabled}
                        onChange={(e) => setEventLocation(e.target.value)}
                        placeholder="Hội trường, Spa..."
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Meeting URL
                      </Label>
                      <Input
                        value={meetingUrl}
                        disabled={isCompanyEditDisabled}
                        onChange={(e) => setMeetingUrl(e.target.value)}
                        placeholder="Zoom, Google Meet..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Sức chứa (Capacity)</Label>
                    <Input
                      type="number"
                      value={eventCapacity}
                      disabled={isCompanyEditDisabled}
                      onChange={(e) => setEventCapacity(e.target.value ? Number(e.target.value) : "")}
                      placeholder="Số lượng khách..."
                      className="h-8 text-xs"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
                <div className="space-y-1">
                  <Label htmlFor="ev-start" className="text-xs font-bold text-slate-700">
                    Bắt đầu mời <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ev-start"
                    type="datetime-local"
                    value={startsAt}
                    disabled={isCompanyEditDisabled}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ev-end" className="text-xs font-bold text-slate-700">Ngày giờ Sự kiện (GCal)</Label>
                  <Input
                    id="ev-end"
                    type="datetime-local"
                    value={endsAt}
                    disabled={isCompanyEditDisabled}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ev-desc" className="text-xs font-bold text-slate-700">Chi tiết / Ghi chú</Label>
                <Textarea
                  id="ev-desc"
                  value={description}
                  disabled={isCompanyEditDisabled}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú nội dung công việc..."
                  className="text-xs min-h-[60px] bg-white"
                />
              </div>

              {modalTab === 'company' && editEventId && (
                <div className="space-y-5 pt-5 border-t border-purple-100">
                  {/* KHỐI ĐỒNG BỘ GOOGLE CALENDAR (GCal Sync Hub) */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-white shadow-2xs flex items-center justify-center font-bold text-blue-600 text-[10px]">
                            📅
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-800">Đồng bộ Google Calendar</h5>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-500">Trạng thái:</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                currentSyncStatus === 'synced' ? 'bg-emerald-100 text-emerald-700' :
                                currentSyncStatus === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {currentSyncStatus === 'synced' ? '✓ Đã đồng bộ' :
                                 currentSyncStatus === 'failed' ? '✕ Lỗi đồng bộ' : '⏳ Chưa đồng bộ'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Nút bấm dành cho Admin/Sub-admin */}
                        {(isAdmin || isSubAdmin) && (
                          <div className="flex items-center gap-2">
                            {currentActiveCompEv?.google_calendar_html_link && (
                              <a
                                href={currentActiveCompEv.google_calendar_html_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-blue-300 rounded-lg text-blue-600 font-bold text-[10px] transition-colors flex items-center gap-1 shadow-2xs"
                              >
                                <ExternalLink className="w-3 h-3" /> Mở GCal
                              </a>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              disabled={isSyncingGCal}
                              onClick={handleTriggerGCalSync}
                              className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 shadow-xs"
                            >
                              {isSyncingGCal ? (
                                <span className="flex items-center gap-1.5">
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang đồng bộ...
                                </span>
                              ) : (
                                "🔄 Đồng bộ GCal"
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Hiển thị chi tiết lỗi nếu có */}
                      {currentActiveCompEv?.google_sync_error && (
                        <div className="bg-rose-50/80 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-700 font-medium">
                          <span className="font-bold">Chi tiết lỗi từ Google:</span> {currentActiveCompEv.google_sync_error}
                        </div>
                      )}
                    </div>

                    {/* KHỐI QUẢN TRỊ NÂNG CAO BAN ĐẦU */}
                    {isManager && (
                      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-purple-400" />
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">Phân tích Hiệu quả Chiến dịch</h4>
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] bg-white/10 border-white/20 text-white hover:bg-white/20 font-bold"
                          onClick={handleExportCampaignCSV}
                        >
                          📥 Xuất danh sách
                        </Button>
                      </div>

                      <div className="grid grid-cols-4 gap-3 mb-4">
                        {[
                          { label: "Tổng Đăng ký", val: modalRegistrations.length, color: "text-white" },
                          { label: "Đã Xác nhận", val: modalRegistrations.filter(r => r.status === 'confirmed' || r.status === 'attended' || r.status === 'converted').length, color: "text-blue-400" },
                          { label: "Đã Tham gia", val: modalRegistrations.filter(r => r.status === 'attended' || r.status === 'converted').length, color: "text-emerald-400" },
                          { label: "Chốt đơn", val: modalRegistrations.filter(r => r.status === 'converted').length, color: "text-yellow-400" }
                        ].map((s, i) => (
                          <div key={i} className="bg-white/5 p-2 rounded-lg border border-white/10">
                            <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">{s.label}</span>
                            <span className={`text-lg font-black ${s.color}`}>{s.val}</span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                          <Users className="w-3 h-3" /> Đóng góp theo nhân viên SALE
                        </p>
                        <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                          {Object.entries(
                            modalRegistrations.reduce((acc, reg) => {
                              const sName = reg.added_by_sale_name || "Khác/Admin";
                              if (!acc[sName]) acc[sName] = { total: 0, conv: 0 };
                              acc[sName].total++;
                              if (reg.status === 'converted') acc[sName].conv++;
                              return acc;
                            }, {} as Record<string, { total: number; conv: number }>)
                          ).sort((a, b) => b[1].total - a[1].total).map(([name, stat]) => (
                            <div key={name} className="flex items-center justify-between bg-white/5 px-3 py-1.5 rounded border border-white/5 text-[11px]">
                              <span className="text-slate-300 font-medium">👤 {name}</span>
                              <div className="flex gap-3">
                                <span className="text-slate-400">Khách: <b className="text-white">{stat.total}</b></span>
                                <span className="text-slate-400">Đơn: <b className="text-yellow-400">{stat.conv}</b></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-purple-700 uppercase flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Thêm khách hàng đăng ký mới
                      </h4>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="quick-add" className="text-[10px] cursor-pointer font-bold text-slate-600">Khách vãng lai</Label>
                        <input 
                          id="quick-add" 
                          type="checkbox" 
                          checked={isQuickAddCustomer} 
                          onChange={(e) => setIsQuickAddCustomer(e.target.checked)}
                          className="w-3 h-3 rounded"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {isQuickAddCustomer ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input 
                              placeholder="Tên khách hàng..." 
                              value={quickCustomerName} 
                              onChange={(e) => setQuickCustomerName(e.target.value)}
                              className="h-8 text-xs bg-white border-purple-200"
                            />
                            <Input 
                              placeholder="Số điện thoại..." 
                              value={quickCustomerPhone} 
                              onChange={(e) => setQuickCustomerPhone(e.target.value)}
                              className="h-8 text-xs bg-white border-purple-200"
                            />
                          </div>
                          <Input 
                            type="email"
                            placeholder="Email khách hàng (Không bắt buộc)..." 
                            value={quickCustomerEmail} 
                            onChange={(e) => setQuickCustomerEmail(e.target.value)}
                            className="h-8 text-xs bg-white border-purple-200"
                          />
                        </div>
                      ) : (
                        <select
                          value={attendeeSelectId}
                          onChange={(e) => setAttendeeSelectId(e.target.value)}
                          className="w-full h-8 px-2 py-1 bg-white border border-purple-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="">-- Chọn khách hàng từ CRM --</option>
                          {customersList.map(c => (
                            <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                          ))}
                        </select>
                      )}

                      <div className="flex gap-2">
                        <Input 
                          placeholder="Ghi chú nhu cầu (VD: Quan tâm cấy tảo...)" 
                          value={newAttendeeNote}
                          onChange={(e) => setNewAttendeeNote(e.target.value)}
                          className="flex-1 h-8 text-xs bg-white border-purple-200"
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          onClick={handleAddAttendee}
                          disabled={saving}
                          className="h-8 bg-purple-600 hover:bg-purple-700 text-white font-bold shrink-0"
                        >
                          {saving ? "..." : <Plus className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(() => {
                      const displayedRegs = isManager 
                        ? modalRegistrations 
                        : modalRegistrations.filter(r => r.assigned_sale_id === user?.id || r.registered_by === user?.id);

                      return (
                        <>
                          <Label className="text-[11px] font-bold text-slate-800 flex items-center justify-between px-1 flex-wrap gap-1">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-slate-500" /> 
                              {isManager ? `Danh sách đăng ký (${modalRegistrations.length})` : `Khách của tôi (${displayedRegs.length})`}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              {isManager && (
                                <>
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100" title="Khách đã có Email, sẵn sàng nhận lời mời GCal tự động">
                                    📧 Có Email: {modalRegistrations.filter(r => r.attendee_email).length}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-100" title="Khách thiếu Email, cần bổ sung để gửi lịch">
                                    ⚠️ Thiếu: {modalRegistrations.filter(r => !r.attendee_email).length}
                                  </span>
                                </>
                              )}
                              <span className="text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                                Chuyển đổi: {modalRegistrations.length > 0 ? `${((modalRegistrations.filter(r => r.status === 'converted').length / modalRegistrations.length) * 100).toFixed(0)}%` : "0%"}
                              </span>
                            </div>
                          </Label>

                          {displayedRegs.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                              {isManager ? "Chưa có khách hàng đăng ký tham gia sự kiện này." : "Bạn chưa đăng ký khách hàng nào cho sự kiện này."}
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                              {displayedRegs.map(reg => {
                                const statusMeta = getAttendeeStatusMeta(reg.status);
                                const canModify = isManager || reg.assigned_sale_id === user?.id;

                                return (
                                  <div key={reg.id} className={`p-3 rounded-xl border transition-all ${reg.status === 'converted' ? 'bg-yellow-50/30 border-yellow-200' : reg.status === 'attended' ? 'bg-emerald-50/30 border-emerald-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-xs font-bold text-slate-900">{reg.customer_name}</p>
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border ${statusMeta.badgeClass}`}>
                                            {statusMeta.label}
                                          </span>
                                          {(() => {
                                            const gStatus = (reg as any).google_invite_status;
                                            if (gStatus === 'invited') {
                                              return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-50 text-purple-600 border border-purple-200">✉️ Đã gửi thư mời Công ty</span>;
                                            }
                                            if (gStatus === 'sent') {
                                              return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-600 border border-blue-200">Đã gửi Google Calendar</span>;
                                            }
                                            if ((reg as any).calendar_link_sent_at) {
                                              return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200" title={`Đã gửi lúc: ${new Date((reg as any).calendar_link_sent_at).toLocaleString()}`}>Đã gửi link</span>;
                                            }
                                            return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-50 text-slate-400 border border-slate-200">Chưa gửi link</span>;
                                          })()}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 pt-0.5">
                                          {reg.customer_phone && <span className="flex items-center gap-1 font-medium text-slate-600">📞 {reg.customer_phone}</span>}
                                          {reg.attendee_email ? (
                                            <button 
                                              type="button"
                                              onClick={() => {
                                                const newE = window.prompt(`Sửa Email cho "${reg.customer_name || 'Khách'}":`, reg.attendee_email || "");
                                                if (newE !== null) {
                                                  const trimmed = newE.trim();
                                                  supabase.from("event_registrations").update({ attendee_email: trimmed }).eq("id", reg.id).then();
                                                  setModalRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, attendee_email: trimmed } as any : r));
                                                }
                                              }}
                                              title="Bấm để chỉnh sửa Email"
                                              className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-all text-[9px]"
                                            >
                                              📧 {reg.attendee_email}
                                            </button>
                                          ) : (
                                            <button 
                                              type="button"
                                              onClick={() => {
                                                const newE = window.prompt(`Bổ sung Email cho "${reg.customer_name || 'Khách'}":`, "");
                                                if (newE && newE.trim()) {
                                                  const trimmed = newE.trim();
                                                  supabase.from("event_registrations").update({ attendee_email: trimmed }).eq("id", reg.id).then();
                                                  setModalRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, attendee_email: trimmed } as any : r));
                                                }
                                              }}
                                              title="Khách chưa có Email. Bấm để bổ sung nhanh!"
                                              className="flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 transition-all text-[9px] animate-pulse"
                                            >
                                              ⚠️ Thiếu Email (Bấm bổ sung)
                                            </button>
                                          )}
                                          <span className="flex items-center gap-1 font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">👤 Sale: {reg.added_by_sale_name || "Admin"}</span>
                                        </div>
                                      </div>
                                      {canModify && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAttendee(reg.id, reg.assigned_sale_id!)}
                                          className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                    
                                    {reg.note && (
                                      <p className="text-[10px] text-slate-600 bg-slate-50/80 p-2 rounded-lg italic border border-slate-100 mt-2">
                                        <b className="text-[9px] uppercase text-slate-400 not-italic mr-1">Ghi chú:</b> {reg.note}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-slate-100/60">
                                      <select
                                        value={reg.status}
                                        onChange={(e: any) => handleUpdateAttendeeStatus(reg.id, reg.assigned_sale_id!, e.target.value)}
                                        disabled={!canModify}
                                        className="h-8 flex-1 px-2 text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                      >
                                        <optgroup label="Trước sự kiện">
                                          <option value="invited">✉️ Đã mời</option>
                                          <option value="registered">📝 Đã đăng ký</option>
                                          <option value="confirmed">🤝 Đã xác nhận</option>
                                        </optgroup>
                                        <optgroup label="Sau sự kiện">
                                          <option value="attended">✓ Đã tham gia</option>
                                          <option value="no_show">✕ Không tham gia</option>
                                          <option value="cancelled">🚫 Huỷ tham gia</option>
                                          <option value="converted">💰 Đã chốt đơn</option>
                                        </optgroup>
                                      </select>
                                      {isManager && reg.status !== 'attended' && reg.status !== 'converted' && (
                                        <Button 
                                          type="button" 
                                          size="sm" 
                                          onClick={() => handleUpdateAttendeeStatus(reg.id, reg.assigned_sale_id!, 'attended')}
                                          className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-2xs rounded-lg shrink-0"
                                        >
                                          Check-in
                                        </Button>
                                      )}
                                      {isManager && (reg as any).google_invite_status !== 'invited' && (
                                        <button
                                          type="button"
                                          onClick={() => handleSendRealGCalInvite(reg)}
                                          title="Hệ thống tự động gửi thư mời chính thức từ Lịch Công ty"
                                          className="h-8 px-2 flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg shadow-2xs transition-all shrink-0"
                                        >
                                          📧 <span className="hidden sm:inline">Gửi thư mời Công ty</span>
                                        </button>
                                      )}
                                      <a
                                        href={(() => {
                                          const targetDatePart = endsAt ? endsAt.slice(0, 10) : startsAt.slice(0, 10);
                                          const targetEndTimePart = endsAt && endsAt.includes("T") ? endsAt.slice(11, 16) : "21:00";
                                          const targetStartTimePart = startsAt.includes("T") ? startsAt.slice(11, 16) : "18:00";
                                          return buildGoogleCalendarLink({
                                            title: title || "Sự kiện DESEMBRE Partner",
                                            startsAt: `${targetDatePart}T${targetStartTimePart}`,
                                            endsAt: `${targetDatePart}T${targetEndTimePart}`,
                                            location: eventLocation || meetingUrl || null,
                                            description: formatGCalDescription(reg.customer_name, reg.customer_phone, description)
                                          });
                                        })()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Thêm vào Google Calendar"
                                        className="h-8 px-2 flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-bold border border-slate-200 rounded-lg shadow-2xs transition-all shrink-0"
                                      >
                                        📅 <span className="hidden sm:inline">GCal</span>
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyCalendarMessage(reg)}
                                        title="Copy tin nhắn kèm link lịch gửi khách"
                                        className="h-8 px-2 flex items-center justify-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold border border-purple-200 rounded-lg shadow-2xs transition-all shrink-0"
                                      >
                                        📋 <span className="hidden sm:inline">Copy tin nhắn</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setModalOpen(false)}
                className="h-9 px-4 text-xs font-bold text-slate-600 border-slate-200 hover:bg-slate-100 shadow-2xs"
              >
                Hủy bỏ
              </Button>
              <div className="flex items-center gap-2">
                {editEventId && !isCompanyEditDisabled && (
                  <Button 
                    type="button"
                    variant="destructive"
                    onClick={() => handleDeleteEvent(editEventId, editEventType)}
                    className="h-9 px-4 text-xs font-bold shadow-2xs"
                  >
                    Xóa
                  </Button>
                )}
                {!isCompanyEditDisabled && (
                  <Button 
                    type="submit" 
                    disabled={saving} 
                    className={`h-9 px-6 text-xs font-bold shadow-2xs text-white ${modalTab === 'company' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {saving ? "Đang xử lý..." : editEventId ? "Cập nhật dữ liệu" : "Xác nhận lưu lịch"}
                  </Button>
                )}
                {isCompanyEditDisabled && (
                  <Button 
                    type="button" 
                    variant="default"
                    onClick={() => setModalOpen(false)}
                    className="h-9 px-6 text-xs font-bold shadow-2xs bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    Đóng giao diện
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent className="sm:max-w-[400px] p-6 rounded-2xl border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-center text-lg font-black text-slate-900">
              Check-in thành công!
            </DialogTitle>
            <p className="text-center text-slate-500 text-xs px-4">
              Khách hàng <b>{pendingFollowUpReg?.customer_name}</b> đã tham gia sự kiện. Bạn có muốn lên lịch Follow-up để chăm sóc và chốt đơn không?
            </p>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2.5 mt-6">
            <Button 
              onClick={() => handleCreateFollowUp(1)}
              variant="outline"
              className="h-11 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 justify-between px-4 group"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700">1</span>
                <span className="text-xs font-bold text-slate-700">Sau 1 ngày (Gợi ý)</span>
              </div>
              <ArrowLeft className="w-4 h-4 rotate-180 text-slate-400" />
            </Button>
            <Button 
              onClick={() => handleCreateFollowUp(3)}
              variant="outline"
              className="h-11 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 justify-between px-4 group"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700">3</span>
                <span className="text-xs font-bold text-slate-700">Sau 3 ngày</span>
              </div>
              <ArrowLeft className="w-4 h-4 rotate-180 text-slate-400" />
            </Button>
            <Button 
              onClick={() => handleCreateFollowUp(7)}
              variant="outline"
              className="h-11 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 justify-between px-4 group"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700">7</span>
                <span className="text-xs font-bold text-slate-700">Sau 1 tuần</span>
              </div>
              <ArrowLeft className="w-4 h-4 rotate-180 text-slate-400" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
