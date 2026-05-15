// ============================================================================
// NỀN TẢNG QUẢN TRỊ QUYỀN SỞ HỮU KHÁCH HÀNG (CUSTOMER OWNERSHIP PLATFORM)
// ============================================================================

// 1. KHOẢNG KIỂU DỮ LIỆU CỐT LÕI (CORE LITERAL TYPES)
export type CustomerChannel = "direct_sales" | "tele_sales" | "hybrid";

export type CustomerDistanceType = 
  | "near_company"
  | "same_city"
  | "far_city"
  | "province"
  | "unknown";

export type CustomerCareModel = 
  | "sale_owned"
  | "tele_owned"
  | "sale_with_tele_support"
  | "tele_qualified_then_sale";

export interface OwnershipCustomerBase {
  owner_sale_id?: string | null;
  owner_tele_id?: string | null;
  customer_channel?: CustomerChannel;
  customer_distance_type?: CustomerDistanceType;
  care_model?: CustomerCareModel;
}

// 2. HẰNG SỐ MẶC ĐỊNH BẮT ĐẦU (DEFAULT BASELINE CONSTANTS)
export const DEFAULT_CUSTOMER_CHANNEL: CustomerChannel = "direct_sales";
export const DEFAULT_CUSTOMER_DISTANCE_TYPE: CustomerDistanceType = "unknown";
export const DEFAULT_CARE_MODEL: CustomerCareModel = "sale_owned";

// 3. DANH SÁCH TÙY CHỌN CHUẨN MỰC (OPTIONS SOURCE OF TRUTH)
export const CUSTOMER_CHANNEL_OPTIONS = [
  {
    value: "direct_sales",
    label: "Sale trực tiếp",
    description: "Khách gần, cần gặp/demo/chốt trực tiếp",
  },
  {
    value: "tele_sales",
    label: "Tele/Online",
    description: "Khách xa, online, khách cũ cần gọi lại",
  },
  {
    value: "hybrid",
    label: "Sale + Tele",
    description: "Sale chính, Tele hỗ trợ chăm sóc",
  },
] as const;

export const CUSTOMER_DISTANCE_OPTIONS = [
  {
    value: "near_company",
    label: "Gần công ty/showroom",
  },
  {
    value: "same_city",
    label: "Cùng thành phố",
  },
  {
    value: "far_city",
    label: "Xa thành phố",
  },
  {
    value: "province",
    label: "Tỉnh xa",
  },
  {
    value: "unknown",
    label: "Chưa rõ",
  },
] as const;

export const CARE_MODEL_OPTIONS = [
  {
    value: "sale_owned",
    label: "Sale phụ trách chính",
  },
  {
    value: "tele_owned",
    label: "Trưởng Tele phụ trách chính",
  },
  {
    value: "sale_with_tele_support",
    label: "Sale chính, Tele hỗ trợ",
  },
  {
    value: "tele_qualified_then_sale",
    label: "Tele lọc nhu cầu rồi chuyển Sale",
  },
] as const;

// 4. CHU KỲ KHÁCH HÀNG (CUSTOMER LIFECYCLE - NAMING chuẩn 2026)
export const LIFECYCLE_STAGE_OPTIONS = [
  { value: "lead", label: "Lead mới", color: "blue", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  { value: "prospect", label: "Đang tư vấn", color: "purple", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  { value: "customer", label: "Khách đã mua", color: "emerald", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  { value: "active", label: "Khách hoạt động", color: "indigo", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  { value: "loyal", label: "Khách thân thiết", color: "amber", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { value: "churned", label: "Ngưng hoạt động", color: "slate", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  { value: "lost", label: "Mất khách", color: "red", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
] as const;

// 5. BỘ HÀM TRA CỨU NHÃN TỰ ĐỘNG (LABEL RESOLVER HELPERS)

export function getLifecycleLabel(value?: string | null) {
  return LIFECYCLE_STAGE_OPTIONS.find((o) => o.value === value)?.label || "Lead mới";
}

export function getLifecycleConfig(value?: string | null) {
  return LIFECYCLE_STAGE_OPTIONS.find((o) => o.value === value) || LIFECYCLE_STAGE_OPTIONS[0];
}

export function getCustomerChannelLabel(value?: string | null) {
  return (
    CUSTOMER_CHANNEL_OPTIONS.find((item) => item.value === value)?.label ||
    "Chưa phân tuyến"
  );
}

export function getCustomerDistanceLabel(value?: string | null) {
  return (
    CUSTOMER_DISTANCE_OPTIONS.find((item) => item.value === value)?.label ||
    "Chưa rõ"
  );
}

export function getCareModelLabel(value?: string | null) {
  return (
    CARE_MODEL_OPTIONS.find((item) => item.value === value)?.label ||
    "Chưa xác định"
  );
}

/**
 * Classify customer lifecycle stage based on customer data and their orders.
 * Used by the Kanban pipeline view to categorize customers.
 */
export function classifyCustomerLifecycle(customer: any, orders: any[]): string {
  if (customer.lifecycle_stage) return customer.lifecycle_stage;

  if (orders && orders.length > 0) {
    const hasRecentOrder = orders.some((o: any) => {
      if (!o.created_at) return false;
      const daysSince = (Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 90;
    });
    if (hasRecentOrder) return "active_customer";
    return "ordered";
  }
  return "new_lead";
}

/**
 * Get staff name by ID. Returns a placeholder since this requires an async lookup.
 * In a real implementation, this would be replaced by a cached staff directory lookup.
 */
export function getStaffName(staffId?: string | null): string {
  if (!staffId) return "";
  // Return a shortened version of the ID as placeholder
  return `Staff-${staffId.slice(0, 6)}`;
}
