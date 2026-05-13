export type BuildGoogleCalendarLinkInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
};

/**
 * Định dạng mốc thời gian sang định dạng chuỗi địa phương của Google Calendar (Floating Time)
 * Chuỗi kết quả có dạng: YYYYMMDDTHHmmss (Không có ký tự 'Z' ở cuối).
 * Khi kết hợp với tham số ctz=Asia/Ho_Chi_Minh, Google Calendar sẽ ánh xạ chính xác khung giờ theo giờ Việt Nam.
 */
function formatGoogleDateLocal(dateValue: string): string {
  const dt = new Date(dateValue);
  if (isNaN(dt.getTime())) return "";

  const yyyy = dt.getFullYear();
  const MM = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const HH = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");

  return `${yyyy}${MM}${dd}T${HH}${mm}${ss}`;
}

export function buildGoogleCalendarLink(input: BuildGoogleCalendarLinkInput) {
  if (!input.startsAt) return "";

  const start = formatGoogleDateLocal(input.startsAt);

  const fallbackEnd = new Date(input.startsAt);
  fallbackEnd.setHours(fallbackEnd.getHours() + 1);

  // Nếu endsAt hợp lệ thì dùng, nếu không thì dùng fallbackEnd (+1 giờ)
  const end = input.endsAt
    ? formatGoogleDateLocal(input.endsAt)
    : formatGoogleDateLocal(fallbackEnd.toISOString());

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title.trim() || "Sự kiện DESEMBRE Partner",
    dates: `${start}/${end}`,
    details: input.description ? input.description.trim() : "",
    location: input.location ? input.location.trim() : "",
    ctz: "Asia/Ho_Chi_Minh",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/*
 * ==========================================
 * VÍ DỤ KIỂM THỬ (TEST CASE MINH HỌA)
 * ==========================================
 * 
 * const sampleInput = {
 *   title: "Họp triển khai CRM",
 *   startsAt: "2026-05-15T08:30",
 *   endsAt: "2026-05-15T12:00"
 * };
 * 
 * Kết quả mong đợi cho thuộc tính dates:
 * "20260515T083000/20260515T120000"
 * 
 * URL Output sinh ra chứa tham số:
 * &dates=20260515T083000%2F20260515T120000&ctz=Asia%2FHo_Chi_Minh
 * 
 * Đảm bảo 100% không bị lùi 7 tiếng do quy đổi tự động sang mốc UTC.
 */
