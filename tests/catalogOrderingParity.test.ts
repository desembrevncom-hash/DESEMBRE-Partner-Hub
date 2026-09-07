import { describe, it, expect } from "vitest";
import {
  extractNumericCode,
  compareCatalogProducts,
  sortCatalogProducts,
  type SortableCatalogProduct,
} from "../src/features/catalog/catalogSortUtils";
import { stableProductSort } from "../src/lib/catalogSort";

describe("Catalog Ordering Parity", () => {
  describe("Task 6.1: extractNumericCode normalization", () => {
    it("normalizes integer numbers correctly", () => {
      expect(extractNumericCode(1)).toBe(1);
      expect(extractNumericCode(2)).toBe(2);
      expect(extractNumericCode(10)).toBe(10);
    });

    it("normalizes string numbers and leading zeros correctly", () => {
      expect(extractNumericCode("1")).toBe(1);
      expect(extractNumericCode("01")).toBe(1);
      expect(extractNumericCode("001")).toBe(1);
      expect(extractNumericCode("2")).toBe(2);
      expect(extractNumericCode("02")).toBe(2);
      expect(extractNumericCode("10")).toBe(10);
      expect(extractNumericCode("010")).toBe(10);
    });

    it("normalizes prefixed codes such as P-01", () => {
      expect(extractNumericCode("P-01")).toBe(1);
      expect(extractNumericCode("P-04")).toBe(4);
      expect(extractNumericCode("#5")).toBe(5);
    });

    it("returns null for non-numeric or missing codes", () => {
      expect(extractNumericCode(null)).toBeNull();
      expect(extractNumericCode(undefined)).toBeNull();
      expect(extractNumericCode("")).toBeNull();
      expect(extractNumericCode("ABC")).toBeNull();
    });
  });

  describe("Task 6.2: Numeric sorting vs string sorting (1,2,3,4,5...10)", () => {
    it("sorts product_code 1,2,3,4,5,10 in natural numeric order instead of alphabetical order", () => {
      const unsorted: SortableCatalogProduct[] = [
        { product_code: "10", name: "Madetox Mist", sort_order: 0 },
        { product_code: "2", name: "Derma Science Water", sort_order: 0 },
        { product_code: "1", name: "Milk Essential Cleanser", sort_order: 0 },
        { product_code: "5", name: "Oxy Peel Bubble Cleanser", sort_order: 0 },
        { product_code: "3", name: "Repair Mousse Cleanser", sort_order: 0 },
        { product_code: "4", name: "Enzyme Powder Cleanser", sort_order: 0 },
      ];

      const sorted = sortCatalogProducts(unsorted);

      expect(sorted.map((p) => p.product_code)).toEqual(["1", "2", "3", "4", "5", "10"]);
    });

    it("handles leading zeros correctly so '01' and '1' compare as equal number", () => {
      const items: SortableCatalogProduct[] = [
        { product_code: "02", name: "Product 2", sort_order: 0 },
        { product_code: "01", name: "Product 1B", sort_order: 0 },
        { product_code: "1", name: "Product 1A", sort_order: 0 },
      ];

      const sorted = sortCatalogProducts(items);
      expect(sorted[0].product_code).toBe("1"); // 1A and 1B are both 1, then by name 1A < 1B
      expect(sorted[1].product_code).toBe("01");
      expect(sorted[2].product_code).toBe("02");
    });
  });

  describe("Task 6.3: /san-pham product order starts with expected catalog items", () => {
    it("starts with Milk, Derma Science Water, Repair Mousse, Enzyme Powder, Oxy Peel", () => {
      const mockCatalogProducts: SortableCatalogProduct[] = [
        { product_code: "10", name: "DESEMBRE MADETOX MIST", sort_order: 0 },
        { product_code: "11", name: "DESEMBRE HYDRO SCIENCE HYDRO E.R CREAM MASK", sort_order: 0 },
        { product_code: "5", name: "DESEMBRE OXY PEEL BUBBLE CLEANSER", sort_order: 0 },
        { product_code: "1", name: "DESEMBRE MILK ESSENTIAL CLEANSER", sort_order: 0 },
        { product_code: "3", name: "DESEMBRE REPAIR MOUSSE CLEANSER", sort_order: 0 },
        { product_code: "4", name: "DESEMBRE ENZYME POWDER CLEANSER", sort_order: 0 },
        { product_code: "2", name: "DESEMBRE DERMA SCIENCE WATER CLEANSER", sort_order: 0 },
        {
          product_code: "6",
          name: "DESEMBRE MEDI EPI SCIENCE P.SKIN CARE CLEANSING GEL",
          sort_order: 0,
        },
        { product_code: "7", name: "DESEMBRE HEMP OIL CLEANSER", sort_order: 0 },
        { product_code: "8", name: "DESEMBRE ROSE ESSENCE TONER", sort_order: 0 },
      ];

      const sorted = sortCatalogProducts(mockCatalogProducts);

      expect(sorted[0].name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
      expect(sorted[1].name).toBe("DESEMBRE DERMA SCIENCE WATER CLEANSER");
      expect(sorted[2].name).toBe("DESEMBRE REPAIR MOUSSE CLEANSER");
      expect(sorted[3].name).toBe("DESEMBRE ENZYME POWDER CLEANSER");
      expect(sorted[4].name).toBe("DESEMBRE OXY PEEL BUBBLE CLEANSER");
    });
  });

  describe("Task 6.4: Filtering preserves relative sorted order", () => {
    it("preserves relative order after search/filter", () => {
      const items: SortableCatalogProduct[] = [
        { product_code: "1", name: "DESEMBRE MILK ESSENTIAL CLEANSER", sort_order: 0 },
        { product_code: "2", name: "DESEMBRE DERMA SCIENCE WATER CLEANSER", sort_order: 0 },
        { product_code: "3", name: "DESEMBRE REPAIR MOUSSE CLEANSER", sort_order: 0 },
        { product_code: "4", name: "DESEMBRE ENZYME POWDER CLEANSER", sort_order: 0 },
        { product_code: "5", name: "DESEMBRE OXY PEEL BUBBLE CLEANSER", sort_order: 0 },
        { product_code: "10", name: "DESEMBRE MADETOX MIST", sort_order: 0 },
      ];

      const sorted = sortCatalogProducts(items);

      // Filter by "CLEANSER"
      const filtered = sorted.filter((p) => p.name.includes("CLEANSER"));

      expect(filtered.map((p) => p.product_code)).toEqual(["1", "2", "3", "4", "5"]);
    });
  });

  describe("Task 6.5: stableProductSort backwards-compatibility in catalogSort.ts", () => {
    it("stableProductSort sorts by numeric product_code as primary rule", () => {
      const list = [
        { product_code: "10", name: "Product 10", sort_order: 0 },
        { product_code: "2", name: "Product 2", sort_order: 0 },
        { product_code: "1", name: "Product 1", sort_order: 0 },
      ];

      const sorted = stableProductSort(list);
      expect(sorted.map((p) => p.product_code)).toEqual(["1", "2", "10"]);
    });
  });
});
