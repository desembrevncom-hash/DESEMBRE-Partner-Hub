import { expect, test } from "vitest";
import { normalizeProvinceName, detectDistrictOrLocality, isValidProvince, VIETNAM_PROVINCES_2025 } from "./vietnamProvinces";
import { VIETNAM_PROVINCES } from "../vietnamProvinces";

test("Same Quick Lead and Bulk Import use same shared list", () => {
  expect(VIETNAM_PROVINCES).toBe(VIETNAM_PROVINCES_2025);
  expect(VIETNAM_PROVINCES_2025.length).toBe(34);
});

test("normalizeProvinceName matches aliases and accents", () => {
  expect(normalizeProvinceName("HCM")).toBe("TP Hồ Chí Minh");
  expect(normalizeProvinceName("TPHCM")).toBe("TP Hồ Chí Minh");
  expect(normalizeProvinceName("Sài Gòn")).toBe("TP Hồ Chí Minh");
  expect(normalizeProvinceName("Hải phòng")).toBe("TP Hải Phòng");
  expect(normalizeProvinceName("Ha Noi")).toBe("Hà Nội");
});

test("detectDistrictOrLocality correctly detects known districts", () => {
  expect(detectDistrictOrLocality("Tân Bình")).toBe(true);
  expect(detectDistrictOrLocality("Hồng Bàng")).toBe(true);
  expect(detectDistrictOrLocality("Quận 1")).toBe(true);
  expect(detectDistrictOrLocality("huyện đảo")).toBe(true);
});

test("detectDistrictOrLocality does not falsely detect valid provinces", () => {
  expect(detectDistrictOrLocality("TP Hồ Chí Minh")).toBe(false);
  expect(detectDistrictOrLocality("Hà Nội")).toBe(false);
});

test("isValidProvince validates against canonical list", () => {
  expect(isValidProvince("TP Hồ Chí Minh")).toBe(true);
  expect(isValidProvince("HCM")).toBe(false); // only exact match
  expect(isValidProvince("Tân Bình")).toBe(false);
  expect(isValidProvince("")).toBe(false);
});
