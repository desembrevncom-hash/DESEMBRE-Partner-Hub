import React, { useState } from "react";
import { 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Calendar, 
  Circle, 
  XCircle, 
  PlayCircle,
  Check, 
  X, 
  RotateCcw,
  Loader2 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getTaskTypeLabel, isTaskOverdue, getTaskStatusLabel } from "@/lib/tasks";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface WorkspaceTasksCardProps {
  title: string;
  items: any[];
  icon: React.ReactNode;
  color: string;
  emptyMessage?: string;
  onRefresh?: () => void;
}

export const WorkspaceTasksCard: React.FC<WorkspaceTasksCardProps> = ({ 
  title, 
  items = [], 
  icon, 
  color, 
  emptyMessage = "Chưa có việc cần xử lý.",
  onRefresh
}) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Sắp xếp items theo thời gian
  const sortedItems = [...(items || [])].sort((a, b) => {
    const dateA = new Date(a.due_at || a.starts_at || 0).getTime();
    const dateB = new Date(b.due_at || b.starts_at || 0).getTime();
    return dateA - dateB;
  });

  const handleUpdateStatus = async (item: any, isAppointment: boolean, newStatus: string) => {
    if (!item.id) return;
    setUpdatingId(item.id);
    const table = isAppointment ? 'calendar_events' : 'customer_tasks';
    const statusField = isAppointment ? 'status' : 'status';
    
    try {
      const { error } = await supabase
        .from(table)
        .update({ [statusField]: newStatus })
        .eq('id', item.id);

      if (error) throw error;
      
      const statusText = newStatus === 'completed' ? 'Hoàn thành' : newStatus === 'cancelled' ? 'Hủy bỏ' : 'Chờ xử lý';
      toast.success(`Đã cập nhật trạng thái việc làm thành: ${statusText}!`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(`Không thể cập nhật trạng thái: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

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
            const isAppointment = !!item.starts_at;
            const time = item.due_at || item.starts_at;
            const isUpdating = updatingId === item.id;
            
            // Xác định trạng thái để render UI
            const status = item.status || "pending";
            const isCompleted = status === "completed";
            const isCancelled = status === "cancelled";
            const isInProgress = status === "in_progress";

            return (
              <div 
                key={item.id || idx} 
                className={`p-4 transition-all group flex flex-col gap-2 relative ${
                  isCompleted ? "bg-emerald-50/20 hover:bg-emerald-50/30" : 
                  isCancelled ? "bg-rose-50/10 hover:bg-rose-50/20" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* CỘT TRÁI: CHECKBOX TRỰC QUAN */}
                  <div className="shrink-0 mt-0.5">
                    {isUpdating ? (
                      <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircle2 
                        className="w-5 h-5 text-emerald-500 fill-emerald-50 cursor-pointer hover:scale-110 transition-transform" 
                        onClick={() => handleUpdateStatus(item, isAppointment, "pending")}
                        title="Đã hoàn thành. Click để khôi phục lại."
                      />
                    ) : isCancelled ? (
                      <XCircle 
                        className="w-5 h-5 text-rose-500 fill-rose-50 cursor-pointer hover:scale-110 transition-transform" 
                        onClick={() => handleUpdateStatus(item, isAppointment, "pending")}
                        title="Đã hủy. Click để khôi phục lại."
                      />
                    ) : isInProgress ? (
                      <PlayCircle 
                        className="w-5 h-5 text-amber-500 fill-amber-50 cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => handleUpdateStatus(item, isAppointment, "completed")}
                        title="Đang xử lý. Click để hoàn thành nhanh."
                      />
                    ) : (
                      <Circle 
                        className="w-5 h-5 text-slate-300 hover:text-emerald-500 hover:fill-emerald-50 cursor-pointer hover:scale-110 transition-transform" 
                        onClick={() => handleUpdateStatus(item, isAppointment, "completed")}
                        title="Chờ xử lý. Click để hoàn thành nhanh."
                      />
                    )}
                  </div>

                  {/* THÔNG TIN CHÍNH */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-[13px] font-bold transition-colors line-clamp-1 ${
                        isCompleted ? "text-slate-400 line-through" : 
                        isCancelled ? "text-rose-400 line-through" : "text-slate-800"
                      }`}>
                        {item.title}
                      </h4>
                      <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-primary shrink-0 self-center" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                      🏢 {item.customer?.facility_name || item.lead?.facility_name || item.location || "N/A"}
                    </p>
                  </div>
                </div>

                {/* DÒNG TIÊU ĐỀ PHỤ / CÁC BADGE TRẠNG THÁI */}
                <div className="mt-1 pl-8 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Loại lịch */}
                    {isAppointment ? (
                      <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 bg-indigo-50 text-indigo-600 border-indigo-100 uppercase tracking-wider">
                        <Calendar className="w-2.5 h-2.5 mr-1" /> Lịch hẹn
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 bg-slate-50 text-slate-500 border-slate-200 uppercase tracking-wider">
                        {getTaskTypeLabel(item.task_type)}
                      </Badge>
                    )}

                    {/* Trạng thái chữ */}
                    <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 border uppercase tracking-wider ${
                      isCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                      isCancelled ? "bg-rose-50 text-rose-700 border-rose-100" :
                      isInProgress ? "bg-amber-50 text-amber-700 border-amber-100" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                      {getTaskStatusLabel(status)}
                    </Badge>

                    {/* Quá hạn */}
                    {!isAppointment && isTaskOverdue(item.due_at, item.status) && (
                      <Badge className="bg-red-50 text-red-600 border-red-100 text-[9px] font-bold uppercase tracking-wider animate-pulse">Quá hạn</Badge>
                    )}
                  </div>

                  <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    {time ? format(new Date(time), "HH:mm dd/MM", { locale: vi }) : "N/A"}
                  </span>
                </div>

                {/* THAO TÁC NHANH (QUICK ACTIONS HOVER) */}
                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 shadow-sm border border-slate-100 rounded-lg p-1 flex gap-1 z-10">
                  {!isCompleted && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="w-6 h-6 rounded-md hover:bg-emerald-50 hover:text-emerald-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStatus(item, isAppointment, "completed");
                      }}
                      title="Hoàn thành việc"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {!isCancelled && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="w-6 h-6 rounded-md hover:bg-rose-50 hover:text-rose-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStatus(item, isAppointment, "cancelled");
                      }}
                      title="Hủy/Xóa việc"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {(isCompleted || isCancelled) && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="w-6 h-6 rounded-md hover:bg-slate-100 hover:text-slate-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStatus(item, isAppointment, "pending");
                      }}
                      title="Khôi phục lại"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  )}
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
