export type CalendarEventStatus = "pending" | "completed" | "cancelled";

export type PersonalEventType =
  | "follow_up"
  | "appointment"
  | "check_in"
  | "demo"
  | "delivery"
  | "payment"
  | "note"
  | "meeting"
  | "internal"
  | "reminder"
  | "customer_visit";

export type CompanyEventType =
  | "workshop"
  | "training"
  | "livestream"
  | "product_demo"
  | "promotion"
  | "internal_meeting";

// Lịch hẹn / Follow-up cá nhân
export interface PersonalEvent {
  id: string;
  customer_id?: string | null;
  order_id?: string | null;
  assigned_sale_id?: string | null;
  created_by?: string | null;
  owner_user_id?: string | null;
  assigned_user_ids?: string[] | null;
  visibility?: "private" | "team" | "company";
  color?: string | null;
  is_all_day?: boolean;

  title: string;
  description?: string | null;
  event_type: PersonalEventType;
  status: CalendarEventStatus;

  starts_at: string;
  ends_at?: string | null;

  remind_before_minutes: number;
  reminder_sent_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;

  created_at: string;
  updated_at: string;

  // Enrichment fields for UI
  customer_name?: string;
  _is_db_task?: boolean;
}

// Chiến dịch / Sự kiện Công ty (Admin tạo)
export interface CompanyEvent {
  id: string;
  title: string;
  description?: string | null;
  event_type: CompanyEventType;
  status: "draft" | "published" | "closed" | "completed" | "cancelled";

  starts_at: string;
  ends_at?: string | null;

  location?: string | null;
  meeting_url?: string | null;
  capacity?: number | null;
  registration_deadline?: string | null;

  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Các trường đồng bộ Google Calendar
  google_calendar_event_id?: string | null;
  google_calendar_html_link?: string | null;
  google_sync_status?: "not_synced" | "synced" | "failed" | "cancelled" | null;
  google_synced_at?: string | null;
  google_sync_error?: string | null;
  customer_id?: string | null;

  // Tracking khi hủy sự kiện
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;

  // UI helper: danh sách đăng ký (thường join từ bảng event_registrations)
  registrations?: EventRegistration[];
}

export type RegistrationStatus =
  | "invited" // Đã mời
  | "registered" // Đã đăng ký
  | "confirmed" // Đã xác nhận tham gia
  | "attended" // Đã tham gia
  | "no_show" // Không tham gia
  | "cancelled" // Huỷ tham gia
  | "converted"; // Đã chuyển thành đơn hàng

// Đăng ký tham dự sự kiện
export interface EventRegistration {
  id: string;
  event_id: string;
  customer_id?: string | null;

  registered_by?: string | null;
  assigned_sale_id?: string | null;

  customer_name?: string | null;
  customer_phone?: string | null;
  customer_business_name?: string | null;
  attendee_email?: string | null;

  status: RegistrationStatus;
  note?: string | null;

  checked_in_at?: string | null;
  converted_order_id?: string | null;

  created_at: string;
  updated_at: string;
  added_by_sale_name?: string | null;
}

// Union type để dùng chung trên UI Calendar
export type UnifiedCalendarEvent =
  | (PersonalEvent & { _ui_type: "personal" })
  | (CompanyEvent & { _ui_type: "company" });
