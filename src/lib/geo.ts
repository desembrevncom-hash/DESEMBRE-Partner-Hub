/**
 * Thư viện Helper Địa lý & Bản đồ cho DESEMBRE Partner Hub
 */

/**
 * Tính khoảng cách giữa 2 toạ độ theo công thức Haversine (Đơn vị: mét)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Bán kính Trái Đất (mét)
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // mét
}

/**
 * Kiểm tra khoảng cách có nằm trong bán kính quy định không
 */
export function isWithinRadius(
  distanceMeters: number,
  radiusMeters: number
): boolean {
  return distanceMeters <= radiusMeters;
}

/**
 * Định dạng khoảng cách hiển thị trực quan (m hoặc km)
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  const km = distanceMeters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Kiểm tra khách hàng đã được số hoá toạ độ hợp lệ chưa
 */
export function hasValidCoordinates(customer: {
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  const lat = customer.latitude;
  const lng = customer.longitude;

  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false;
  }

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return false;
  }

  return (
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180 &&
    parsedLat !== 0 &&
    parsedLng !== 0
  );
}

/**
 * Tạo liên kết tìm kiếm trên Google Maps phục vụ định vị thủ công
 */
export function buildGoogleMapsSearchUrl(customer: {
  facility_name?: string | null;
  address?: string | null;
  name?: string | null;
}): string {
  const queryParts: string[] = [];

  if (customer.facility_name) {
    queryParts.push(customer.facility_name);
  }
  if (customer.address) {
    queryParts.push(customer.address);
  } else if (!customer.facility_name && customer.name) {
    queryParts.push(customer.name);
  }

  const query = queryParts.join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
}

/**
 * Tạo liên kết chỉ đường Google Maps đến toạ độ khách hàng
 */
export function buildGoogleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
