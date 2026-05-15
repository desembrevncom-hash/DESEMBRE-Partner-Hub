import React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface WorkspaceCalendarCardProps {
  events: any[];
}

export const WorkspaceCalendarCard: React.FC<WorkspaceCalendarCardProps> = ({ events }) => {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

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
              className={`bg-white min-h-[80px] p-1.5 flex flex-col gap-1 transition-colors hover:bg-slate-50/80 ${!isSelectedMonth ? "opacity-30" : ""}`}
            >
              <span className={`text-[11px] font-bold self-end ${isToday ? "bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center -mr-1" : "text-slate-400"}`}>
                {format(day, "d")}
              </span>
              
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev, i) => (
                  <div 
                    key={i} 
                    className={`text-[8px] font-bold px-1 py-0.5 rounded truncate border ${ev.task_type ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
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
    </div>
  );
};
