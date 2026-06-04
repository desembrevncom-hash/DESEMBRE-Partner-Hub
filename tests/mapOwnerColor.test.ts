import { describe, it, expect } from "vitest";
import {
  getSaleMarkerColor,
  hashString,
  FREE_POOL_COLOR,
  MAP_OWNER_PALETTE,
} from "../src/lib/mapOwnerColor";

describe("mapOwnerColor helper", () => {
  it("hashString returns deterministic number", () => {
    const id = "b84f3c2c-7b24-4f0e-b7d1-123456789abc";
    const hash1 = hashString(id);
    const hash2 = hashString(id);
    expect(hash1).toBe(hash2);

    const hash3 = hashString("different-id");
    expect(hash1).not.toBe(hash3);
  });

  it("getSaleMarkerColor returns same color for same ownerSaleId", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const color1 = getSaleMarkerColor(id);
    const color2 = getSaleMarkerColor(id);
    expect(color1).toEqual(color2);
  });

  it("getSaleMarkerColor returns fallback for null or empty", () => {
    expect(getSaleMarkerColor(null)).toEqual(FREE_POOL_COLOR);
    expect(getSaleMarkerColor("")).toEqual(FREE_POOL_COLOR);
    expect(getSaleMarkerColor(undefined)).toEqual(FREE_POOL_COLOR);
  });

  it("getSaleMarkerColor uses modulo to wrap around palette", () => {
    // Generate many different IDs and ensure they all map to valid palette entries
    const usedColors = new Set();
    for (let i = 0; i < 100; i++) {
      const color = getSaleMarkerColor(`user-id-${i}`);
      expect(MAP_OWNER_PALETTE).toContainEqual(color);
      usedColors.add(color.color);
    }
    // With 100 iterations on a 10-item palette with decent hash, we should hit most if not all colors
    expect(usedColors.size).toBeGreaterThan(1);
  });
});
