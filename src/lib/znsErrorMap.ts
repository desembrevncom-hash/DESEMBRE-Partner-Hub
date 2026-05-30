// ────────────────────────────────────────────────────────────────────────────
// ZNS Error Code Map
// Maps internal / Zalo API error codes into normalized error codes used across
// the Edge Functions and the Admin Delivery Logs UI for consistent debugging.
// ────────────────────────────────────────────────────────────────────────────

export type ZnsErrorCode =
  | "TOKEN_EXPIRED"
  | "TOKEN_REFRESH_FAILED"
  | "INVALID_TEMPLATE"
  | "MISSING_PHONE"
  | "INVALID_PHONE"
  | "MISSING_PARAMS"
  | "OPT_OUT_BLOCKED"
  | "SENDER_UNHEALTHY"
  | "SENDER_DEGRADED"
  | "FORBIDDEN_ROLE"
  | "RATE_LIMIT"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_5XX"
  | "PROVIDER_REJECTED"
  | "DUPLICATE_BLOCKED"
  | "UNKNOWN_PROVIDER_ERROR";

/** Error codes that warrant retry — transient failures only */
export const RETRYABLE_ERROR_CODES = new Set<ZnsErrorCode>([
  "RATE_LIMIT",
  "PROVIDER_TIMEOUT",
  "PROVIDER_5XX",
  "TOKEN_REFRESH_FAILED",
]);

/** Error codes that are permanent — never retry */
export const NON_RETRYABLE_ERROR_CODES = new Set<ZnsErrorCode>([
  "OPT_OUT_BLOCKED",
  "MISSING_PHONE",
  "INVALID_PHONE",
  "INVALID_TEMPLATE",
  "MISSING_PARAMS",
  "SENDER_UNHEALTHY",
  "SENDER_DEGRADED",
  "FORBIDDEN_ROLE",
  "DUPLICATE_BLOCKED",
  "PROVIDER_REJECTED",
]);

export function isRetryable(code: ZnsErrorCode): boolean {
  return RETRYABLE_ERROR_CODES.has(code);
}

/** Map Zalo API numeric error codes to normalized codes */
export function mapZaloApiError(zaloErrorCode: number, message?: string): ZnsErrorCode {
  // Reference: Zalo Open API ZNS error codes
  switch (zaloErrorCode) {
    case -201:
    case -202:
      return "TOKEN_EXPIRED";
    case -100:
      return "INVALID_TEMPLATE";
    case -124:
      return "INVALID_PHONE";
    case -106:
      return "RATE_LIMIT";
    case -97:
      return "PROVIDER_REJECTED";
    default:
      if (zaloErrorCode >= 500) return "PROVIDER_5XX";
      if (message?.toLowerCase().includes("timeout")) return "PROVIDER_TIMEOUT";
      return "UNKNOWN_PROVIDER_ERROR";
  }
}

/** Human-readable Vietnamese labels for each error code */
export const ERROR_CODE_LABELS: Record<ZnsErrorCode, string> = {
  TOKEN_EXPIRED: "Token hết hạn",
  TOKEN_REFRESH_FAILED: "Làm mới token thất bại",
  INVALID_TEMPLATE: "Template không hợp lệ",
  MISSING_PHONE: "Thiếu số điện thoại",
  INVALID_PHONE: "Số điện thoại sai định dạng",
  MISSING_PARAMS: "Thiếu tham số bắt buộc",
  OPT_OUT_BLOCKED: "Khách hàng từ chối nhận tin",
  SENDER_UNHEALTHY: "Tài khoản gửi lỗi",
  SENDER_DEGRADED: "Tài khoản gửi bị hạn chế (Circuit Breaker)",
  FORBIDDEN_ROLE: "Không đủ quyền",
  RATE_LIMIT: "Vượt giới hạn tần suất",
  PROVIDER_TIMEOUT: "Nhà cung cấp phản hồi chậm (Timeout)",
  PROVIDER_5XX: "Lỗi máy chủ nhà cung cấp",
  PROVIDER_REJECTED: "Nhà cung cấp từ chối tin nhắn",
  DUPLICATE_BLOCKED: "Tin trùng lặp (đã gửi gần đây)",
  UNKNOWN_PROVIDER_ERROR: "Lỗi không xác định từ nhà cung cấp",
};

/** CSS color class for each status/code displayed in UI */
export const ERROR_CODE_COLORS: Partial<Record<ZnsErrorCode, string>> = {
  RATE_LIMIT: "text-amber-700 bg-amber-50",
  PROVIDER_TIMEOUT: "text-amber-700 bg-amber-50",
  PROVIDER_5XX: "text-rose-700 bg-rose-50",
  PROVIDER_REJECTED: "text-rose-700 bg-rose-50",
  TOKEN_EXPIRED: "text-orange-700 bg-orange-50",
  TOKEN_REFRESH_FAILED: "text-orange-700 bg-orange-50",
  OPT_OUT_BLOCKED: "text-slate-700 bg-slate-100",
  MISSING_PHONE: "text-slate-700 bg-slate-100",
  MISSING_PARAMS: "text-purple-700 bg-purple-50",
  DUPLICATE_BLOCKED: "text-blue-700 bg-blue-50",
  SENDER_UNHEALTHY: "text-rose-700 bg-rose-50",
  SENDER_DEGRADED: "text-rose-800 bg-rose-100",
  FORBIDDEN_ROLE: "text-slate-600 bg-slate-100",
};

export const STATUS_COLORS: Record<string, string> = {
  sent: "text-emerald-700 bg-emerald-50",
  delivered: "text-emerald-800 bg-emerald-100",
  failed: "text-rose-700 bg-rose-50",
  blocked: "text-slate-600 bg-slate-100",
  retrying: "text-amber-700 bg-amber-50",
  abandoned: "text-rose-900 bg-rose-100",
  duplicate_blocked: "text-blue-700 bg-blue-50",
  sending: "text-indigo-700 bg-indigo-50",
  prepared: "text-slate-500 bg-slate-50",
  queued: "text-violet-700 bg-violet-50",
};
