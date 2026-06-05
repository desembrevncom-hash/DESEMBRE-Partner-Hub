import { describe, expect, it } from "vitest";
import {
  normalizeSlug,
  normalizeCode,
  computeNextSortOrder,
  normalizeSortOrder,
} from "../src/components/admin/BrandCategoryManagement";

describe("Brand & Category UI Helpers - Unit Tests", () => {
  describe("normalizeSlug", () => {
    it("should convert uppercase to lowercase and trim spaces", () => {
      expect(normalizeSlug("  Desembre Cleanser  ")).toBe("desembre-cleanser");
    });

    it("should remove accents and vietnamese diacritics", () => {
      expect(normalizeSlug("Làm sạch da mặt")).toBe("lam-sach-da-mat");
    });

    it("should replace special characters and punctuation with hyphens", () => {
      expect(normalizeSlug("Brand & Category / Test #1!")).toBe("brand-category-test-1");
    });

    it("should strip leading and trailing hyphens", () => {
      expect(normalizeSlug("---desembre-brand---")).toBe("desembre-brand");
    });

    it("should handle empty or whitespace-only inputs safely", () => {
      expect(normalizeSlug("   ")).toBe("");
      expect(normalizeSlug("")).toBe("");
    });
  });

  describe("normalizeCode", () => {
    it("should convert to uppercase and trim spaces", () => {
      expect(normalizeCode("  desembre_brand  ")).toBe("DESEMBRE_BRAND");
    });

    it("should retain only alphanumeric, hyphens, and underscores", () => {
      expect(normalizeCode("DESEMBRE & BRAND / #1!")).toBe("DESEMBREBRAND1");
      expect(normalizeCode("BRAND-CODE_123")).toBe("BRAND-CODE_123");
    });

    it("should handle empty input safely", () => {
      expect(normalizeCode("")).toBe("");
    });
  });

  describe("computeNextSortOrder", () => {
    it("should return 10 if there are no categories", () => {
      expect(computeNextSortOrder([])).toBe(10);
    });

    it("should return max(sort_order) + 10 if categories exist", () => {
      const cats = [{ sort_order: 10 }, { sort_order: 25 }, { sort_order: 5 }];
      expect(computeNextSortOrder(cats)).toBe(35);
    });
  });

  describe("normalizeSortOrder", () => {
    it("should parse valid numeric string or number", () => {
      expect(normalizeSortOrder("20")).toBe(20);
      expect(normalizeSortOrder(35)).toBe(35);
    });

    it("should return fallbackVal if input is negative or invalid string", () => {
      expect(normalizeSortOrder("-5", 10)).toBe(10);
      expect(normalizeSortOrder("not a number", 15)).toBe(15);
    });

    it("should trim spacing correctly before parsing", () => {
      expect(normalizeSortOrder("  42  ")).toBe(42);
    });
  });
});
