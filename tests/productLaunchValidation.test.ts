import { describe, it, expect } from "vitest";
import {
  detectSensitiveClaims,
  validateProductLaunchReady,
  sanitizePublicProductKnowledge,
  SENSITIVE_CLAIM_KEYWORDS,
  INTERNAL_SENSITIVE_FIELDS,
} from "../src/lib/productLaunchValidation";

describe("productLaunchValidation", () => {
  describe("detectSensitiveClaims", () => {
    it("should return an empty array for empty, null, or clean text", () => {
      expect(detectSensitiveClaims(null)).toEqual([]);
      expect(detectSensitiveClaims(undefined)).toEqual([]);
      expect(detectSensitiveClaims("")).toEqual([]);
      expect(detectSensitiveClaims("Sản phẩm hỗ trợ làm sạch da và cấp ẩm dịu nhẹ.")).toEqual([]);
    });

    it("should detect all 8 sensitive claim phrases (case-insensitive)", () => {
      for (const phrase of SENSITIVE_CLAIM_KEYWORDS) {
        const text = `Sản phẩm này có khả năng ${phrase.toUpperCase()} hiệu quả.`;
        const detected = detectSensitiveClaims(text);
        expect(detected).toContain(phrase);
      }
    });

    it("should handle arrays and objects gracefully", () => {
      const input = ["Da mụn", "Cam kết khỏi hoàn toàn sau 7 ngày", "Không kích ứng 100%"];
      const detected = detectSensitiveClaims(input);
      expect(detected).toContain("cam kết khỏi");
      expect(detected).toContain("không kích ứng 100%");
    });

    it("should return deduplicated claims when multiple occurrences exist", () => {
      const text = "điều trị mụn, Hỗ trợ điều trị sẹo, ĐIỀU TRỊ tàn nhang";
      const detected = detectSensitiveClaims(text);
      expect(detected).toEqual(["điều trị"]);
    });
  });

  describe("validateProductLaunchReady", () => {
    const validRecord = {
      catalog_product_id: "prod-123",
      product_characteristics: "Kết cấu mỏng nhẹ, thấm nhanh",
      benefits: "Làm sạch bã nhờn, dưỡng ẩm tự nhiên",
      usage_instructions: "Thoa 2 lần mỗi ngày sáng và tối",
      ingredient_highlights: ["Hyaluronic Acid", "Niacinamide"],
      skin_types: ["Da dầu", "Da hỗn hợp"],
      warnings: "Tránh tiếp xúc trực tiếp với mắt",
      qa_status: "approved",
      is_active: true,
    };

    it("should pass validation for a complete, clean, approved record", () => {
      const result = validateProductLaunchReady(validRecord);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.sensitiveClaims).toEqual([]);
    });

    it("should fail validation if required fields are missing or empty", () => {
      const incompleteRecord = {
        ...validRecord,
        product_characteristics: "",
        benefits: "   ",
        usage_instructions: null,
      };

      const result = validateProductLaunchReady(incompleteRecord);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Trường bắt buộc còn thiếu: product_characteristics");
      expect(result.errors).toContain("Trường bắt buộc còn thiếu: benefits");
      expect(result.errors).toContain("Trường bắt buộc còn thiếu: usage_instructions");
    });

    it("should emit warnings for missing recommended fields without failing validation if required fields are present", () => {
      const recordMissingRecommended = {
        catalog_product_id: "prod-123",
        product_characteristics: "Đặc tính sản phẩm",
        benefits: "Công dụng sản phẩm",
        usage_instructions: "Hướng dẫn sử dụng",
        qa_status: "approved",
        is_active: true,
      };

      const result = validateProductLaunchReady(recordMissingRecommended);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toContain("Trường khuyến nghị còn thiếu: ingredient_highlights");
      expect(result.warnings).toContain("Trường khuyến nghị còn thiếu: skin_types");
      expect(result.warnings).toContain("Trường khuyến nghị còn thiếu: warnings");
    });

    it("should fail validation if qa_status is not approved or is_active is false", () => {
      const unapprovedRecord = {
        ...validRecord,
        qa_status: "draft",
        is_active: false,
      };

      const result = validateProductLaunchReady(unapprovedRecord);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Trạng thái QA chưa được duyệt (qa_status phải là 'approved')",
      );
      expect(result.errors).toContain(
        "Sản phẩm chưa ở trạng thái hoạt động (is_active phải là true)",
      );
    });

    it("should fail validation and capture sensitive claims when medical/exaggerated claims exist", () => {
      const sensitiveRecord = {
        ...validRecord,
        benefits: "Đặc trị mụn tận gốc, chữa khỏi mụn trứng cá và hết mụn 100%",
        sales_pitch: "Cam kết khỏi hoàn toàn sau 3 ngày dùng!",
      };

      const result = validateProductLaunchReady(sensitiveRecord);
      expect(result.isValid).toBe(false);
      expect(result.sensitiveClaims).toContain("chữa khỏi");
      expect(result.sensitiveClaims).toContain("hết mụn 100%");
      expect(result.sensitiveClaims).toContain("cam kết khỏi");
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle null/undefined input gracefully", () => {
      const result = validateProductLaunchReady(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Dữ liệu tri thức sản phẩm là bắt buộc");
    });
  });

  describe("sanitizePublicProductKnowledge", () => {
    it("should remove all 7 internal/sensitive fields while keeping public fields intact", () => {
      const rawKnowledge = {
        catalog_product_id: "prod-123",
        product_characteristics: "Kết cấu mỏng nhẹ",
        benefits: "Dưỡng ẩm da",
        usage_instructions: "Thoa đều toàn mặt",
        // Sensitive/Internal fields to be removed:
        full_ingredients: "Aqua, Mineral Oil, Paraben",
        sales_pitch: "Bán chạy nhất năm!",
        consultation_notes: "Ghi chú tư vấn nội bộ",
        objections: [{ question: "Giá cao?", answer: "Xứng đáng" }],
        raw_text: "Nội dung thô từ file pdf",
        extracted_text: "Nội dung sau khi OCR",
        file_url: "https://storage.example.com/guidebook.pdf",
      };

      const sanitized = sanitizePublicProductKnowledge(rawKnowledge);

      // Verify public fields are preserved
      expect(sanitized.catalog_product_id).toBe("prod-123");
      expect(sanitized.product_characteristics).toBe("Kết cấu mỏng nhẹ");
      expect(sanitized.benefits).toBe("Dưỡng ẩm da");
      expect(sanitized.usage_instructions).toBe("Thoa đều toàn mặt");

      // Verify internal/sensitive fields are completely removed
      for (const field of INTERNAL_SENSITIVE_FIELDS) {
        expect((sanitized as Record<string, unknown>)[field]).toBeUndefined();
      }
    });

    it("should handle null or non-object input gracefully", () => {
      expect(sanitizePublicProductKnowledge(null as unknown as Record<string, unknown>)).toEqual(
        {},
      );
      expect(
        sanitizePublicProductKnowledge(undefined as unknown as Record<string, unknown>),
      ).toEqual({});
    });
  });
});
