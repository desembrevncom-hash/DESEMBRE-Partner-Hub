import { describe, expect, it } from "vitest";
import { mapDbProductToPublic } from "../src/features/catalog/catalogParityUtils";
import type { PublicCatalogProductDb } from "../src/lib/publicCatalogDb";
import type { ProductOverrideSafe } from "../src/features/catalog/catalogParityUtils";

describe("Public Catalog Knowledge Gating & Protection Rules", () => {
  const dummyDbProduct: PublicCatalogProductDb = {
    id: "prod-uuid-123",
    product_code: "101",
    name: "Derma Science Pure Cleansing Milk",
    brand_name: "Desembre",
    brand_code: "DES",
    brand_id: "brand-1",
    category_name: "Làm sạch",
    category_slug: "cleanser",
    description: "Sữa rửa mặt dịu nhẹ cân bằng da",
    image_url: "https://example.com/cleanser.jpg",
    sort_order: 1,
    retailVariants: [
      {
        id: "v1",
        product_id: "prod-uuid-123",
        channel: "retail",
        size_label: "150ml",
        price: 650000,
        is_active: true,
      },
    ],
    salonVariants: [
      {
        id: "v2",
        product_id: "prod-uuid-123",
        channel: "salon",
        size_label: "1000ml",
        price: 1800000,
        is_active: true,
      },
    ],
  };

  const emptyOverrideMap = new Map<string | number, ProductOverrideSafe>();

  describe("1. Knowledge Gating: Approved & Public Only", () => {
    it("maps knowledge fields when knowledge is approved and public", () => {
      const approvedPublicKnowledge = {
        usageInstructions: "Lấy 2-3 pump massage nhẹ nhàng 2 phút rồi rửa sạch.",
        benefits: "Làm sạch sâu mà không gây khô căng da.",
        skinConcerns: ["Mụn đầu đen", "Bít tắc lỗ chân lông"],
        warnings: "Tránh tiếp xúc trực tiếp vào mắt.",
        ingredientHighlights: ["Chiết xuất tràm trà", "Glycerin thực vật"],
        skinTypes: ["Da dầu", "Da hỗn hợp"],
      };

      const { product } = mapDbProductToPublic(
        dummyDbProduct,
        emptyOverrideMap,
        approvedPublicKnowledge,
        true,
      );

      expect(product.benefits).toBe(approvedPublicKnowledge.benefits);
      expect(product.usageInstructions).toBe(approvedPublicKnowledge.usageInstructions);
      expect(product.skinConcerns).toEqual(approvedPublicKnowledge.skinConcerns);
      expect(product.warnings).toBe(approvedPublicKnowledge.warnings);
      expect(product.ingredientHighlights).toEqual(approvedPublicKnowledge.ingredientHighlights);
      expect(product.skinTypes).toEqual(approvedPublicKnowledge.skinTypes);
    });

    it("filters out knowledge if knowledge is unapproved (draft/review) or private", () => {
      const { product } = mapDbProductToPublic(
        dummyDbProduct,
        emptyOverrideMap,
        undefined,
        true,
      );

      expect(product.benefits).toBeUndefined();
      expect(product.usageInstructions).toBeUndefined();
      expect(product.skinConcerns).toBeUndefined();
      expect(product.warnings).toBeUndefined();
      expect(product.ingredientHighlights).toBeUndefined();
      expect(product.skinTypes).toBeUndefined();
    });
  });

  describe("2. Security: Never Expose Guidebook Raw URLs or Unapproved Documents", () => {
    it("never includes guidebook files, file URLs, or raw extraction text in PublicProduct", () => {
      const approvedPublicKnowledge = {
        usageInstructions: "Sử dụng hàng ngày",
        benefits: "Dưỡng ẩm",
      };

      const { product } = mapDbProductToPublic(
        dummyDbProduct,
        emptyOverrideMap,
        approvedPublicKnowledge,
        true,
      );

      // PublicProduct data contract must NOT expose any guidebook keys
      const productKeys = Object.keys(product);
      expect(productKeys).not.toContain("guidebook_url");
      expect(productKeys).not.toContain("file_url");
      expect(productKeys).not.toContain("extracted_text");
      expect(productKeys).not.toContain("raw_guidebook");
      expect(productKeys).not.toContain("source_documents");
    });
  });

  describe("3. Sales Sheet Public Sharing Guard", () => {
    it("defaults sales sheet is_public to false for internal security", () => {
      const defaultSalesSheetPayload = {
        catalog_product_id: dummyDbProduct.id,
        title: "Sales Sheet - Derma Science Pure Cleansing Milk",
        status: "draft",
        is_public: false,
      };

      expect(defaultSalesSheetPayload.is_public).toBe(false);
      expect(defaultSalesSheetPayload.status).toBe("draft");
    });
  });
});
