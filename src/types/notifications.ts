export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationStatus = "unread" | "read" | "dismissed";

export type NotificationType =
  | "lead_assigned"
  | "followup_due"
  | "followup_overdue"
  | "event_upcoming"
  | "task_overdue"
  | "duplicate_risk"
  | "channel_approval_required"
  | "order_attention"
  | "system";

export interface NotificationItem {
  id: string;
  recipient_user_id: string;
  actor_user_id?: string;
  customer_id?: string;
  related_id?: string;
  related_type?: string;
  notification_type: NotificationType;
  title: string;
  message?: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  deep_link?: string;
  metadata?: Record<string, any>;
  created_at: string;
  read_at?: string;
  dismissed_at?: string;
}

export interface NotificationsResponse {
  unread_count: number;
  notifications: NotificationItem[];
}
