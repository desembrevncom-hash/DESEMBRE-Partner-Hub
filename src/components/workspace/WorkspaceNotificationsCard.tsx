import React, { useState } from "react";
import { Bell, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useNavigate } from "@tanstack/react-router";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";

import { supabase } from "@/integrations/supabase/client";

interface WorkspaceNotificationsCardProps {
  notifications: any[];
  emptyMessage?: string;
  onRefresh?: () => void;
}

export const WorkspaceNotificationsCard: React.FC<WorkspaceNotificationsCardProps> = ({ 
  notifications, 
  emptyMessage = "Chưa có thông báo mới.",
  onRefresh
}) => {
  const navigate = useNavigate();
  const [previewCustomer, setPreviewCustomer] = useState<any | null>(null);

  const handleNotificationClick = async (n: any) => {
    // 1. Đánh dấu đã đọc
    if (!n.read_at) {
      try {
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", n.id);
        if (onRefresh) onRefresh();
      } catch (err) {
        console.error("Lỗi đánh dấu đã đọc thông báo:", err);
      }
    }

    // 2. Chuyển hướng hoặc mở Drawer
    if (n.customer_id) {
      // Nếu có customer_id, click mở drawer
      setPreviewCustomer({ id: n.customer_id });
    } else if (n.action_url) {
      // Nếu có action_url, ưu tiên action_url
      if (n.action_url.startsWith("http")) {
        window.open(n.action_url, "_blank");
      } else {
        navigate({ to: n.action_url });
      }
    } else if (n.entity_type && n.entity_id) {
      // Nếu chỉ có entity_type/entity_id, map đúng route
      const type = n.entity_type;
      const id = n.entity_id;
      if (type === "order" || type === "orders") {
        navigate({ to: `/orders/${id}` });
      } else if (type === "task" || type === "tasks" || type === "customer_task") {
        navigate({ to: `/tasks` });
      } else if (type === "event" || type === "company_event") {
        navigate({ to: `/calendar` });
      } else if (type === "customer" || type === "customers" || type === "lead") {
        setPreviewCustomer({ id });
      }
    }
  };

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
            <div 
              key={n.id} 
              onClick={() => handleNotificationClick(n)}
              className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer border-l-4 ${!n.read_at ? "border-l-purple-500 bg-purple-50/10" : "border-l-transparent"}`}
            >
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

      <CustomerPreviewDrawer
        customer={previewCustomer}
        open={!!previewCustomer}
        onOpenChange={(open) => !open && setPreviewCustomer(null)}

      />
    </div>
  );
};
