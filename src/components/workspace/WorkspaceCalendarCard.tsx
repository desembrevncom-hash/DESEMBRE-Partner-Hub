import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, User, Zap } from "lucide-react";
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

interface WorkspaceCalendarCardProps {
  events: any[];
  onRefresh?: () => void;
}

export const WorkspaceCalendarCard: React.FC<WorkspaceCalendarCardProps> = ({ events, onRefresh }) => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("call");

  useEffect(() => {
    async function fetchCustomers() {
      if (!user) return;
      const { data } = await supabase.from("customers").select("id, name, facility_name").eq("owner_sale_id", user.id).limit(100);
      setCustomers(data || []);
    }
    if (isDialogOpen) fetchCustomers();
  }, [isDialogOpen, user]);

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
    return events.filter(event => isSameDay(new Date(event.start_time || event.due_at), day));
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setIsDialogOpen(true);
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
                  if (isTask) bgClass = "bg-blue-50 text-blue-600 border-blue-100";
                  if (isCompany) bgClass = "bg-purple-50 text-purple-600 border-purple-100";
                  if (isPersonal) bgClass = "bg-indigo-50 text-indigo-600 border-indigo-100";

                  return (
                    <div 
                      key={i} 
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md truncate border shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${bgClass}`}
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
    </div>
  );
};
