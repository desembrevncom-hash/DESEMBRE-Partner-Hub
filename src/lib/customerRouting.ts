/**
 * Thư viện tính toán tuyến chăm sóc khách hàng dựa trên khoảng cách
 */

export type DistanceType = 'near_company' | 'same_city' | 'far_city' | 'province' | 'unknown';
export type CustomerChannel = 'direct_sales' | 'hybrid' | 'tele_sales';
export type CareModel = 'sale_owned' | 'tele_qualified_then_sale' | 'tele_owned';

/**
 * Lấy phân loại khoảng cách (DistanceType) từ khoảng cách bằng mét
 * Rule:
 * <= 10000m: near_company
 * <= 30000m: same_city
 * <= 80000m: far_city
 * > 80000m: province
 */
export function getDistanceTypeFromMeters(distanceMeters: number | null | undefined): DistanceType {
  if (distanceMeters === null || distanceMeters === undefined) {
    return 'unknown';
  }
  
  if (distanceMeters <= 10000) return 'near_company';
  if (distanceMeters <= 30000) return 'same_city';
  if (distanceMeters <= 80000) return 'far_city';
  return 'province';
}

/**
 * Lấy kênh khách hàng (CustomerChannel) được đề xuất dựa trên phân loại khoảng cách
 */
export function getRecommendedCustomerChannel(distanceType: DistanceType): CustomerChannel {
  switch (distanceType) {
    case 'near_company':
    case 'same_city':
      return 'direct_sales';
    case 'far_city':
    case 'unknown':
      return 'hybrid';
    case 'province':
      return 'tele_sales';
    default:
      return 'hybrid';
  }
}

/**
 * Lấy mô hình chăm sóc (CareModel) được đề xuất dựa trên phân loại khoảng cách
 */
export function getRecommendedCareModel(distanceType: DistanceType): CareModel {
  switch (distanceType) {
    case 'near_company':
    case 'same_city':
      return 'sale_owned';
    case 'far_city':
    case 'unknown':
      return 'tele_qualified_then_sale';
    case 'province':
      return 'tele_owned';
    default:
      return 'tele_qualified_then_sale';
  }
}

/**
 * Hàm bao bọc (wrapper) trả về toàn bộ thông tin routing từ khoảng cách
 */
export function getRecommendedRoutingByDistance(distanceMeters: number | null | undefined) {
  const distanceType = getDistanceTypeFromMeters(distanceMeters);
  return {
    distanceType,
    customerChannel: getRecommendedCustomerChannel(distanceType),
    careModel: getRecommendedCareModel(distanceType)
  };
}
