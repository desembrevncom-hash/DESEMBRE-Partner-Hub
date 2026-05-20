import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, User, Zap, Check, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";


interface WorkspaceCalendarCardProps {
  events: any[];
  onRefresh?: () => void;
}

export const WorkspaceCalendarCard: React.FC<WorkspaceCalendarCardProps> = ({ events, onRefresh }) => {
  const { user, isAdmin, isSubAdmin, isTeleLead, isSale, isTelesale } = useAuth();
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick detail preview
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [previewCustomer, setPreviewCustomer] = useState<any | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("call");

  useEffect(() => {
    async function fetchCustomers() {
      if (!user) return;
      
      let fetchedCustomers: any[] = [];
      let query = supabase.from("customers").select("id, name, facility_name").is("deleted_at", null);

      if (isAdmin || isSubAdmin) {
        const { data } = await query.limit(100);
        fetchedCustomers = data || [];
      } else if (isTeleLead) {
        const { data } = await query.eq("owner_tele_id", user.id).limit(100);
        fetchedCustomers = data || [];
      } else if (isSale) {
        const { data } = await query.eq("owner_sale_id", user.id).limit(100);
        fetchedCustomers = data || [];
      } else if (isTelesale) {
        const { data: tasksData } = await supabase
          .from("customer_tasks")
          .select("customer_id")
          .eq("assigned_to", user.id);
        
        const customerIds = Array.from(new Set((tasksData || []).map(t => t.customer_id).filter(Boolean)));
        if (customerIds.length > 0) {
          const { data: custData } = await query.in("id", customerIds).limit(100);
          fetchedCustomers = custData || [];
        }
      }
      
      setCustomers(fetchedCustomers);
    }
    if (isDialogOpen) fetchCustomers();
  }, [isDialogOpen, user, isAdmin, isSubAdmin, isTeleLead, isSale, isTelesale]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      // Đối với sự kiện công ty, ưu tiên hiển thị vào ngày diễn ra sự kiện (ends_at)
      // Đối với các task/lịch cá nhân, dùng starts_at hoặc due_at
      const isCompany = event._ui_type === 'company';
      const eventDate = isCompany 
        ? (event.ends_at || event.starts_at) 
        : (event.starts_at || event.due_at);
        
      return eventDate ? isSameDay(new Date(eventDate), day) : false;
    });
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setIsDialogOpen(true);
  };

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    setIsDetailDialogOpen(true);
  };

  const handleCreateTask = async () => {
    if (!selectedDay || !title || !customerId) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setLoading(true);
    const [hours, minutes] = time.split(":").map(Number);
    const dueAt = new Date(selectedDay);
    dueAt.setHours(hours, minutes, 0, 0);

    const { error } = await supabase.from("customer_tasks").insert({
      title,
      customer_id: customerId,
      assigned_to: user?.id,
      due_at: dueAt.toISOString(),
      task_type: type,
      status: "pending"
    });

    if (error) {
      toast.error("Lỗi khi tạo task: " + error.message);
    } else {
      toast.success("Đã tạo lịch hẹn thành công");
      setIsDialogOpen(false);
      setTitle("");
      setCustomerId("");
      if (onRefresh) onRefresh();
    }
    setLoading(false);
  };

  const handleCompleteTask = async () => {
    if (!selectedEvent) return;
    
    setLoading(true);
    const table = selectedEvent._ui_type === 'task' ? "customer_tasks" : "calendar_events";
    
    const { error } = await supabase
      .from(table)
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", selectedEvent.id);
      
    if (error) {
      toast.error("Lỗi khi hoàn thành công việc: " + error.message);
    } else {
      toast.success("Chúc mừng! Đã hoàn thành công việc thành công 🎉");
      setIsDetailDialogOpen(false);
      if (onRefresh) onRefresh();
    }
    setLoading(false);
  };

  const handleDeleteTask = async () => {
    if (!selectedEvent) return;
    
    if (!window.confirm("Bạn có chắc chắn muốn xóa lịch hẹn/công việc này khỏi hệ thống không?")) return;
    
    setLoading(true);
    const table = selectedEvent._ui_type === 'task' ? "customer_tasks" : "calendar_events";
    
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", selectedEvent.id);
      
    if (error) {
      toast.error("Lỗi khi xóa công việc: " + error.message);
    } else {
      toast.success("Đã xóa công việc thành công");
      setIsDetailDialogOpen(false);
      if (onRefresh) onRefresh();
    }
    setLoading(false);
  };

  const formatCalendarTime = (isoString?: string) => {
    if (!isoString) return "Chưa xác định";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      return format(date, "HH:mm - dd/MM/yyyy", { locale: vi });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
      <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary" /> Lịch làm việc
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            {format(currentMonth, "MMMM yyyy", { locale: vi })}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/10" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/10" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 grid grid-cols-7 gap-px bg-slate-100">
        {/* Weekday headers */}
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
          <div key={day} className="bg-white py-2 text-center text-[10px] font-black text-slate-400 uppercase">
            {day}
          </div>
        ))}

        {/* Days */}
        {calendarDays.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isSelectedMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={idx} 
              onClick={() => handleDayClick(day)}
              className={`bg-white min-h-[80px] p-1.5 flex flex-col gap-1 transition-colors hover:bg-slate-50 cursor-pointer group ${!isSelectedMonth ? "opacity-30" : ""}`}
            >
              <div className="flex items-center justify-between">
                <Plus className="w-3 h-3 text-slate-200 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                <span className={`text-[11px] font-bold ${isToday ? "bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center -mr-1 shadow-sm shadow-primary/30" : "text-slate-400"}`}>
                  {format(day, "d")}
                </span>
              </div>
              
              <div className="flex flex-col gap-0.5 overflow-hidden mt-1">
                {dayEvents.slice(0, 3).map((ev, i) => {
                  const isTask = ev._ui_type === 'task' || ev.task_type;
                  const isCompany = ev._ui_type === 'company';
                  const isPersonal = ev._ui_type === 'personal';

                  let bgClass = "bg-slate-50 text-slate-600 border-slate-100";
                  if (ev.status === "completed") {
                    bgClass = "bg-emerald-50 text-emerald-600 border-emerald-100 line-through opacity-70";
                  } else {
                    if (isTask) bgClass = "bg-blue-50 text-blue-600 border-blue-100";
                    if (isCompany) bgClass = "bg-purple-50 text-purple-600 border-purple-100";
                    if (isPersonal) bgClass = "bg-indigo-50 text-indigo-600 border-indigo-100";
                  }

                  return (
                    <div 
                      key={i} 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEventClick(ev);
                      }}
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md truncate border shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:scale-[1.03] active:scale-[0.97] transition-all ${bgClass}`}
                      title={`${isCompany ? '[CÔNG TY] ' : ''}${ev.title}`}
                    >
                      {isCompany && "🏢 "}{ev.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[8px] font-bold text-slate-400 pl-1">
                    +{dayEvents.length - 3} thêm...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* QUICK ADD DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <Zap className="w-5 h-5 text-primary" /> Đặt lịch nhanh
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-[11px] font-bold uppercase text-slate-400">Nội dung công việc</Label>
              <Input 
                placeholder="Ví dụ: Gọi điện báo giá khách..." 
                className="rounded-xl border-slate-200 focus:border-primary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[11px] font-bold uppercase text-slate-400">Khách hàng</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="rounded-xl border-slate-200">
                  <SelectValue placeholder="Chọn khách hàng" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} - {c.facility_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-[11px] font-bold uppercase text-slate-400 text-center">Thời gian</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input 
                    type="time" 
                    className="pl-10 rounded-xl border-slate-200"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-[11px] font-bold uppercase text-slate-400 text-center">Loại việc</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="call">Cuộc gọi</SelectItem>
                    <SelectItem value="visit">Thăm khách</SelectItem>
                    <SelectItem value="quotation">Báo giá</SelectItem>
                    <SelectItem value="follow_up">Chăm sóc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-slate-900 hover:bg-primary text-white rounded-xl font-bold h-12 shadow-lg shadow-slate-200"
              onClick={handleCreateTask}
              disabled={loading}
            >
              {loading ? "Đang xử lý..." : "Xác nhận đặt lịch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK PREVIEW & DETAILS DIALOG */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl overflow-hidden p-0 border border-slate-100/60 shadow-2xl">
          {/* Header banner based on event type */}
          <div className={`p-6 text-white relative ${
            selectedEvent?._ui_type === 'company' 
              ? "bg-gradient-to-r from-purple-600 to-indigo-700" 
              : selectedEvent?._ui_type === 'task'
                ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                : "bg-gradient-to-r from-teal-600 to-emerald-600"
          }`}>
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-sm">
              {selectedEvent?._ui_type === 'company' ? "🏢 Sự kiện Công ty" : selectedEvent?._ui_type === 'task' ? "📞 Công việc CSKH" : "🤝 Lịch hẹn Cá nhân"}
            </span>
            <h3 className="text-lg font-black mt-3 leading-snug drop-shadow-sm">
              {selectedEvent?.title}
            </h3>
          </div>

          <div className="p-6 grid gap-5 bg-white">
            {/* Customer Details */}
            {(selectedEvent?.customer_id || selectedEvent?.customer) ? (
              (() => {
                const cId = selectedEvent.customer_id || selectedEvent.customer?.id;
                if (cId) {
                  return (
                    <div 
                      onClick={() => {
                        setPreviewCustomer({ id: cId });
                        setIsDetailDialogOpen(false);
                      }}
                      className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer group/cal-cust block"
                    >
                      <User className="w-5 h-5 text-slate-500 mt-0.5 group-hover/cal-cust:text-primary transition-colors" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Khách hàng liên quan</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5 group-hover/cal-cust:text-indigo-600 transition-colors">
                          {selectedEvent?.customer?.name || selectedEvent?.customer?.facility_name || selectedEvent?.customer_name || "Khách hàng"}
                        </p>
                        {(selectedEvent?.customer?.facility_name || selectedEvent?.customer?.phone) && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {selectedEvent?.customer?.facility_name && `🏥 ${selectedEvent?.customer?.facility_name}`}
                            {selectedEvent?.customer?.phone && ` • 📞 ${selectedEvent?.customer?.phone}`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      <User className="w-5 h-5 text-slate-500 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Khách hàng liên quan</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedEvent?.customer?.name || selectedEvent?.customer?.facility_name || selectedEvent?.customer_name || "Khách hàng"}
                        </p>
                        {(selectedEvent?.customer?.facility_name || selectedEvent?.customer?.phone) && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {selectedEvent?.customer?.facility_name && `🏥 ${selectedEvent?.customer?.facility_name}`}
                            {selectedEvent?.customer?.phone && ` • 📞 ${selectedEvent?.customer?.phone}`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
              })()
            ) : null}

            {/* Event Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-start gap-3">
                <Clock className="w-5 h-5 text-slate-500 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Thời gian hẹn</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    {selectedEvent && formatCalendarTime(selectedEvent.due_at || selectedEvent.starts_at || selectedEvent.starts_at_date)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-start gap-3">
                <Zap className="w-5 h-5 text-slate-500 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Trạng thái việc</p>
                  <div className="mt-1">
                    {selectedEvent?.status === 'completed' ? (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">✓ Xong</span>
                    ) : selectedEvent?.status === 'cancelled' ? (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md border border-rose-200">🚫 Huỷ</span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">⏳ Chờ làm</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description if any */}
            {selectedEvent?.description && (
              <div className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100/60">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ghi chú chi tiết</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                  {selectedEvent.description}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            {selectedEvent?._ui_type !== 'company' && selectedEvent?.status !== 'completed' && (
              <Button
                variant="outline"
                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-bold rounded-xl flex items-center gap-1.5 h-11 transition-all px-4"
                onClick={handleCompleteTask}
                disabled={loading}
              >
                <Check className="w-4 h-4" /> Hoàn thành
              </Button>
            )}
            
            {selectedEvent?._ui_type !== 'company' && (
              <Button
                variant="outline"
                className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200 font-bold rounded-xl flex items-center gap-1.5 h-11 transition-all px-4"
                onClick={handleDeleteTask}
                disabled={loading}
              >
                <Trash2 className="w-4 h-4" /> Xóa lịch
              </Button>
            )}

            <Button 
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-11 px-5"
              onClick={() => setIsDetailDialogOpen(false)}
            >
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CustomerPreviewDrawer
        customer={previewCustomer}
        open={!!previewCustomer}
        onOpenChange={(open) => !open && setPreviewCustomer(null)}

      />
    </div>
  );
};
