import { differenceInDays } from "date-fns";
import { mapLegacyStageToNew } from "../salesPipeline";

export type DataHealthSeverity = "ok" | "warning" | "danger";

export interface DataHealthResult {
  severity: DataHealthSeverity;
  label: string;
  reasons: string[];
  primaryReason: string | null;
  badgeClassName: string;
}

const VALID_SOURCES = [
  "facebook",
  "zalo",
  "website",
  "tiktok",
  "referral",
  "event",
  "walk_in",
  "other"
];

/**
 * Phân tích trạng thái sức khỏe dữ liệu của khách hàng
 * Hàm pure, không gọi API.
 */
export function getCustomerDataHealth(customer: any): DataHealthResult {
  if (!customer) {
    return {
      severity: "ok",
      label: "Bình thường",
      reasons: [],
      primaryReason: null,
      badgeClassName: "bg-slate-100 text-slate-600 border-slate-200"
    };
  }

  const reasons: string[] = [];
  let severity: DataHealthSeverity = "ok";

  // 1. Kiểm tra Name (Danger)
  const hasName = !!(customer.name || customer.business_name || customer.facility_name || customer.contact_name);
  if (!hasName) {
    severity = "danger";
    reasons.push("Thiếu tên khách hàng");
  }

  // 2. Kiểm tra Contact Info
  const hasPhone = !!customer.phone;
  // Giả định có check email từ customer object hoặc channel_summary nếu được truyền
  const hasEmail = !!customer.email || !!customer.channel_summary?.has_email;

  if (!hasPhone && !hasEmail) {
    severity = "danger";
    reasons.push("Thiếu cả SĐT và Email");
  } else if (!hasPhone && hasEmail) {
    if (severity !== "danger") severity = "warning";
    reasons.push("Thiếu SĐT");
  } else if (!hasEmail && hasPhone) {
    // Chỉ là warning nhẹ, nếu đang có lỗi nặng hơn thì giữ nguyên
    if (severity !== "danger") severity = "warning";
    reasons.push("Thiếu Email");
  }

  // 3. Kiểm tra Phân công (Danger/Warning tuỳ mức độ, theo yc là warning hoặc danger. Đặt danger vì ảnh hưởng flow)
  const isAssigned = !!(customer.owner_sale_id || customer.owner_tele_id);
  if (!isAssigned) {
    if (severity !== "danger") severity = "warning";
    reasons.push("Chưa được phân công phụ trách");
  }

  // 4. Kiểm tra Source
  const displaySource = customer.customer_channel || customer.source || "unknown";
  const normalizedSource = typeof displaySource === 'string' ? displaySource.toLowerCase().trim() : 'unknown';
  if (normalizedSource === "unknown" || !displaySource || !VALID_SOURCES.includes(normalizedSource)) {
    if (severity !== "danger") severity = "warning";
    reasons.push(`Nguồn không chuẩn (${displaySource})`);
  }

  // 5. Kiểm tra tương tác (chỉ báo nếu active)
  const mappedStage = mapLegacyStageToNew(customer.lifecycle_stage || customer.status);
  const isClosedOrLost = ["purchased", "lost", "inactive", "blocked"].includes(mappedStage);
  
  if (!isClosedOrLost) {
    const lastContact = customer.last_contacted_at || customer.last_activity_at;
    if (!lastContact) {
      if (severity !== "danger") severity = "warning";
      reasons.push("Chưa từng tương tác");
    } else {
      const daysSinceContact = differenceInDays(new Date(), new Date(lastContact));
      if (daysSinceContact > 7) {
        if (severity !== "danger") severity = "warning";
        reasons.push(`Bỏ quên ${daysSinceContact} ngày`);
      }
    }
  }

  let label = "Dữ liệu OK";
  let primaryReason = null;
  let badgeClassName = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";

  if (severity === "danger") {
    label = "Lỗi dữ liệu";
    primaryReason = reasons[0];
    badgeClassName = "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100";
  } else if (severity === "warning") {
    label = "Cần bổ sung";
    primaryReason = reasons[0];
    badgeClassName = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
  }

  return {
    severity,
    label,
    reasons,
    primaryReason,
    badgeClassName
  };
}
