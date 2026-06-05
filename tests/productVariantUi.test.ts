import { describe, expect, it } from "vitest";
import {
  isValidImageUrl,
  isValidHttpUrl,
  normalizeSku,
  hasDuplicateVariant,
} from "../src/lib/catalogAdminDb";
import {
  stableProductSort,
  computeNextProductSortOrder,
} from "../src/lib/catalogSort";

describe("Product & Variant UI Helpers - Unit Tests", () => {
  describe("isValidImageUrl", () => {
    it("should allow valid http/https URLs", () => {
      expect(isValidImageUrl("http://example.com/img.jpg")).toBe(true);
      expect(isValidImageUrl("https://my-bucket.s3.amazonaws.com/image.png")).toBe(true);
    });

    it("should allow valid relative or absolute storage paths", () => {
      expect(isValidImageUrl("/assets/images/product-123.jpg")).toBe(true);
      expect(isValidImageUrl("assets/product_456.png")).toBe(true);
      expect(isValidImageUrl("images/brand-logo.png")).toBe(true);
    });

    it("should allow empty or whitespace-only inputs", () => {
      expect(isValidImageUrl("")).toBe(true);
      expect(isValidImageUrl("   ")).toBe(true);
      expect(isValidImageUrl(null as unknown as string)).toBe(true);
    });

    it("should block invalid URLs or storage paths with bad characters", () => {
      expect(isValidImageUrl("https://invalid url.com")).toBe(false);
      expect(isValidImageUrl("http://")).toBe(false);
      expect(isValidImageUrl("assets/product name#1.png")).toBe(false);
    });
  });

  describe("isValidHttpUrl", () => {
    it("should allow valid http/https URLs", () => {
      expect(isValidHttpUrl("http://example.com")).toBe(true);
      expect(isValidHttpUrl("https://example.com/subpath/doc.pdf")).toBe(true);
    });

    it("should allow empty or whitespace-only inputs", () => {
      expect(isValidHttpUrl("")).toBe(true);
      expect(isValidHttpUrl("   ")).toBe(true);
    });

    it("should block non-http/https strings or bad format", () => {
      expect(isValidHttpUrl("/local/path.pdf")).toBe(false);
      expect(isValidHttpUrl("ftp://example.com")).toBe(false);
      expect(isValidHttpUrl("google.com")).toBe(false);
    });
  });

  describe("normalizeSku", () => {
    it("should convert to uppercase and trim spaces", () => {
      expect(normalizeSku("  sku_123_abc  ")).toBe("SKU_123_ABC");
    });

    it("should strip spaces and invalid characters", () => {
      expect(normalizeSku("SKU-123 ABC#")).toBe("SKU-123ABC");
      expect(normalizeSku("sku&456_test")).toBe("SKU456_TEST");
    });
  });

  describe("hasDuplicateVariant", () => {
    const existingVariants = [
      { id: "v1", channel: "retail" as const, size_label: "150ml" },
      { id: "v2", channel: "salon" as const, size_label: "1000ml" },
      { id: "v3", channel: "retail" as const, size_label: null },
    ];

    it("should detect duplicate channel and size combinations", () => {
      expect(hasDuplicateVariant(existingVariants, "retail", "150ml")).toBe(true);
      expect(hasDuplicateVariant(existingVariants, "salon", "1000ml")).toBe(true);
      expect(hasDuplicateVariant(existingVariants, "retail", "")).toBe(true);
      expect(hasDuplicateVariant(existingVariants, "retail", null)).toBe(true);
    });

    it("should be case-insensitive and ignore spacing variations", () => {
      expect(hasDuplicateVariant(existingVariants, "retail", "  150ML  ")).toBe(true);
    });

    it("should allow editing of an existing variant without self-collision", () => {
      expect(hasDuplicateVariant(existingVariants, "retail", "150ml", "v1")).toBe(false);
    });

    it("should allow unique combinations of channel and size", () => {
      expect(hasDuplicateVariant(existingVariants, "salon", "150ml")).toBe(false);
      expect(hasDuplicateVariant(existingVariants, "retail", "200ml")).toBe(false);
      expect(hasDuplicateVariant(existingVariants, "salon", null)).toBe(false);
    });
  });

  describe("stableProductSort", () => {
    it("should sort by sort_order ASC first", () => {
      const items = [
        { sort_order: 20, product_code: "1", name: "A" },
        { sort_order: 10, product_code: "2", name: "B" },
        { sort_order: 30, product_code: "3", name: "C" },
      ];
      const sorted = stableProductSort(items);
      expect(sorted[0].name).toBe("B");
      expect(sorted[1].name).toBe("A");
      expect(sorted[2].name).toBe("C");
    });

    it("should sort by product_code numeric ASC if sort_order matches", () => {
      const items = [
        { sort_order: 0, product_code: "10", name: "A" },
        { sort_order: 0, product_code: "2", name: "B" },
        { sort_order: 0, product_code: "1", name: "C" },
      ];
      const sorted = stableProductSort(items);
      expect(sorted[0].product_code).toBe("1");
      expect(sorted[1].product_code).toBe("2");
      expect(sorted[2].product_code).toBe("10");
    });

    it("should sort non-numeric product_code using name fallback", () => {
      const items = [
        { sort_order: 0, product_code: "XYZ", name: "Banana" },
        { sort_order: 0, product_code: "ABC", name: "Apple" },
      ];
      const sorted = stableProductSort(items);
      expect(sorted[0].name).toBe("Apple");
      expect(sorted[1].name).toBe("Banana");
    });

    it("should sort numeric product_codes before non-numeric codes", () => {
      const items = [
        { sort_order: 0, product_code: "XYZ", name: "Banana" },
        { sort_order: 0, product_code: "2", name: "Apple" },
      ];
      const sorted = stableProductSort(items);
      expect(sorted[0].product_code).toBe("2");
      expect(sorted[1].product_code).toBe("XYZ");
    });
  });

  describe("computeNextProductSortOrder", () => {
    it("should return 10 for empty list", () => {
      expect(computeNextProductSortOrder([])).toBe(10);
    });

    it("should return max(sort_order) + 10", () => {
      expect(computeNextProductSortOrder([{ sort_order: 15 }, { sort_order: 5 }])).toBe(25);
    });
  });
});

