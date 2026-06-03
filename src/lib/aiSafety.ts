export const BANNED_PHRASES = [
  "trị dứt điểm",
  "cam kết khỏi",
  "chữa khỏi",
  "khỏi 100%",
  "điều trị bệnh",
  "thay thế thuốc",
  "không tái phát",
  "hiệu quả vĩnh viễn",
  "đảm bảo hết nám",
  "đảm bảo hết mụn",
];

/**
 * Scans text for banned medical claims.
 * Returns an array of matched phrases.
 */
export function detectBannedPhrases(text: string): string[] {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lowerText.includes(phrase.toLowerCase()));
}

/**
 * Sanitizes the AI response text by trimming and basic formatting.
 */
export function sanitizeAiResponse(text: string): string {
  if (!text) return "";
  return text.trim();
}

/**
 * Generates structured fallback messages based on safety block reason.
 */
export function buildSafeFallback(
  reason: "no_retrieval" | "low_confidence" | "medical_claim" | "unsupported_product",
  extraInfo?: string,
): string {
  switch (reason) {
    case "no_retrieval":
      return "Hiện chưa có đủ dữ liệu chính thức trong Cẩm nang sản phẩm để tư vấn nội dung này.";
    case "low_confidence":
      return `Hiện chưa có đủ dữ liệu chính thức trong Cẩm nang sản phẩm để tư vấn nội dung này. (Độ tin cậy của thông tin tìm thấy không đạt yêu cầu).`;
    case "medical_claim":
      return "Nội dung AI tạo ra có nguy cơ chứa claim y khoa nên đã được chặn. Vui lòng kiểm tra lại Product Knowledge hoặc viết lại câu hỏi.";
    case "unsupported_product":
      return extraInfo
        ? `Phản hồi đã bị chặn do nhắc đến sản phẩm không có trong tài liệu đối chiếu: ${extraInfo}. Vui lòng viết lại câu hỏi.`
        : "Phản hồi đã bị chặn do nhắc đến sản phẩm không có trong tài liệu đối chiếu. Vui lòng viết lại câu hỏi.";
    default:
      return "Yêu cầu tư vấn không thể hoàn thành do vi phạm quy tắc an toàn thông tin.";
  }
}
