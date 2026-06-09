import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { NotificationItem, NotificationsResponse } from "@/types/notifications";
import { toast } from "sonner";

export function useNotifications(pollIntervalMs = 30000) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      // setLoading(true); // Don't show loading on background polls
      const { data, error: rpcError } = await supabase.rpc("get_my_notifications", {
        p_limit: 30,
        p_status: null,
      });

      if (rpcError) throw rpcError;

      const rawNotifications = (res.notifications || []) as NotificationItem[];

      // Deduplicate: If there is a task_assigned notification and a lead_assigned notification for the same customer
      // created within a minute, hide the task_assigned notification to reduce noise.
      const processedNotifications = rawNotifications.filter((n) => {
        if (n.notification_type === "task_assigned" || n.title?.includes("Bạn có công việc mới")) {
          if (n.customer_id) {
            const hasAssignment = rawNotifications.some(
              (other) =>
                other.notification_type === "lead_assigned" &&
                other.customer_id === n.customer_id &&
                Math.abs(new Date(other.created_at).getTime() - new Date(n.created_at).getTime()) <
                  60000,
            );
            if (hasAssignment) return false;
          }
        }
        return true;
      });

      setNotifications(processedNotifications);

      // Adjust unread count to exclude hidden unread notifications
      const hiddenUnreadCount = rawNotifications.filter(
        (n) => !processedNotifications.includes(n) && n.status === "unread",
      ).length;

      setUnreadCount(Math.max(0, (res.unread_count || 0) - hiddenUnreadCount));
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch notifications:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch and polling
  useEffect(() => {
    fetchNotifications();

    if (!user) return;
    const intervalId = setInterval(() => {
      fetchNotifications();
    }, pollIntervalMs);

    return () => clearInterval(intervalId);
  }, [fetchNotifications, user, pollIntervalMs]);

  // Actions
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc("mark_notification_read", {
        p_notification_id: notificationId,
      });
      if (error) throw error;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, status: "read", read_at: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      toast.error("Lỗi cập nhật thông báo");
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw error;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          status: n.status === "unread" ? "read" : n.status,
          read_at: n.status === "unread" ? new Date().toISOString() : n.read_at,
        })),
      );
      setUnreadCount(0);
      toast.success("Đã đánh dấu đọc tất cả");
    } catch (err: any) {
      toast.error("Lỗi cập nhật tất cả thông báo");
    }
  };

  const dismissNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc("dismiss_notification", {
        p_notification_id: notificationId,
      });
      if (error) throw error;

      // Optimistic update
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      fetchNotifications(); // Refresh count properly
    } catch (err: any) {
      toast.error("Lỗi ẩn thông báo");
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
  };
}
