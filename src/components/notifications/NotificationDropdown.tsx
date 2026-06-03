import React from "react";
import {
  Bell,
  UserPlus,
  CheckSquare,
  Zap,
  Package,
  Clock,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { NotificationItem, NotificationType } from "@/types/notifications";

interface NotificationDropdownProps {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  onMarkAllRead: () => void;
  onNotifClick: (n: NotificationItem) => void;
  onDismiss: (e: React.MouseEvent, n: NotificationItem) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  unreadCount,
  loading,
  onMarkAllRead,
  onNotifClick,
  onDismiss,
}) => {
  const getNotificationIcon = (type: NotificationType) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case "lead_assigned":
        return (
          <div className="p-2 bg-emerald-50 rounded-xl">
            <UserPlus className={`${iconClass} text-emerald-500`} />
          </div>
        );
      case "event_upcoming":
        return (
          <div className="p-2 bg-indigo-50 rounded-xl">
            <CalendarDays className={`${iconClass} text-indigo-500`} />
          </div>
        );
      case "task_overdue":
      case "followup_overdue":
        return (
          <div className="p-2 bg-red-50 rounded-xl">
            <AlertTriangle className={`${iconClass} text-red-500`} />
          </div>
        );
      case "channel_approval_required":
      case "duplicate_risk":
        return (
          <div className="p-2 bg-amber-50 rounded-xl">
            <ShieldAlert className={`${iconClass} text-amber-500`} />
          </div>
        );
      case "order_attention":
        return (
          <div className="p-2 bg-blue-50 rounded-xl">
            <Package className={`${iconClass} text-blue-500`} />
          </div>
        );
      case "system":
      default:
        return (
          <div className="p-2 bg-slate-50 rounded-xl">
            <Bell className={`${iconClass} text-slate-400`} />
          </div>
        );
    }
  };

  return (
    <DropdownMenuContent
      align="end"
      className="w-96 rounded-[32px] border-none shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl z-50"
    >
      <div className="flex items-center justify-between px-6 py-5 bg-slate-50/50 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            Thông báo mới
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Bạn có {unreadCount} cập nhật chưa đọc
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            disabled={loading}
            className="text-[10px] font-black h-8 px-3 text-indigo-600 hover:bg-indigo-50 rounded-xl"
          >
            ĐỌC TẤT CẢ
          </Button>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto no-scrollbar relative">
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => onNotifClick(n)}
              className={`flex items-start gap-4 px-6 py-4 cursor-pointer transition-all focus:bg-slate-50 border-b border-slate-50 last:border-0 ${n.status === "unread" ? "bg-indigo-50/20" : ""}`}
            >
              <div className="shrink-0">{getNotificationIcon(n.notification_type)}</div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span
                      className={`text-xs leading-tight font-bold truncate ${n.status === "unread" ? "text-slate-950 font-black" : "text-slate-600"}`}
                    >
                      {n.title}
                    </span>
                    {n.priority && n.priority !== "normal" && (
                      <span
                        className={`text-[9px] uppercase font-bold w-fit px-1.5 py-0.5 rounded-sm ${
                          n.priority === "urgent"
                            ? "bg-red-100 text-red-700"
                            : n.priority === "high"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {n.priority}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {n.status === "unread" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    )}
                  </div>
                </div>
                {n.message && (
                  <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3" />{" "}
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: vi })}
                  </span>
                  {(n.customer_id || n.deep_link) && (
                    <span className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1">
                      Chi tiết <ChevronRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="py-16 flex flex-col items-center justify-center text-slate-300">
            <Bell className="w-10 h-10 opacity-10 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Tất cả đều ổn thỏa
            </p>
          </div>
        )}
      </div>
    </DropdownMenuContent>
  );
};
