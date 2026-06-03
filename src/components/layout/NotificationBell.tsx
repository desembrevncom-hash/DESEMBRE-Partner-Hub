import React, { useState } from "react";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { NotificationItem } from "@/types/notifications";

export function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    fetchNotifications,
  } = useNotifications(30000);

  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);

  const handleNotifClick = async (n: NotificationItem) => {
    try {
      if (n.status === "unread") {
        await markAsRead(n.id);
      }

      // Priority 1: Customer Drawer (if customer_id exists)
      if (n.customer_id) {
        setPreviewCustomerId(n.customer_id);
      }
      // Priority 2: Deep Link (if action_url / deep_link exists)
      else if (n.deep_link) {
        navigate({ to: n.deep_link });
      }
    } catch (e: any) {
      console.error("Error handling notification click:", e);
    }
  };

  const handleDismiss = async (e: React.MouseEvent, n: NotificationItem) => {
    e.stopPropagation();
    await dismissNotification(n.id);
  };

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) fetchNotifications();
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 hover:bg-slate-100 rounded-xl transition-all border border-transparent hover:border-slate-200 shrink-0"
          >
            <Bell
              className={`w-5 h-5 ${unreadCount > 0 ? "text-indigo-600 animate-pulse" : "text-slate-400"}`}
            />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          onMarkAllRead={markAllAsRead}
          onNotifClick={handleNotifClick}
          onDismiss={handleDismiss}
        />
      </DropdownMenu>

      <CustomerPreviewDrawer
        customer={{ id: previewCustomerId }}
        open={!!previewCustomerId}
        onOpenChange={(o) => !o && setPreviewCustomerId(null)}
      />
    </>
  );
}
