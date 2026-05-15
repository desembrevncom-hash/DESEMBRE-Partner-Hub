import React from "react";
import { CheckCircle2, Clock, ChevronRight, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getTaskTypeLabel, isTaskOverdue } from "@/lib/tasks";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface WorkspaceTasksCardProps {
  title: string;
  items: any[];
  icon: React.ReactNode;
  color: string;
  emptyMessage?: string;
}

export const WorkspaceTasksCard: React.FC<WorkspaceTasksCardProps> = ({ title, items = [], icon, color, emptyMessage = "Chưa có việc cần xử lý." }) => {
  // Sắp xếp items theo thời gian
  const sortedItems = [...(items || [])].sort((a, b) => {
    const dateA = new Date(a.due_at || a.start_time || 0).getTime();
    const dateB = new Date(b.due_at || b.start_time || 0).getTime();
    return dateA - dateB;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full">
      <div className={`${color} p-4 text-white flex items-center justify-between`}>
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          {icon} {title}
        </h3>
        <Badge variant="secondary" className="bg-white/20 text-white border-none text-[10px]">
          {items.length}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-slate-50">
        {sortedItems.length > 0 ? (
          sortedItems.map((item, idx) => {
            const isAppointment = !!item.start_time;
            const time = item.due_at || item.start_time;
            
            return (
              <div key={item.id || idx} className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[13px] font-bold text-slate-800 line-clamp-1 group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                      {item.customer?.facility_name || item.lead?.facility_name || item.location || "N/A"}
                    </p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-primary shrink-0" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isAppointment ? (
                      <Badge variant="outline" className="text-[9px] font-bold px-1 py-0 bg-indigo-50 text-indigo-600 border-indigo-100">
                        <Calendar className="w-2.5 h-2.5 mr-1" /> Lịch hẹn
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] font-bold px-1 py-0 bg-slate-50 text-slate-500 border-slate-200">
                        {getTaskTypeLabel(item.task_type)}
                      </Badge>
                    )}
                    {!isAppointment && isTaskOverdue(item.due_at, item.status) && (
                      <Badge className="bg-red-50 text-red-600 border-red-100 text-[9px] font-bold">Quá hạn</Badge>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {time ? format(new Date(time), "HH:mm dd/MM", { locale: vi }) : "N/A"}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
