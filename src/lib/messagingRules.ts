/**
 * Module Kiểm soát Quy tắc Gửi tin nhắn Tiếp thị (Messaging Compliance Engine)
 * Hỗ trợ lọc danh sách, chống Spam và tuân thủ các quy định Opt-in/Opt-out trong CRM.
 */

export interface MessageTemplateCompliance {
  id?: string;
  purpose?: string;
  requires_opt_in?: boolean;
  include_unsubscribe?: boolean;
  max_send_frequency_days?: number | null;
  [key: string]: any;
}

export interface CustomerCompliance {
  id?: string;
  marketing_opt_in?: boolean;
  marketing_opt_out_at?: string | null;
  last_marketing_sent_at?: string | null;
  [key: string]: any;
}

export interface MessageSendLog {
  id?: string;
  template_id?: string;
  purpose?: string;
  status?: string;
  created_at?: string;
  [key: string]: any;
}

export interface ComplianceResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Kiểm tra xem Khách hàng có đủ điều kiện nhận Mẫu tin nhắn tiếp thị cụ thể hay không.
 * @param customer Đối tượng Khách hàng từ bảng customers
 * @param template Đối tượng Mẫu tin nhắn từ bảng message_templates
 * @param recentLogs Mảng lịch sử gửi tin nhắn gần đây của khách hàng từ bảng message_send_logs
 * @returns ComplianceResult { allowed: boolean, reason?: string }
 */
export function canSendMarketingMessage(
  customer: CustomerCompliance | null | undefined,
  template: MessageTemplateCompliance | null | undefined,
  recentLogs: MessageSendLog[] = []
): ComplianceResult {
  // 1. Kiểm tra tính hợp lệ của tham số
  if (!template) {
    return { allowed: true }; // Nếu không có mẫu, ngầm định cho phép gửi tiêu chuẩn
  }

  if (!customer) {
    return { 
      allowed: false, 
      reason: "Dữ liệu khách hàng không hợp lệ hoặc không tồn tại." 
    };
  }

  // 2. Kiểm tra trạng thái Từ chối (Opt-out)
  // Bất kể mẫu tin nhắn là gì, nếu khách hàng đã Opt-out toàn cục thì chặn tuyệt đối
  if (customer.marketing_opt_out_at && customer.marketing_opt_out_at.trim() !== "") {
    return { 
      allowed: false, 
      reason: "Khách hàng đã từ chối nhận tin nhắn tiếp thị (Opt-out)." 
    };
  }

  // 3. Kiểm tra yêu cầu Đăng ký trước (Requires Opt-in)
  if (template.requires_opt_in === true) {
    if (customer.marketing_opt_in !== true) {
      return { 
        allowed: false, 
        reason: "Khách hàng chưa đăng ký nhận tin tiếp thị (Opt-in)." 
      };
    }
  }

  // 4. Kiểm tra Tần suất Gửi tối đa (Max Send Frequency)
  const frequencyDays = template.max_send_frequency_days;
  if (typeof frequencyDays === "number" && frequencyDays > 0) {
    const nowMs = Date.now();
    const cutoffMs = nowMs - frequencyDays * 24 * 3600 * 1000;

    // Lọc các bản ghi thành công gần đây cho cùng Mẫu tin nhắn hoặc cùng Mục đích tiếp thị
    const hasSpamConflict = recentLogs.some(log => {
      // Chỉ tính các log đã gửi thành công hoặc đang chờ xử lý
      if (log.status !== "sent" && log.status !== "pending") return false;

      // Khớp điều kiện: Cùng template_id hoặc cùng purpose
      const isSameTemplate = log.template_id && template.id && log.template_id === template.id;
      const isSamePurpose = log.purpose && template.purpose && log.purpose === template.purpose;

      if (isSameTemplate || isSamePurpose) {
        if (log.created_at) {
          const logMs = new Date(log.created_at).getTime();
          if (!isNaN(logMs) && logMs >= cutoffMs) {
            return true; // Tìm thấy bản ghi gửi quá gần trong chu kỳ cho phép
          }
        }
      }
      return false;
    });

    if (hasSpamConflict) {
      return { 
        allowed: false, 
        reason: `Vượt quá tần suất gửi tối đa (${frequencyDays} ngày/lần) cho mẫu tin nhắn này.` 
      };
    }
  }

  // Nếu vượt qua toàn bộ các lớp rào cản, cấp phép gửi tin
  return { allowed: true };
}
