import { describe, it, expect } from "vitest";
import { calculateDistanceMeters, isWithinRadius, hasValidCoordinates } from "../src/lib/geo";

// Simulate check-in dialog business logic rules
interface GpsCoord {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface Customer {
  id: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
}

const checkinExceptionRule = (currentGps: GpsCoord | null, customer: Customer) => {
  if (!currentGps) return false;
  const hasCoords = hasValidCoordinates(customer);
  if (!hasCoords) return true;
  const distance = calculateDistanceMeters(
    currentGps.latitude,
    currentGps.longitude,
    Number(customer.latitude),
    Number(customer.longitude),
  );
  return !isWithinRadius(distance, 200);
};

const checkinConfirmDisabledRule = (
  checkinSubmitting: boolean,
  currentGps: GpsCoord | null,
  isException: boolean,
  checkinNote: string,
) => {
  return checkinSubmitting || !currentGps || (isException && !checkinNote.trim());
};

const photoCountValidationRule = (currentPhotosCount: number, newFilesCount: number) => {
  const total = currentPhotosCount + newFilesCount;
  if (total > 2) {
    return { valid: false, error: "Mỗi lần check-in chỉ được tải tối đa 2 ảnh." };
  }
  return { valid: true };
};

describe(" v1.3.0F.3.1 — Field Visit Mobile Runtime Logic Verification", () => {
  describe("A. Check-in Exception Evaluation", () => {
    it("1. Missing Customer GPS coordinates is classified as Exception", () => {
      const customer: Customer = {
        id: "1",
        latitude: null,
        longitude: null,
        name: "Test Customer No GPS",
      };
      const currentGps: GpsCoord = { latitude: 21.0285, longitude: 105.8542, accuracy: 10 };
      const isException = checkinExceptionRule(currentGps, customer);
      expect(isException).toBe(true);
    });

    it("2. Distance > 200m from Customer GPS is classified as Exception", () => {
      const customer: Customer = {
        id: "2",
        latitude: 21.0285,
        longitude: 105.8542, // Hanoi Center
        name: "Test Customer GPS",
      };
      // Distance is ~1.3km (from Hanoi Office to Lan Anh Spa)
      const currentGps: GpsCoord = { latitude: 20.9860961, longitude: 105.7965288, accuracy: 10 };
      const isException = checkinExceptionRule(currentGps, customer);
      expect(isException).toBe(true);
    });

    it("3. Distance <= 200m from Customer GPS is NOT classified as Exception (Valid location)", () => {
      const customer: Customer = {
        id: "3",
        latitude: 21.0285,
        longitude: 105.8542,
        name: "Test Customer GPS Close",
      };
      // salesperson is very close (~30 meters away)
      const currentGps: GpsCoord = { latitude: 21.0283, longitude: 105.854, accuracy: 15 };
      const isException = checkinExceptionRule(currentGps, customer);
      expect(isException).toBe(false);
    });
  });

  describe("B. Confirm Button Disabled State Constraints", () => {
    it("1. Should be disabled when currentGps is missing", () => {
      const disabled = checkinConfirmDisabledRule(false, null, false, "Visits note here");
      expect(disabled).toBe(true);
    });

    it("2. Should be disabled when submitting is active", () => {
      const currentGps: GpsCoord = { latitude: 21.0, longitude: 105.0, accuracy: 10 };
      const disabled = checkinConfirmDisabledRule(true, currentGps, false, "Visits note here");
      expect(disabled).toBe(true);
    });

    it("3. Should be disabled when check-in is Exception and note is empty", () => {
      const currentGps: GpsCoord = { latitude: 21.0, longitude: 105.0, accuracy: 10 };
      const disabled = checkinConfirmDisabledRule(false, currentGps, true, "   ");
      expect(disabled).toBe(true);
    });

    it("4. Should be enabled when check-in is Exception and note is filled", () => {
      const currentGps: GpsCoord = { latitude: 21.0, longitude: 105.0, accuracy: 10 };
      const disabled = checkinConfirmDisabledRule(
        false,
        currentGps,
        true,
        "Gặp chủ spa giới thiệu hàng",
      );
      expect(disabled).toBe(false);
    });

    it("5. Should be enabled when check-in is normal (not Exception) even if note is empty", () => {
      const currentGps: GpsCoord = { latitude: 21.0, longitude: 105.0, accuracy: 10 };
      const disabled = checkinConfirmDisabledRule(false, currentGps, false, "");
      expect(disabled).toBe(false);
    });
  });

  describe("C. Photo Limit Validation (Max 2 Photos)", () => {
    it("1. Adding 1 photo when count is 0 is valid", () => {
      const result = photoCountValidationRule(0, 1);
      expect(result.valid).toBe(true);
    });

    it("2. Adding 2 photos when count is 0 is valid", () => {
      const result = photoCountValidationRule(0, 2);
      expect(result.valid).toBe(true);
    });

    it("3. Adding 2 photos when count is 1 is blocked", () => {
      const result = photoCountValidationRule(1, 2);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("tải tối đa 2 ảnh");
    });

    it("4. Adding 1 photo when count is 2 is blocked", () => {
      const result = photoCountValidationRule(2, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("tải tối đa 2 ảnh");
    });
  });
});
