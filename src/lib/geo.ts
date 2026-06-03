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
  lon2: number,
): number {
  const R = 6371e3; // Bán kính Trái Đất (mét)
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // mét
}

/**
 * Kiểm tra khoảng cách có nằm trong bán kính quy định không
 */
export function isWithinRadius(distanceMeters: number, radiusMeters: number): boolean {
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
  latitude?: number | null;
  longitude?: number | null;
}): string {
  if (hasValidCoordinates(customer)) {
    return `https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`;
  }

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
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Tạo liên kết chỉ đường Google Maps đến toạ độ khách hàng
 */
export function buildGoogleMapsDirectionsUrl(customer: {
  facility_name?: string | null;
  address?: string | null;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  if (hasValidCoordinates(customer)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`;
  }

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
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export interface RouteCustomer {
  id: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  name?: string | null;
  contact_name?: string | null;
  facility_name?: string | null;
  business_name?: string | null;
}

/**
 * Tối ưu hóa thứ tự viếng thăm khách hàng bằng thuật toán láng giềng gần nhất (Nearest Neighbor)
 */
export function optimizeRouteByNearestNeighbor(
  origin: { latitude: number; longitude: number },
  customers: RouteCustomer[],
): RouteCustomer[] {
  // Lọc danh sách khách hàng có tọa độ hợp lệ
  const validCustomers = customers.filter((c) => hasValidCoordinates(c));

  const ordered: RouteCustomer[] = [];
  const unvisited = [...validCustomers];
  let currentPos = { latitude: origin.latitude, longitude: origin.longitude };

  while (unvisited.length > 0) {
    let nearestIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const cust = unvisited[i];
      const dist = calculateDistanceMeters(
        currentPos.latitude,
        currentPos.longitude,
        Number(cust.latitude),
        Number(cust.longitude),
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    if (nearestIndex !== -1) {
      const nextCust = unvisited.splice(nearestIndex, 1)[0];
      ordered.push(nextCust);
      currentPos = {
        latitude: Number(nextCust.latitude),
        longitude: Number(nextCust.longitude),
      };
    } else {
      break;
    }
  }

  return ordered;
}

/**
 * Tạo liên kết Google Maps chỉ đường nhiều chặng (Waypoints)
 */
export function buildGoogleMapsRouteUrl(
  origin: { latitude: number; longitude: number },
  orderedCustomers: RouteCustomer[],
  options?: { returnToOrigin?: boolean },
): string | null {
  if (!orderedCustomers || orderedCustomers.length === 0) {
    return null;
  }

  // Google Maps giới hạn số lượng waypoint, tối đa lấy 10 điểm đầu tiên
  const customersToRoute = orderedCustomers.slice(0, 10);
  const returnToOrigin = !!options?.returnToOrigin;

  const originStr = `${origin.latitude},${origin.longitude}`;
  let destStr = "";
  let waypointList: RouteCustomer[] = [];

  if (returnToOrigin) {
    destStr = originStr;
    waypointList = customersToRoute;
  } else {
    const lastCust = customersToRoute[customersToRoute.length - 1];
    destStr = `${lastCust.latitude},${lastCust.longitude}`;
    waypointList = customersToRoute.slice(0, -1);
  }

  const base = "https://www.google.com/maps/dir/?api=1";
  let url = `${base}&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}`;

  if (waypointList.length > 0) {
    const waypointsStr = waypointList.map((c) => `${c.latitude},${c.longitude}`).join("|");
    url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
  }

  return url;
}

/**
 * Tính tổng khoảng cách đường chim bay của cả tuyến đường (mét)
 */
export function getRouteDistanceEstimate(
  origin: { latitude: number; longitude: number },
  orderedCustomers: RouteCustomer[],
): number {
  if (!orderedCustomers || orderedCustomers.length === 0) {
    return 0;
  }

  let totalDistance = 0;
  let currentPos = { latitude: origin.latitude, longitude: origin.longitude };

  for (const cust of orderedCustomers) {
    if (hasValidCoordinates(cust)) {
      const dist = calculateDistanceMeters(
        currentPos.latitude,
        currentPos.longitude,
        Number(cust.latitude),
        Number(cust.longitude),
      );
      totalDistance += dist;
      currentPos = {
        latitude: Number(cust.latitude),
        longitude: Number(cust.longitude),
      };
    }
  }

  return totalDistance;
}

/**
 * Phân tích URL Google Maps để trích xuất toạ độ latitude, longitude
 */
export function parseGoogleMapsUrlToCoordinates(
  url: string,
): { latitude: number; longitude: number } | null {
  if (!url) return null;

  try {
    let lat: number | null = null;
    let lng: number | null = null;

    // Trường hợp 1: @lat,lng (Bao gồm cả URL có dạng place/.../@lat,lng)
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch && atMatch.length >= 3) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    } else {
      // Trường hợp 2: ?q=lat,lng hoặc &q=lat,lng
      const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch && qMatch.length >= 3) {
        lat = parseFloat(qMatch[1]);
        lng = parseFloat(qMatch[2]);
      } else {
        // Trường hợp 3: ll=lat,lng
        const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (llMatch && llMatch.length >= 3) {
          lat = parseFloat(llMatch[1]);
          lng = parseFloat(llMatch[2]);
        } else {
          // Trường hợp 4: Text thô dạng "lat, lng" hoặc "lat,lng"
          const textMatch = url.trim().match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
          if (textMatch && textMatch.length >= 3) {
            lat = parseFloat(textMatch[1]);
            lng = parseFloat(textMatch[2]);
          }
        }
      }
    }

    if (lat !== null && lng !== null) {
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
