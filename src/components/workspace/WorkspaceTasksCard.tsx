import React from "react";
import { CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getTaskTypeLabel, isTaskOverdue } from "@/lib/tasks";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface WorkspaceTasksCardProps {
  title: string;
  tasks: any[];
  icon: React.ReactNode;
  color: string;
  emptyMessage?: string;
}

export const WorkspaceTasksCard: React.FC<WorkspaceTasksCardProps> = ({ title, tasks, icon, color, emptyMessage = "Chưa có việc cần xử lý." }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full">
      <div className={`${color} p-4 text-white flex items-center justify-between`}>
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          {icon} {title}
        </h3>
        <Badge variant="secondary" className="bg-white/20 text-white border-none text-[10px]">
          {tasks.length}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-slate-50">
        {tasks.length > 0 ? (
          tasks.map(task => (
            <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-[13px] font-bold text-slate-800 line-clamp-1 group-hover:text-primary transition-colors">
                    {task.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                    {task.customer?.facility_name || task.lead?.facility_name || "N/A"}
                  </p>
                </div>
                <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-primary shrink-0" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px] font-bold px-1 py-0 bg-slate-50 text-slate-500 border-slate-200">
                    {getTaskTypeLabel(task.task_type)}
                  </Badge>
                  {isTaskOverdue(task.due_at, task.status) && (
                    <Badge className="bg-red-50 text-red-600 border-red-100 text-[9px] font-bold">Quá hạn</Badge>
                  )}
                </div>
                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {task.due_at ? format(new Date(task.due_at), "HH:mm dd/MM", { locale: vi }) : "N/A"}
                </span>
              </div>
            </div>
          ))
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
