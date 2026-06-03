import { describe, it, expect } from "vitest";
import {
  calculateDistanceMeters,
  isWithinRadius,
  hasValidCoordinates,
  optimizeRouteByNearestNeighbor,
  getRouteDistanceEstimate,
} from "../src/lib/geo";
import {
  getDistanceTypeFromMeters,
  getRecommendedCustomerChannel,
  getRecommendedCareModel,
  getRecommendedRoutingByDistance,
} from "../src/lib/customerRouting";

describe("A. Geolocation Coordinate Validation & Math", () => {
  it("1. Same point distance calculation should be 0", () => {
    const lat = 20.9860961;
    const lng = 105.7965288;
    const dist = calculateDistanceMeters(lat, lng, lat, lng);
    expect(dist).toBe(0);
  });

  it("2. Distance from Office to Lan Anh Spa (~1.3km)", () => {
    // Office (Văn phòng Hà Nội)
    const lat1 = 20.9860961;
    const lon1 = 105.7965288;
    // Lan Anh Spa
    const lat2 = 20.9817414;
    const lon2 = 105.7847142;

    const dist = calculateDistanceMeters(lat1, lon1, lat2, lon2);
    expect(dist).toBeGreaterThan(1200);
    expect(dist).toBeLessThan(1400); // Should be around 1.3km
  });

  it("3. Coordinate range limits validation", () => {
    // Valid coordinates
    expect(hasValidCoordinates({ latitude: 21.0285, longitude: 105.8542 })).toBe(true);

    // Invalid latitude (> 90)
    expect(hasValidCoordinates({ latitude: 91, longitude: 105.8542 })).toBe(false);
    expect(hasValidCoordinates({ latitude: -91, longitude: 105.8542 })).toBe(false);

    // Invalid longitude (> 180)
    expect(hasValidCoordinates({ latitude: 21.0285, longitude: 181 })).toBe(false);
    expect(hasValidCoordinates({ latitude: 21.0285, longitude: -181 })).toBe(false);

    // Missing lat/lng
    expect(hasValidCoordinates({ latitude: null, longitude: 105.8 })).toBe(false);
    expect(hasValidCoordinates({ latitude: 21.0, longitude: undefined })).toBe(false);

    // 0,0 placeholder check
    expect(hasValidCoordinates({ latitude: 0, longitude: 0 })).toBe(false);
  });
});

describe("B. Territory Routing Recommendation & Boundaries", () => {
  const thresholds = { nearKm: 10, cityKm: 30, farKm: 80 };

  it("1. Exactly at boundary of 10km (should be near_company)", () => {
    const dist = 10 * 1000; // 10km in meters
    const distType = getDistanceTypeFromMeters(dist, thresholds);
    expect(distType).toBe("near_company");
    expect(getRecommendedCustomerChannel(distType)).toBe("direct_sales");
    expect(getRecommendedCareModel(distType)).toBe("sale_owned");
  });

  it("2. Exactly 10.1km (should transition to same_city)", () => {
    const dist = 10.1 * 1000;
    const distType = getDistanceTypeFromMeters(dist, thresholds);
    expect(distType).toBe("same_city");
    expect(getRecommendedCustomerChannel(distType)).toBe("direct_sales");
    expect(getRecommendedCareModel(distType)).toBe("sale_owned");
  });

  it("3. Exactly at boundary of 30km (should be same_city)", () => {
    const dist = 30 * 1000;
    const distType = getDistanceTypeFromMeters(dist, thresholds);
    expect(distType).toBe("same_city");
  });

  it("4. Exactly 30.1km (should transition to far_city)", () => {
    const dist = 30.1 * 1000;
    const distType = getDistanceTypeFromMeters(dist, thresholds);
    expect(distType).toBe("far_city");
    expect(getRecommendedCustomerChannel(distType)).toBe("hybrid");
    expect(getRecommendedCareModel(distType)).toBe("tele_qualified_then_sale");
  });

  it("5. Exactly at boundary of 80km (should be far_city)", () => {
    const dist = 80 * 1000;
    const distType = getDistanceTypeFromMeters(dist, thresholds);
    expect(distType).toBe("far_city");
  });

  it("6. Exactly 80.1km (should transition to province)", () => {
    const dist = 80.1 * 1000;
    const distType = getDistanceTypeFromMeters(dist, thresholds);
    expect(distType).toBe("province");
    expect(getRecommendedCustomerChannel(distType)).toBe("tele_sales");
    expect(getRecommendedCareModel(distType)).toBe("tele_owned");
  });

  it("7. Null/Missing coordinates (should return unknown)", () => {
    const distType = getDistanceTypeFromMeters(null, thresholds);
    expect(distType).toBe("unknown");
    expect(getRecommendedCustomerChannel(distType)).toBe("hybrid");
    expect(getRecommendedCareModel(distType)).toBe("tele_qualified_then_sale");
  });
});

describe("C. Route Optimization (Nearest Neighbor)", () => {
  const origin = { latitude: 20.9860961, longitude: 105.7965288 }; // Hanoi Office

  it("1. Single customer optimization", () => {
    const customers = [{ id: "1", latitude: 20.9817414, longitude: 105.7847142, name: "Lan Anh" }];
    const ordered = optimizeRouteByNearestNeighbor(origin, customers);
    expect(ordered.length).toBe(1);
    expect(ordered[0].id).toBe("1");
  });

  it("2. Multi-point optimization checks", () => {
    const custA = { id: "A", latitude: 20.99, longitude: 105.8 }; // Very close
    const custB = { id: "B", latitude: 21.05, longitude: 105.85 }; // Far
    const custC = { id: "C", latitude: 20.98, longitude: 105.79 }; // Very close

    const ordered = optimizeRouteByNearestNeighbor(origin, [custB, custA, custC]);
    expect(ordered.length).toBe(3);

    // Nearest neighbor should visit close points before far points
    expect(ordered[0].id).toBe("A");
    expect(ordered[1].id).toBe("C");
    expect(ordered[2].id).toBe("B");
  });

  it("3. Waypoints missing coordinates should be excluded", () => {
    const custA = { id: "A", latitude: 20.99, longitude: 105.8 };
    const custB = { id: "B", latitude: null, longitude: null }; // Lacks GPS
    const custC = { id: "C", latitude: 20.98, longitude: 105.79 };

    const ordered = optimizeRouteByNearestNeighbor(origin, [custA, custB, custC]);
    expect(ordered.length).toBe(2);
    expect(ordered.some((c) => c.id === "B")).toBe(false);
  });

  it("4. Duplicate coordinate handling should not crash", () => {
    const custA = { id: "A", latitude: 20.99, longitude: 105.8 };
    const custB = { id: "B", latitude: 20.99, longitude: 105.8 }; // Identical to A

    const ordered = optimizeRouteByNearestNeighbor(origin, [custA, custB]);
    expect(ordered.length).toBe(2);
    expect(ordered[0].id).toBe("A");
    expect(ordered[1].id).toBe("B");
  });

  it("5. Route optimization should be deterministic", () => {
    const custA = { id: "A", latitude: 20.99, longitude: 105.8 };
    const custB = { id: "B", latitude: 21.05, longitude: 105.85 };
    const custC = { id: "C", latitude: 20.98, longitude: 105.79 };

    const run1 = optimizeRouteByNearestNeighbor(origin, [custB, custA, custC]);
    const run2 = optimizeRouteByNearestNeighbor(origin, [custB, custA, custC]);

    expect(run1).toEqual(run2);
  });
});

describe("D. Visit Check-in Radius Geofencing", () => {
  const customer = { latitude: 21.0285, longitude: 105.8542 }; // Spa Hà Nội

  it("1. Salesperson is within 50m (valid check-in)", () => {
    const salesperson = { latitude: 21.0282, longitude: 105.854 };
    const dist = calculateDistanceMeters(
      salesperson.latitude,
      salesperson.longitude,
      customer.latitude,
      customer.longitude,
    );

    expect(dist).toBeLessThan(200);
    expect(isWithinRadius(dist, 200)).toBe(true);
  });

  it("2. Salesperson is exactly 199m away (valid check-in)", () => {
    const dist = 199;
    expect(isWithinRadius(dist, 200)).toBe(true);
  });

  it("3. Salesperson is exactly 201m away (invalid check-in - exception required)", () => {
    const dist = 201;
    expect(isWithinRadius(dist, 200)).toBe(false);
  });
});
