/**
 * Helper chuyên dụng xử lý nội dung động từ các mẫu tin nhắn (Message Templates).
 * Hỗ trợ nội suy các biến chuẩn hóa với cú pháp {{variable_name}}.
 */

export function renderTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  if (!template) return "";

  // Thay thế toàn bộ các biến khớp với định dạng {{ key }} (hỗ trợ cả khoảng trắng thừa)
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const val = variables[key];
    if (val === null || val === undefined) {
      return ""; // Fallback sang chuỗi rỗng nếu biến không được truyền giá trị
    }
    return String(val);
  });
}

/**
 * Danh sách các từ khóa chuẩn được hỗ trợ trên hệ thống CRM DESEMBRE.
 */
export const SUPPORTED_TEMPLATE_VARIABLES = [
  "customer_name",
  "event_title",
  "event_time",
  "event_location",
  "meeting_url",
  "sale_name",
  "calendar_link",
  "company_name",
];
