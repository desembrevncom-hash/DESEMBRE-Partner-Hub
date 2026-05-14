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

// 4. BỘ HÀM TRA CỨU NHÃN TỰ ĐỘNG (LABEL RESOLVER HELPERS)

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
