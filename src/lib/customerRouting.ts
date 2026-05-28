/**
 * Thư viện tính toán tuyến chăm sóc khách hàng dựa trên khoảng cách
 */

export type DistanceType = 'near_company' | 'same_city' | 'far_city' | 'province' | 'unknown';
export type CustomerChannel = 'direct_sales' | 'hybrid' | 'tele_sales';
export type CareModel = 'sale_owned' | 'tele_qualified_then_sale' | 'tele_owned';

export interface RoutingThresholds {
  nearKm: number;
  cityKm: number;
  farKm: number;
}

/**
 * Lấy phân loại khoảng cách (DistanceType) từ khoảng cách bằng mét
 * Rule:
 * <= nearKm * 1000: near_company
 * <= cityKm * 1000: same_city
 * <= farKm * 1000: far_city
 * > farKm * 1000: province
 */
export function getDistanceTypeFromMeters(
  distanceMeters: number | null | undefined, 
  thresholds: RoutingThresholds = { nearKm: 10, cityKm: 30, farKm: 80 }
): DistanceType {
  if (distanceMeters === null || distanceMeters === undefined) {
    return 'unknown';
  }
  
  if (distanceMeters <= thresholds.nearKm * 1000) return 'near_company';
  if (distanceMeters <= thresholds.cityKm * 1000) return 'same_city';
  if (distanceMeters <= thresholds.farKm * 1000) return 'far_city';
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
export function getRecommendedRoutingByDistance(
  distanceMeters: number | null | undefined,
  thresholds: RoutingThresholds = { nearKm: 10, cityKm: 30, farKm: 80 }
) {
  const distanceType = getDistanceTypeFromMeters(distanceMeters, thresholds);
  return {
    distanceType,
    customerChannel: getRecommendedCustomerChannel(distanceType),
    careModel: getRecommendedCareModel(distanceType)
  };
}
