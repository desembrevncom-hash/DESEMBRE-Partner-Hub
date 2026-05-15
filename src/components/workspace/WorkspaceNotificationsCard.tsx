import React from "react";
import { Bell, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface WorkspaceNotificationsCardProps {
  notifications: any[];
  emptyMessage?: string;
}

export const WorkspaceNotificationsCard: React.FC<WorkspaceNotificationsCardProps> = ({ notifications, emptyMessage = "Chưa có thông báo mới." }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="bg-purple-600 p-4 text-white">
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          <Bell className="w-4 h-4" /> Thông báo mới
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-slate-50">
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div key={n.id} className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer border-l-4 ${!n.read_at ? "border-l-purple-500 bg-purple-50/10" : "border-l-transparent"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className={`text-[12px] leading-tight mb-1 ${!n.read_at ? "font-bold text-slate-900" : "font-medium text-slate-600"}`}>
                    {n.title}
                  </h4>
                  <span className="text-[10px] font-medium text-slate-400">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: vi })}
                  </span>
                </div>
                {!n.read_at && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1 shrink-0" />}
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center">
            <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
