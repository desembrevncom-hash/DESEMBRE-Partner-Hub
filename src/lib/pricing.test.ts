import { describe, expect, it } from "vitest";
import { calculatePrice } from "./pricing";

describe("calculatePrice", () => {
  it("returns original price for admin without VAT", () => {
    const result = calculatePrice({
      basePrice: 100000,
      role: "admin",
      includeVat: false,
    });

    expect(result.finalPrice).toBe(100000);
  });

  it("applies 40% discount for sale without VAT", () => {
    const result = calculatePrice({
      basePrice: 100000,
      role: "sale",
      includeVat: false,
    });

    expect(result.finalPrice).toBe(60000);
  });

  it("adds 8% VAT for admin", () => {
    const result = calculatePrice({
      basePrice: 100000,
      role: "admin",
      includeVat: true,
    });

    expect(result.finalPrice).toBe(108000);
  });

  it("applies sale discount first, then VAT", () => {
    const result = calculatePrice({
      basePrice: 100000,
      role: "sale",
      includeVat: true,
    });

    expect(result.finalPrice).toBe(64800);
  });
});
