export interface ComplianceCustomer {
  id: string;
  marketing_opt_in?: boolean;
  marketing_opt_out_at?: string | null;
  last_marketing_sent_at?: string | null;
  email?: string;
  phone?: string;
}

export interface ComplianceTemplate {
  id?: string;
  key?: string;
  channel: string;
  purpose: string;
  requires_opt_in?: boolean;
  include_unsubscribe?: boolean;
  max_send_frequency_days?: number | null;
}

export interface SendLogRecord {
  id?: string;
  customer_id?: string;
  channel: string;
  purpose: string;
  status: string;
  created_at: string;
  sent_at?: string | null;
}

export interface ComplianceResult {
  allowed: boolean;
  reason?: "opt_out_skipped" | "frequency_capped" | "missing_contact" | "none";
  message?: string;
  enforceUnsubscribeLink?: boolean;
}

/**
 * Kiểm tra các ràng buộc tuân thủ chống Spam và tần suất gửi tin nhắn cho Đối tác
 * @param customer Đối tượng khách hàng/đối tác cần nhận thư
 * @param template Khuôn mẫu truyền thông mang thuộc tính mục đích và quy định Opt-in
 * @param recentLogs Danh sách các lượt gửi gần đây của khách hàng này để tính toán chu kỳ
 */
export function canSendMarketingMessage(
  customer: ComplianceCustomer,
  template: ComplianceTemplate,
  recentLogs: SendLogRecord[] = [],
): ComplianceResult {
  // 1. Kiểm tra thông tin liên lạc tối thiểu
  if (!customer.email && !customer.phone) {
    return {
      allowed: false,
      reason: "missing_contact",
      message: "Khách hàng không có thông tin Email hoặc Số điện thoại.",
    };
  }

  // 2. Kiểm tra dấu thời gian Hủy đăng ký (Opt-out Timestamp)
  if (customer.marketing_opt_out_at) {
    return {
      allowed: false,
      reason: "opt_out_skipped",
      message: "Khách hàng đã từ chối nhận thông tin tiếp thị (Opt-out).",
    };
  }

  // 3. Kiểm tra cờ bắt buộc Opt-in
  if (template.requires_opt_in) {
    if (!customer.marketing_opt_in) {
      return {
        allowed: false,
        reason: "opt_out_skipped",
        message: "Khuôn mẫu yêu cầu Opt-in nhưng đối tác chưa đồng ý nhận quảng cáo.",
      };
    }
  }

  // 4. Kiểm tra giới hạn tần suất gửi (Frequency Capping)
  if (template.max_send_frequency_days && template.max_send_frequency_days > 0) {
    const nowMs = Date.now();
    const limitMs = template.max_send_frequency_days * 24 * 60 * 60 * 1000;

    // Tìm lượt gửi thành công gần nhất có cùng mục đích hoặc kênh
    for (const log of recentLogs) {
      // Chỉ tính các lượt đã gửi thành công hoặc đã phát hành
      if (["sent", "delivered", "opened", "clicked"].includes(log.status)) {
        // Ưu tiên so khớp theo cùng mục đích tiếp thị
        if (log.purpose === template.purpose || log.channel === template.channel) {
          const sentTime = log.sent_at
            ? new Date(log.sent_at).getTime()
            : new Date(log.created_at).getTime();
          const diffMs = nowMs - sentTime;

          if (diffMs < limitMs) {
            const daysLeft = Math.ceil((limitMs - diffMs) / (24 * 60 * 60 * 1000));
            return {
              allowed: false,
              reason: "frequency_capped",
              message: `Vi phạm tần suất: Khách hàng đã nhận thư cùng mục đích gần đây. Vui lòng thử lại sau ${daysLeft} ngày.`,
            };
          }
        }
      }
    }

    // Tra cứu bổ sung qua trường last_marketing_sent_at nếu logs trống
    if (customer.last_marketing_sent_at && template.purpose === "marketing_campaign") {
      const lastSentTime = new Date(customer.last_marketing_sent_at).getTime();
      const diffMs = nowMs - lastSentTime;
      if (diffMs < limitMs) {
        return {
          allowed: false,
          reason: "frequency_capped",
          message:
            "Vi phạm tần suất: Dựa trên dấu thời gian gửi tiếp thị cuối cùng của hệ thống CRM.",
        };
      }
    }
  }

  // 5. Ràng buộc tự động: Mục đích marketing_campaign bắt buộc đính kèm link Unsubscribe
  const enforceUnsub =
    template.purpose === "marketing_campaign" || template.include_unsubscribe === true;

  return {
    allowed: true,
    reason: "none",
    enforceUnsubscribeLink: enforceUnsub,
  };
}
