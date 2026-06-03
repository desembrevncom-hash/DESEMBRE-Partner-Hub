import type {
  CalendarEventStatus,
  PersonalEventType,
  CompanyEventType,
  RegistrationStatus,
} from "@/types/calendar";

/**
 * Trả về chuỗi hiển thị tiếng Việt và màu sắc huy hiệu tương ứng với trạng thái lịch hẹn
 */
export function getEventStatusLabel(status: CalendarEventStatus): {
  label: string;
  colorClass: string;
  bgClass: string;
} {
  switch (status) {
    case "completed":
      return {
        label: "Đã hoàn tất",
        colorClass: "text-emerald-700",
        bgClass: "bg-emerald-50 border-emerald-200",
      };
    case "cancelled":
      return {
        label: "Đã hủy",
        colorClass: "text-rose-700",
        bgClass: "bg-rose-50 border-rose-200",
      };
    case "pending":
    default:
      return {
        label: "Chờ xử lý",
        colorClass: "text-amber-700",
        bgClass: "bg-amber-50 border-amber-200",
      };
  }
}

/**
 * Trả về tên hiển thị và biểu tượng/nội dung thân thiện cho từng phân loại sự kiện (Personal)
 */
export function getPersonalEventTypeLabel(type: PersonalEventType): {
  label: string;
  icon: string;
} {
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
    case "note":
    default:
      return { label: "Ghi chú lịch", icon: "📝" };
  }
}

/**
 * Trả về tên hiển thị và biểu tượng cho từng loại Sự kiện công ty (Company)
 */
export function getCompanyEventTypeLabel(type: CompanyEventType): { label: string; icon: string } {
  switch (type) {
    case "workshop":
      return { label: "Workshop", icon: "🏢" };
    case "training":
      return { label: "Đào tạo", icon: "🎓" };
    case "livestream":
      return { label: "Livestream", icon: "📱" };
    case "product_demo":
      return { label: "Demo sản phẩm", icon: "✨" };
    case "promotion":
      return { label: "Khuyến mãi", icon: "🎁" };
    case "internal_meeting":
      return { label: "Họp nội bộ", icon: "👥" };
    default:
      return { label: "Sự kiện", icon: "🏢" };
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

/**
 * Lấy nhãn và định dạng màu sắc cao cấp cho từng trạng thái đăng ký của khách mời
 */
export function getAttendeeStatusMeta(status: any): { label: string; badgeClass: string } {
  switch (status) {
    case "invited":
      return { label: "✉️ Đã mời", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" };
    case "registered":
      return { label: "📝 Đã đăng ký", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" };
    case "confirmed":
      return {
        label: "🤝 Đã xác nhận",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
      };
    case "attended":
      return {
        label: "✓ Đã tham gia",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold",
      };
    case "no_show":
      return { label: "✕ Không tham gia", badgeClass: "bg-rose-50 text-rose-700 border-rose-200" };
    case "cancelled":
      return {
        label: "🚫 Huỷ tham gia",
        badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
      };
    case "converted":
      return {
        label: "💰 Đã chốt đơn",
        badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-400 font-black",
      };
    default:
      return { label: "Chờ xử lý", badgeClass: "bg-slate-50 text-slate-600 border-slate-200" };
  }
}

/**
 * Lấy nhãn hiển thị cho trạng thái chiến dịch sự kiện công ty
 */
export function getCampaignStatusLabel(status: string): { label: string; colorClass: string } {
  switch (status) {
    case "draft":
      return { label: "📝 Nháp", colorClass: "text-slate-500 bg-slate-100" };
    case "published":
      return { label: "🟢 Đang mở đăng ký", colorClass: "text-emerald-600 bg-emerald-50" };
    case "closed":
      return { label: "🔴 Đã đóng đăng ký", colorClass: "text-rose-600 bg-rose-50" };
    case "completed":
      return { label: "✓ Đã hoàn thành", colorClass: "text-blue-600 bg-blue-50" };
    case "cancelled":
      return { label: "✕ Đã huỷ", colorClass: "text-slate-400 bg-slate-200 line-through" };
    default:
      return { label: "Không xác định", colorClass: "text-slate-400" };
  }
}
