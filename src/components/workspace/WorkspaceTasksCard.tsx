import React, { useState } from "react";
import { 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Calendar, 
  Circle, 
  XCircle, 
  PlayCircle,
  MoreHorizontal,
  Play,
  Check,
  PhoneOff,
  UserX,
  Heart,
  CalendarClock,
  ArrowRightLeft
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getTaskTypeLabel, isTaskOverdue, getTaskStatusLabel } from "@/lib/tasks";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskActionDialog } from "./TaskActionDialog";

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
  const [previewCustomer, setPreviewCustomer] = useState<any | null>(null);
  const [taskAction, setTaskAction] = useState<{ task: any; action: string } | null>(null);

  // Sắp xếp items theo thời gian
  const sortedItems = [...(items || [])].sort((a, b) => {
    const dateA = new Date(a.due_at || a.starts_at || 0).getTime();
    const dateB = new Date(b.due_at || b.starts_at || 0).getTime();
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
            const isAppointment = !!item.starts_at;
            const time = item.due_at || item.starts_at;
            
            // Xác định trạng thái để render UI
            const status = item.status || "pending";
            const isCompleted = status === "completed";
            const isCancelled = status === "cancelled";
            const isInProgress = status === "in_progress";

            const cId = item.customer_id || item.customer?.id;
            const lId = item.lead_id || item.lead?.id;
            const hasLink = !!cId || !!lId;

            const handleClickRow = () => {
              if (cId) {
                setPreviewCustomer({ id: cId });
              } else if (lId) {
                setPreviewCustomer({ id: lId });
              } else {
                alert(`📋 Chi tiết công việc:\n- Tiêu đề: ${item.title}\n- Loại: ${getTaskTypeLabel(item.task_type)}\n- Trạng thái: ${getTaskStatusLabel(status)}\n- Hạn chót: ${time ? format(new Date(time), "HH:mm dd/MM/yyyy", { locale: vi }) : "N/A"}\n- Mô tả: ${item.description || "Không có mô tả"}`);
              }
            };

            return (
              <div 
                key={item.id || idx} 
                onClick={handleClickRow}
                className={`p-4 transition-all group flex flex-col gap-2 relative cursor-pointer ${
                  isCompleted ? "bg-emerald-50/20 hover:bg-emerald-50/30" : 
                  isCancelled ? "bg-rose-50/10 hover:bg-rose-50/20" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* CỘT TRÁI: CHECKBOX TRỰC QUAN */}
                    <div className="shrink-0 mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50" />
                      ) : isCancelled ? (
                        <XCircle className="w-5 h-5 text-rose-500 fill-rose-50" />
                      ) : isInProgress ? (
                        <PlayCircle className="w-5 h-5 text-blue-500 fill-blue-50" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </div>

                    {/* THÔNG TIN CHÍNH */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <h4 className={`text-[13px] font-bold transition-colors line-clamp-1 ${
                          isCompleted ? "text-slate-400 line-through" : 
                          isCancelled ? "text-rose-400 line-through" : "text-slate-800"
                        }`}>
                          {item.title}
                        </h4>
                        {hasLink && <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-primary shrink-0 self-center" />}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                        🏢 {item.customer?.facility_name || item.lead?.facility_name || item.location || "Spa tự do"}
                      </p>
                    </div>
                  </div>

                  {/* DROP DOWN MENU TRIGGER */}
                  {!isAppointment && (
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg hover:bg-slate-100">
                            <MoreHorizontal className="w-4 h-4 text-slate-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setTaskAction({ task: item, action: "start" })}>
                            <Play className="w-3.5 h-3.5 mr-2 text-blue-500" /> Bắt đầu xử lý
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTaskAction({ task: item, action: "completed" })}>
                            <Check className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Hoàn thành
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTaskAction({ task: item, action: "no_answer" })}>
                            <PhoneOff className="w-3.5 h-3.5 mr-2 text-red-500" /> Không nghe máy
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTaskAction({ task: item, action: "wrong_number" })}>
                            <UserX className="w-3.5 h-3.5 mr-2 text-slate-500" /> Sai số
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTaskAction({ task: item, action: "interested" })}>
                            <Heart className="w-3.5 h-3.5 mr-2 text-pink-500" /> Khách quan tâm
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTaskAction({ task: item, action: "call_back_later" })}>
                            <CalendarClock className="w-3.5 h-3.5 mr-2 text-amber-500" /> Hẹn gọi lại
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTaskAction({ task: item, action: "transfer_to_sale" })}>
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-2 text-indigo-500" /> Cần chuyển Sale
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
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
                      isInProgress ? "bg-blue-50 text-blue-700 border-blue-100" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                      {getTaskStatusLabel(status)}
                    </Badge>

                    {/* Quá hạn */}
                    {!isAppointment && isTaskOverdue(item.due_at, item.status) && (
                      <Badge className="bg-red-50 text-red-655 border-red-100 text-[9px] font-bold uppercase tracking-wider">Quá hạn</Badge>
                    )}
                  </div>

                  <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
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

      <CustomerPreviewDrawer
        customer={previewCustomer}
        open={!!previewCustomer}
        onOpenChange={(open) => !open && setPreviewCustomer(null)}

      />

      <TaskActionDialog 
        taskAction={taskAction}
        onClose={() => setTaskAction(null)}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
