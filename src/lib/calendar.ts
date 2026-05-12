import type { CalendarEventStatus, CalendarEventType } from "@/types/calendar";

/**
 * Trả về chuỗi hiển thị tiếng Việt và màu sắc huy hiệu tương ứng với trạng thái lịch hẹn
 */
export function getEventStatusLabel(status: CalendarEventStatus): { label: string; colorClass: string; bgClass: string } {
  switch (status) {
    case "completed":
      return { label: "Đã hoàn tất", colorClass: "text-emerald-700", bgClass: "bg-emerald-50 border-emerald-200" };
    case "cancelled":
      return { label: "Đã hủy", colorClass: "text-rose-700", bgClass: "bg-rose-50 border-rose-200" };
    case "pending":
    default:
      return { label: "Chờ xử lý", colorClass: "text-amber-700", bgClass: "bg-amber-50 border-amber-200" };
  }
}

/**
 * Trả về tên hiển thị và biểu tượng/nội dung thân thiện cho từng phân loại sự kiện
 */
export function getEventTypeLabel(type: CalendarEventType): { label: string; icon: string } {
  switch (type) {
    case "follow_up":
      return { label: "Follow-up KH", icon: "📞" };
    case "appointment":
      return { label: "Lịch hẹn Spa", icon: "🤝" };
    case "check_in":
      return { label: "Check-in CSKH", icon: "📍" };
    case "demo":
      return { label: "Demo sản phẩm", icon: "✨" };
    case "delivery":
      return { label: "Giao hàng", icon: "🚚" };
    case "payment":
      return { label: "Nhắc thanh toán", icon: "💰" };
    case "company_event":
      return { label: "Sự kiện công ty", icon: "🏢" };
    case "note":
    default:
      return { label: "Ghi chú lịch", icon: "📝" };
  }
}

/**
 * Kiểm tra xem một sự kiện trạng thái pending có bị trễ hạn (overdue) so với mốc thời gian hiện tại hay không
 */
export function isEventOverdue(startsAt: string, status: CalendarEventStatus): boolean {
  if (status !== "pending") return false;
  try {
    const eventTime = new Date(startsAt).getTime();
    const now = Date.now();
    return eventTime < now;
  } catch {
    return false;
  }
}

/**
 * Định dạng chuỗi thời gian ISO sang dạng giờ/phút/ngày thân thiện của Việt Nam (VD: 14:30 - 12/05/2026)
 */
export function formatCalendarTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}

/**
 * Lấy mốc thời gian nhắc nhở mặc định (30 phút trước sự kiện)
 */
export function getDefaultReminderMinutes(): number {
  return 30;
}
