import { describe, expect, it } from "vitest";
import {
  getPdfProductName,
  getPdfChannelLabel,
  getPdfProductSubtitle,
  type CatalogPDFItem,
} from "../src/components/CatalogPDF";

describe("CatalogPDF Quotation Rendering Helpers", () => {
  describe("getPdfProductName", () => {
    it("DB catalog item PDF shows product_name_snapshot", () => {
      const dbItem: CatalogPDFItem = {
        source: "db_catalog",
        product_name_snapshot: "DESEMBRE MILK ESSENTIAL CLEANSER",
        product_name: "Old Generic Name",
        display_name: "DESEMBRE MILK ESSENTIAL CLEANSER (Salon - 1000ml)",
        brand_name_snapshot: "DESEMBRE",
        channel_snapshot: "salon",
        size: "1000ml",
        unit_price: 1650000,
      };

      expect(getPdfProductName(dbItem)).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
    });

    it("legacy item PDF still shows product name", () => {
      const legacyItem: CatalogPDFItem = {
        source: "legacy_static",
        product_no: 1,
        name: "Desembre Milk Essential Cleanser",
        brand_name_snapshot: "Desembre",
        size_type: "salon",
        size: "1000ml",
        unit_price: 1650000,
      };

      expect(getPdfProductName(legacyItem)).toBe("Desembre Milk Essential Cleanser");
    });

    it("follows fallback precedence: product_name_snapshot -> product_name -> name -> display_name -> fallback", () => {
      // 1. product_name_snapshot highest precedence
      expect(
        getPdfProductName({
          product_name_snapshot: "Snapshot Name",
          product_name: "Product Name",
          name: "Name",
          display_name: "Display Name",
        }),
      ).toBe("Snapshot Name");

      // 2. product_name when snapshot is missing
      expect(
        getPdfProductName({
          product_name: "Product Name",
          name: "Name",
          display_name: "Display Name",
        }),
      ).toBe("Product Name");

      // 3. name when product_name is missing
      expect(
        getPdfProductName({
          name: "Name",
          display_name: "Display Name",
        }),
      ).toBe("Name");

      // 4. display_name when name is missing
      expect(
        getPdfProductName({
          display_name: "Display Name",
        }),
      ).toBe("Display Name");

      // 5. fallback when all missing
      expect(getPdfProductName({})).toBe("Sản phẩm");
      expect(getPdfProductName(null)).toBe("Sản phẩm");
      expect(getPdfProductName(undefined)).toBe("Sản phẩm");
    });

    it("never returns generic 'Dòng chuyên nghiệp' if actual product name exists", () => {
      const item: CatalogPDFItem = {
        product_name_snapshot: "DESEMBRE OXY PEEL BUBBLE CLEANSER",
        size_type: "salon",
        unit_price: 1200000,
      };

      const resolvedName = getPdfProductName(item);
      expect(resolvedName).toBe("DESEMBRE OXY PEEL BUBBLE CLEANSER");
      expect(resolvedName).not.toBe("Dòng chuyên nghiệp");
    });
  });

  describe("getPdfChannelLabel", () => {
    it("maps salon channel to 'Chuyên nghiệp'", () => {
      expect(getPdfChannelLabel({ channel_snapshot: "salon" })).toBe("Chuyên nghiệp");
      expect(getPdfChannelLabel({ size_type: "salon" })).toBe("Chuyên nghiệp");
      expect(getPdfChannelLabel({ channel: "salon" })).toBe("Chuyên nghiệp");
    });

    it("maps retail channel to 'Niêm yết'", () => {
      expect(getPdfChannelLabel({ channel_snapshot: "retail" })).toBe("Niêm yết");
      expect(getPdfChannelLabel({ size_type: "retail" })).toBe("Niêm yết");
      expect(getPdfChannelLabel({ channel: "retail" })).toBe("Niêm yết");
    });

    it("returns empty string for unknown channels", () => {
      expect(getPdfChannelLabel({})).toBe("");
      expect(getPdfChannelLabel(null)).toBe("");
    });
  });

  describe("getPdfProductSubtitle", () => {
    it("salon item shows actual product name + Chuyên nghiệp + size in subtitle", () => {
      const salonItem: CatalogPDFItem = {
        product_name_snapshot: "DESEMBRE MILK ESSENTIAL CLEANSER",
        brand_name_snapshot: "DESEMBRE",
        channel_snapshot: "salon",
        size: "1000ml",
        unit_price: 1650000,
      };

      const name = getPdfProductName(salonItem);
      const subtitle = getPdfProductSubtitle(salonItem);

      expect(name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
      expect(subtitle).toBe("DESEMBRE · Chuyên nghiệp · 1000ml");
    });

    it("retail item shows actual product name + Niêm yết + size in subtitle", () => {
      const retailItem: CatalogPDFItem = {
        product_name_snapshot: "DESEMBRE DERMA SCIENCE WATER CLEANSER",
        brand_name_snapshot: "DESEMBRE",
        channel_snapshot: "retail",
        size: "150ml",
        unit_price: 580000,
      };

      const name = getPdfProductName(retailItem);
      const subtitle = getPdfProductSubtitle(retailItem);

      expect(name).toBe("DESEMBRE DERMA SCIENCE WATER CLEANSER");
      expect(subtitle).toBe("DESEMBRE · Niêm yết · 150ml");
    });

    it("handles item with missing brand or size gracefully without breaking delimiters", () => {
      const itemWithoutBrand: CatalogPDFItem = {
        product_name_snapshot: "Sample Serum",
        channel_snapshot: "salon",
        size: "50ml",
        unit_price: 500000,
      };

      expect(getPdfProductSubtitle(itemWithoutBrand)).toBe("Chuyên nghiệp · 50ml");

      const itemWithoutSize: CatalogPDFItem = {
        product_name_snapshot: "Sample Cream",
        brand_name_snapshot: "DESEMBRE",
        channel_snapshot: "retail",
        unit_price: 300000,
      };

      expect(getPdfProductSubtitle(itemWithoutSize)).toBe("DESEMBRE · Niêm yết");
    });
  });
});
