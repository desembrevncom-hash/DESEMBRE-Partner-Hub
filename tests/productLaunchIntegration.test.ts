import { describe, it, expect } from "vitest";
import {
  validateProductLaunchReady,
  sanitizePublicProductKnowledge,
  INTERNAL_SENSITIVE_FIELDS,
} from "../src/lib/productLaunchValidation";

describe("Milestone 1.5 Product Launch Integration & Privacy Boundaries", () => {
  describe("1. Admin cannot save public approved knowledge if required fields are missing", () => {
    it("blocks saving when qa_status='approved', is_active=true, is_public=true but required fields are missing", () => {
      const incompletePayload = {
        catalog_product_id: "cat-prod-999",
        qa_status: "approved",
        is_active: true,
        is_public: true,
        product_characteristics: "", // Missing
        benefits: "   ", // Empty whitespace
        usage_instructions: null, // Null
      };

      const validation = validateProductLaunchReady(incompletePayload);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Trường bắt buộc còn thiếu: product_characteristics",
      );
      expect(validation.errors).toContain("Trường bắt buộc còn thiếu: benefits");
      expect(validation.errors).toContain(
        "Trường bắt buộc còn thiếu: usage_instructions",
      );
    });

    it("allows saving when all required fields are present", () => {
      const validPayload = {
        catalog_product_id: "cat-prod-999",
        qa_status: "approved",
        is_active: true,
        is_public: true,
        product_characteristics: "Kết cấu dạng kem mỏng nhẹ",
        benefits: "Cấp ẩm và phục hồi da",
        usage_instructions: "Thoa 2 lần mỗi ngày",
      };

      const validation = validateProductLaunchReady(validPayload);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe("2. Public catalog receives sanitized knowledge only", () => {
    it("strips all 7 internal/sensitive fields before catalog state ingestion", () => {
      const rawKnowledgeFromDb = {
        catalog_product_id: "cat-123",
        product_characteristics: "Kem dưỡng sinh học",
        benefits: "Phục hồi da",
        usage_instructions: "Dùng tối",
        ingredient_highlights: ["Peptide", "Niacinamide"],
        skin_types: ["Da nhạy cảm"],
        warnings: "Tránh xa tầm tay trẻ em",

        // Forbidden internal fields
        full_ingredients: "Water, Glycerin, Paraben, Synthetic Fragrance...",
        sales_pitch: "Sản phẩm chiến lược mang lại lợi nhuận 40%",
        consultation_notes: "Chú ý hỏi khách hàng về tiền sử dị ứng",
        objections: [{ type: "Giá", answer: "Nhấn mạnh công nghệ Hàn Quốc" }],
        raw_text: "File PDF thô từ nhà sản xuất",
        extracted_text: "Văn bản trích xuất thô",
        file_url: "https://storage.supabase.co/private/document.pdf",
      };

      const sanitized = sanitizePublicProductKnowledge(rawKnowledgeFromDb);

      // Public fields present
      expect(sanitized.catalog_product_id).toBe("cat-123");
      expect(sanitized.product_characteristics).toBe("Kem dưỡng sinh học");
      expect(sanitized.benefits).toBe("Phục hồi da");
      expect(sanitized.usage_instructions).toBe("Dùng tối");

      // Forbidden internal fields absent
      for (const field of INTERNAL_SENSITIVE_FIELDS) {
        expect((sanitized as Record<string, unknown>)[field]).toBeUndefined();
      }
    });
  });

  describe("3. ProductDetailModal does not render full_ingredients", () => {
    it("ensures public product model schema contains no full_ingredients field", () => {
      const publicProductMock = {
        id: "prod-1",
        name: "Desembre Repair Cream",
        brandName: "Desembre",
        categoryName: "Kem dưỡng",
        publicSizes: ["50ml"],
        publicPriceItems: [
          { sizeLabel: "50ml", channel: "retail" as const, price: 500000, requiresContact: false },
        ],
        benefits: "Cấp ẩm sâu",
        usageInstructions: "Thoa nhẹ nhàng",
      };

      expect((publicProductMock as Record<string, unknown>).full_ingredients).toBeUndefined();
      expect((publicProductMock as Record<string, unknown>).fullIngredients).toBeUndefined();
    });
  });

  describe("4. Customer Sales Sheet does not render internal fields", () => {
    it("sanitizes sales sheet knowledge data when audience is customer", () => {
      const salesSheetKnowledge = {
        benefits: ["Làm dịu da", "Giảm đỏ"],
        ingredient_highlights: ["Aloe Vera", "Centella"],
        full_ingredients: "Water, Alcohol, Fragrance, Chemical Preservatives",
        sales_pitch: "Gợi ý chốt đơn combo cùng Serum",
        consultation_notes: "Ghi chú nội bộ cho Telesale",
        raw_text: "Thô",
      };

      const sanitizedForCustomer = sanitizePublicProductKnowledge(salesSheetKnowledge);

      expect(sanitizedForCustomer.benefits).toEqual(["Làm dịu da", "Giảm đỏ"]);
      expect(sanitizedForCustomer.ingredient_highlights).toEqual(["Aloe Vera", "Centella"]);

      // Internal fields stripped
      expect((sanitizedForCustomer as Record<string, unknown>).full_ingredients).toBeUndefined();
      expect((sanitizedForCustomer as Record<string, unknown>).sales_pitch).toBeUndefined();
      expect((sanitizedForCustomer as Record<string, unknown>).consultation_notes).toBeUndefined();
      expect((sanitizedForCustomer as Record<string, unknown>).raw_text).toBeUndefined();
    });
  });
});
