import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "lead_assigned"
  | "customer_assigned"
  | "task_assigned"
  | "follow_up_reminder"
  | "marketing_update"
  | "handoff_ready"
  | "system_alert";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface CreateNotificationParams {
  recipient_user_id: string;
  title: string;
  message?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  created_by?: string;
}

/**
 * Tạo một thông báo mới trong hệ thống
 */
export async function createNotification(params: CreateNotificationParams) {
  const { data, error } = await supabase
    .from("notifications")
    .insert([
      {
        recipient_user_id: params.recipient_user_id,
        title: params.title,
        message: params.message,
        type: params.type,
        priority: params.priority || "normal",
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        action_url: params.action_url,
        created_by: params.created_by,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating notification:", error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Đánh dấu một thông báo là đã đọc
 */
export async function markNotificationAsRead(notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    console.error("Error marking notification as read:", error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

/**
 * Đánh dấu tất cả thông báo của người dùng hiện tại là đã đọc
 */
export async function markAllNotificationsAsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", userId)
    .is("read_at", null);

  if (error) {
    console.error("Error marking all notifications as read:", error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

/**
 * Lấy số lượng thông báo chưa đọc của người dùng
 */
export async function getUnreadNotificationCount(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .is("read_at", null)
    .is("dismissed_at", null);

  if (error) {
    console.error("Error getting unread notification count:", error);
    return 0;
  }

  return count || 0;
}
