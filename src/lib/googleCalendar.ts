export interface GoogleCalendarInput {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
}

/**
 * Hàm hỗ trợ định dạng đối tượng Date sang chuỗi tương thích với tham số dates của Google Calendar.
 * Chuỗi kết quả có dạng chuẩn ISO-8601 nén: YYYYMMDDTHHMMSSZ (UTC time)
 */
const formatGCalDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

/**
 * Tạo URL "Add to Google Calendar" thuần túy (không dùng Google API, không yêu cầu OAuth)
 * Phục vụ việc mở tab mới điền sẵn thông tin sự kiện, tối ưu hóa quy trình chốt lịch CSKH.
 */
export function buildGoogleCalendarLink(input: GoogleCalendarInput): string {
  if (!input.startsAt) {
    return "";
  }

  const startDate = new Date(input.startsAt);
  
  // Nếu endsAt rỗng hoặc mốc kết thúc nhỏ hơn/bằng bắt đầu, tự động thiết lập thời gian kết thúc sau 1 giờ
  let endDate: Date;
  if (input.endsAt) {
    endDate = new Date(input.endsAt);
    if (isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }
  } else {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  const startStr = formatGCalDate(startDate);
  const endStr = formatGCalDate(endDate);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title.trim() || "Sự kiện DESEMBRE Partner",
    dates: `${startStr}/${endStr}`,
    ctz: "Asia/Ho_Chi_Minh",
  });

  if (input.description && input.description.trim()) {
    params.set("details", input.description.trim());
  }

  if (input.location && input.location.trim()) {
    params.set("location", input.location.trim());
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
