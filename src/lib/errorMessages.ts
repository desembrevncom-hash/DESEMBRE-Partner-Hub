/**
 * Helper để chuẩn hóa và làm mềm các lỗi kỹ thuật thành thông báo thân thiện (Friendly UI).
 * Tránh hiển thị raw SQL errors (như RLS, relations) cho người dùng.
 */

export function isPermissionError(error: any): boolean {
  if (!error) return false;
  const msg = error.message || error.details || "";
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("PGRST301")
  );
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = error.message || "";
  return msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("timeout");
}

export function getFriendlyErrorMessage(error: any): string {
  if (!error) return "Đã xảy ra lỗi không xác định.";

  if (typeof error === "string") {
    return error;
  }

  const msg = error.message || error.details || error.hint || "";

  // 1. Network Errors
  if (isNetworkError(error)) {
    return "Lỗi kết nối mạng. Vui lòng kiểm tra lại Internet và thử lại.";
  }

  // 2. Permission / RLS Errors
  if (isPermissionError(error)) {
    return "Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ Admin.";
  }

  // 3. Database / SQL Errors (Hide raw details)
  if (
    msg.includes("relation") ||
    msg.includes("column") ||
    msg.includes("syntax error") ||
    msg.includes("Postgres")
  ) {
    return "Lỗi tạm thời. Vui lòng thử lại sau hoặc báo cáo với quản trị viên.";
  }

  if (msg.includes("duplicate key value")) {
    return "Dữ liệu đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.";
  }

  // 4. Timeout / Abort
  if (msg.includes("abort") || msg.includes("timeout")) {
    return "Yêu cầu mất quá nhiều thời gian để xử lý. Vui lòng thử lại.";
  }

  // Default fallback (only show if it's not a scary SQL string)
  if (msg.length > 0 && msg.length < 100 && !msg.includes("SQL")) {
    return msg;
  }

  return "Đã xảy ra lỗi hệ thống. Vui lòng thử lại.";
}
