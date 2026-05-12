export type CalendarEventStatus = "pending" | "completed" | "cancelled";

export type CalendarEventType = 
  | "follow_up" 
  | "appointment" 
  | "check_in" 
  | "demo" 
  | "delivery" 
  | "payment" 
  | "note"
  | "company_event";

export interface CalendarEvent {
  id: string;
  customer_id?: string | null;
  order_id?: string | null;
  assigned_sale_id?: string | null;
  created_by?: string | null;
  
  title: string;
  description?: string | null;
  event_type: CalendarEventType;
  status: CalendarEventStatus;
  
  starts_at: string; // ISO string
  ends_at?: string | null; // ISO string
  
  remind_before_minutes: number;
  reminder_sent_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  
  created_at: string;
  updated_at: string;

  // Thuộc tính mở rộng để UI hiển thị tiện lợi sau khi enrich/join với bảng khách hàng/user
  customer_name?: string;
  assigned_sale_name?: string;
  attendees?: EventAttendee[];
}

export interface EventAttendee {
  id: string;
  customer_id: string;
  customer_name: string;
  phone?: string | null;
  added_by_sale_id: string;
  added_by_sale_name: string;
  status: "registered" | "checked_in";
  added_at: string;
}
