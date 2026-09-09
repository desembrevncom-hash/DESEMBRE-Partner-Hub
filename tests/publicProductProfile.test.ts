import { describe, it, expect } from "vitest";
import { buildPublicProductProfile, getProductLaunchStatus } from "../src/lib/publicProductProfile";
import { INTERNAL_SENSITIVE_FIELDS } from "../src/lib/productLaunchValidation";

describe("publicProductProfile - Single Source of Truth (Milestone 3)", () => {
  const rawInput = {
    id: "prod-100",
    catalog_product_id: "cat-100",
    product_id: 100,
    name: "Desembre Oxygen Water Cream",
    brand_name: "Desembre",
    category_name: "Kem dưỡng",
    short_description: "Kem cấp ẩm bong bóng oxy",
    description: "Công nghệ khóa ẩm sinh học vượt trội",
    image_url: "https://example.com/cream.png",
    product_characteristics: "Kết cấu mỏng nhẹ thẩm thấu nhanh",
    benefits: "Dưỡng ẩm sâu và tái tạo da",
    usage_instructions: "Thoa 2 lần mỗi ngày sáng và tối",
    ingredient_highlights: ["Oxygen Water", "Peptide Complex"],
    skin_types: ["Da dầu", "Da hỗn hợp"],
    skin_concerns: ["Da thiếu nước"],
    warnings: "Tránh thoa lên mắt",
    qa_status: "approved",
    is_active: true,
    is_public: true,

    // Forbidden internal/sensitive fields
    full_ingredients: "Aqua, Mineral Oil, Petrolatum, Paraben",
    sales_pitch: "Chiết khấu 35% cho đại lý spa",
    consultation_notes: "Ghi chú chốt đơn riêng cho Sales",
    sales_notes: ["Gợi ý bán kèm Serum"],
    objections: [{ question: "Giá cao?", answer: "Hàng Hàn Quốc cao cấp" }],
    raw_text: "Văn bản file pdf thô",
    extracted_text: "Văn bản trích xuất OCR",
    file_url: "https://storage.example.com/guidebook.pdf",
  };

  describe("1. buildPublicProductProfile Sanitization & Normalization", () => {
    it("strips full_ingredients completely", () => {
      const profile = buildPublicProductProfile(rawInput);
      expect((profile as Record<string, unknown>).full_ingredients).toBeUndefined();
      expect((profile as Record<string, unknown>).fullIngredients).toBeUndefined();
    });

    it("strips sales_pitch, consultation_notes, sales_notes, objections, and raw files", () => {
      const profile = buildPublicProductProfile(rawInput);
      for (const field of INTERNAL_SENSITIVE_FIELDS) {
        expect((profile as Record<string, unknown>)[field]).toBeUndefined();
      }
      expect((profile as Record<string, unknown>).sales_notes).toBeUndefined();
    });

    it("ensures Product Detail Modal and Customer Sales Sheet receive the exact same public fields", () => {
      const profile = buildPublicProductProfile(rawInput);

      expect(profile.name).toBe("Desembre Oxygen Water Cream");
      expect(profile.brand_name).toBe("Desembre");
      expect(profile.category_name).toBe("Kem dưỡng");
      expect(profile.benefits).toBe("Dưỡng ẩm sâu và tái tạo da");
      expect(profile.usage_instructions).toBe("Thoa 2 lần mỗi ngày sáng và tối");
      expect(profile.ingredient_highlights).toEqual(["Oxygen Water", "Peptide Complex"]);
      expect(profile.skin_types).toEqual(["Da dầu", "Da hỗn hợp"]);
      expect(profile.warnings).toBe("Tránh thoa lên mắt");
    });

    it("does not auto-fill or add dummy placeholder text for missing sections", () => {
      const sparseInput = {
        name: "Desembre Pure Serum",
        benefits: "Cấp ẩm",
        // missing description, usage_instructions, warnings, skin_types
      };

      const profile = buildPublicProductProfile(sparseInput);

      expect(profile.name).toBe("Desembre Pure Serum");
      expect(profile.benefits).toBe("Cấp ẩm");
      expect(profile.description).toBeUndefined();
      expect(profile.usage_instructions).toBeUndefined();
      expect(profile.warnings).toBeUndefined();
      expect(profile.skin_types).toBeUndefined();
      expect(profile.ingredient_highlights).toBeUndefined();
    });
  });

  describe("2. getProductLaunchStatus Launch Readiness Helper", () => {
    it("fails launch readiness if knowledge is not approved (qa_status != approved)", () => {
      const draftInput = {
        ...rawInput,
        qa_status: "draft",
      };

      const status = getProductLaunchStatus(draftInput);

      expect(status.isLaunchReady).toBe(false);
      expect(status.publicStatus).toBe("draft");
      expect(status.blockingReasons).toContain(
        "Tri thức chưa được duyệt QA (qa_status phải là 'approved')",
      );
    });

    it("fails launch readiness if is_public is false or missing", () => {
      const privateInput = {
        ...rawInput,
        is_public: false,
      };

      const status = getProductLaunchStatus(privateInput);

      expect(status.isLaunchReady).toBe(false);
      expect(status.publicStatus).toBe("draft");
      expect(status.blockingReasons).toContain(
        "Sản phẩm chưa bật chế độ công khai (is_public phải là true)",
      );
    });

    it("passes launch readiness when qa_status='approved', is_active=true, is_public=true and all required public fields exist", () => {
      const status = getProductLaunchStatus(rawInput);

      expect(status.isLaunchReady).toBe(true);
      expect(status.publicStatus).toBe("public_ready");
      expect(status.blockingReasons).toEqual([]);
    });

    it("fails launch readiness and returns blocking errors when required public fields are missing", () => {
      const incompleteInput = {
        ...rawInput,
        product_characteristics: "",
        benefits: "",
      };

      const status = getProductLaunchStatus(incompleteInput);

      expect(status.isLaunchReady).toBe(false);
      expect(status.publicStatus).toBe("draft");
      expect(status.blockingReasons).toContain(
        "Trường bắt buộc còn thiếu: product_characteristics",
      );
      expect(status.blockingReasons).toContain("Trường bắt buộc còn thiếu: benefits");
    });
  });
});
