/**
 * Chuẩn hóa số điện thoại theo quy tắc CRM B2B của DESEMBRE:
 * - Loại bỏ khoảng trắng, dấu ".", "-", "(", ")"
 * - Chuyển đầu số +84 hoặc 84 về 0
 * - Chỉ giữ lại các chữ số
 */
export const normalizePhone = (phone?: string | null): string => {
  if (!phone) return "";

  // 1. Loại bỏ khoảng trắng và các ký tự phân cách phổ biến
  let cleaned = phone.replace(/[\s\.\-\(\)]/g, "");

  // 2. Xử lý mã quốc gia Việt Nam (+84 hoặc 84) chuyển về đầu 0
  if (cleaned.startsWith("+84")) {
    cleaned = "0" + cleaned.substring(3);
  } else if (cleaned.startsWith("84") && cleaned.length > 9) {
    // Chỉ thay thế nếu độ dài > 9 để tránh nhầm lẫn với số nội bộ hoặc số ngắn khác
    cleaned = "0" + cleaned.substring(2);
  }

  // 3. Chỉ giữ lại chữ số (loại bỏ các ký tự lạ khác nếu còn)
  cleaned = cleaned.replace(/[^0-9]/g, "");

  return cleaned;
};

/**
 * Ví dụ Test:
 * normalizePhone("091.234.5678") -> "0912345678"
 * normalizePhone("+84 912-345-678") -> "0912345678"
 * normalizePhone("84912345678") -> "0912345678"
 * normalizePhone("(024) 3.123.456") -> "0243123456"
 */
