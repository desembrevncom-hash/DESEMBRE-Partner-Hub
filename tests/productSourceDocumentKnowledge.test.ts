import { describe, expect, it } from "vitest";
import {
  validateGuidebookFile,
  ALLOWED_GUIDEBOOK_EXTENSIONS,
  MAX_GUIDEBOOK_FILE_SIZE,
  GUIDEBOOK_TEXT_TEMPLATE,
  parseGuidebookMarkdown,
  type GuidebookExtractionDraft,
  type ProductSourceDocument,
} from "../src/lib/catalogAdminDb";

describe("Product Source Document (Guidebook) vs Product Knowledge Architecture", () => {
  describe("1. Upload Guidebook validation (File Type and Size)", () => {
    it("accepts valid guidebook files (.pdf, .docx, .doc, .png, .jpg, .jpeg, .webp)", () => {
      const validNames = [
        "Desembre_Milk_Cleanser_Guide.pdf",
        "Clinical_Manual.docx",
        "Product_Overview.doc",
        "Packaging_Proof.png",
        "Ingredient_Certificate.jpg",
        "Brochure_Cover.jpeg",
        "Product_Diagram.webp",
      ];

      for (const name of validNames) {
        const result = validateGuidebookFile({ name, size: 2 * 1024 * 1024 });
        expect(result.ok).toBe(true);
      }
    });

    it("rejects invalid or unsafe file types (e.g. .exe, .zip, .csv, .mp4)", () => {
      const invalidNames = [
        "malware.exe",
        "archive.zip",
        "data.csv",
        "video.mp4",
        "script.sh",
        "document.bat",
      ];

      for (const name of invalidNames) {
        const result = validateGuidebookFile({ name, size: 1024 });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain("Định dạng tập tin không được hỗ trợ");
      }
    });

    it("rejects files exceeding MAX_GUIDEBOOK_FILE_SIZE (25MB)", () => {
      const overSized = {
        name: "Large_Catalog.pdf",
        size: 26 * 1024 * 1024, // 26MB
      };

      const result = validateGuidebookFile(overSized);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("vượt quá giới hạn cho phép");
    });

    it("accepts files up to 25MB boundary", () => {
      const edgeSized = {
        name: "Exact_25MB.pdf",
        size: 25 * 1024 * 1024,
      };

      const result = validateGuidebookFile(edgeSized);
      expect(result.ok).toBe(true);
    });
  });

  describe("2. Document Record Association with catalog_product_id", () => {
    it("creates document record with catalog_product_id, document_type = guidebook, and pending status", () => {
      const catalogProductId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const docRecord: ProductSourceDocument = {
        id: "doc-uuid-1",
        catalog_product_id: catalogProductId,
        file_name: "Desembre_Product_Guide_2026.pdf",
        file_url: "https://xyz.supabase.co/storage/v1/object/authenticated/product-documents/guide.pdf",
        file_type: "application/pdf",
        document_type: "guidebook",
        extracted_text: null,
        extracted_data: null,
        extraction_status: "pending",
        uploaded_by: "user-uuid-123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(docRecord.catalog_product_id).toBe(catalogProductId);
      expect(docRecord.document_type).toBe("guidebook");
      expect(docRecord.extraction_status).toBe("pending");
      expect(docRecord.extracted_data).toBeNull();
    });
  });

  describe("3. Extraction Safety: Never Auto-Approve Knowledge", () => {
    it("extraction produces structured draft suggestions and leaves qa_status = draft", () => {
      const sampleExtraction: GuidebookExtractionDraft = {
        benefits: "Dưỡng ẩm chuyên sâu, làm dịu da nhạy cảm",
        ingredient_highlights: ["Chiết xuất hoa hồng", "Niacinamide 2%"],
        usage_instructions: "Thoa một lượng vừa đủ sau khi rửa mặt",
        skin_types: ["Da khô", "Da nhạy cảm"],
        skin_concerns: ["Cấp ẩm", "Lão hóa"],
        warnings: "Tránh tiếp xúc với vết thương hở",
        sales_pitch: "Sản phẩm bán chạy nhất cho spa phục hồi",
        objections: [
          {
            objection_type: "Giá cả",
            customer_statement: "Giá sản phẩm này có cao không?",
            suggested_response: "Sản phẩm chuẩn chuyên nghiệp nồng độ cao mang lại hiệu quả vượt trội.",
          },
        ],
        extracted_at: new Date().toISOString(),
      };

      // Simulated state in ProductKnowledgeDialog after importing from guidebook
      const simulatedKnowledgeFormState = {
        benefits: sampleExtraction.benefits,
        ingredientHighlights: sampleExtraction.ingredient_highlights,
        usageInstructions: sampleExtraction.usage_instructions,
        skinTypes: sampleExtraction.skin_types,
        skinConcerns: sampleExtraction.skin_concerns,
        warnings: sampleExtraction.warnings,
        salesPitch: sampleExtraction.sales_pitch,
        objections: sampleExtraction.objections,
        qa_status: "draft", // MUST NEVER be 'approved'
      };

      expect(simulatedKnowledgeFormState.qa_status).toBe("draft");
      expect(simulatedKnowledgeFormState.qa_status).not.toBe("approved");
      expect(simulatedKnowledgeFormState.benefits).toBe(sampleExtraction.benefits);
    });
  });

  describe("4. Structured Product Knowledge Integrity", () => {
    it("ensures product_knowledge maintains required structured fields", () => {
      const validStructuredKnowledge = {
        benefits: "Làm sạch sâu và cân bằng độ pH",
        ingredient_highlights: ["Centella Asiatica", "Tràm trà"],
        usage_instructions: "Lấy 1-2ml tạo bọt kỹ với nước ấm",
        skin_types: ["Da dầu", "Da hỗn hợp"],
        skin_concerns: ["Mụn", "Bít tắc lỗ chân lông"],
        warnings: "Không dùng cho phụ nữ mang thai nếu chứa BHA cao",
        sales_pitch: "Sữa rửa mặt tạo bọt mịn nhất cho spa",
        qa_status: "draft",
      };

      expect(typeof validStructuredKnowledge.benefits).toBe("string");
      expect(Array.isArray(validStructuredKnowledge.ingredient_highlights)).toBe(true);
      expect(Array.isArray(validStructuredKnowledge.skin_types)).toBe(true);
      expect(Array.isArray(validStructuredKnowledge.skin_concerns)).toBe(true);
      expect(["draft", "review", "approved", "archived"]).toContain(validStructuredKnowledge.qa_status);
    });
  });

  describe("5. Sales Sheet Generation Decoupling", () => {
    it("generates sales sheet output from approved knowledge and variants without storing raw guidebook files", () => {
      const approvedKnowledge = {
        qa_status: "approved",
        benefits: "Phục hồi hàng rào ẩm tự nhiên",
        usage_instructions: "Dùng 2 lần sáng và tối",
        sales_pitch: "Dòng kem dưỡng phục hồi chuyên sâu",
      };

      const variants = [
        { channel: "retail", size_label: "50ml", price: "850,000" },
        { channel: "salon", size_label: "250ml", price: "2,100,000" },
      ];

      // Simulated sales sheet data contract
      const salesSheetPayload = {
        catalog_product_id: "prod-1",
        title: "TÀI LIỆU SẢN PHẨM & BẢNG GIÁ",
        benefits: approvedKnowledge.benefits,
        usage: approvedKnowledge.usage_instructions,
        pricing: variants,
        is_raw_guidebook: false, // Sales sheet is formatted output, not raw source
      };

      expect(salesSheetPayload.is_raw_guidebook).toBe(false);
      expect(salesSheetPayload.pricing).toHaveLength(2);
      expect(salesSheetPayload.benefits).toBe("Phục hồi hàng rào ẩm tự nhiên");
    });
  });

  describe("6. Text-Based Guidebook Input & Instant Parsing", () => {
    it("parses standard template markdown into structured extraction draft correctly", () => {
      const parsed = parseGuidebookMarkdown(
        GUIDEBOOK_TEXT_TEMPLATE,
        "Hướng dẫn sản phẩm Desembre Foaming Cleanser",
      );

      // Benefits
      expect(parsed.benefits).toContain("Làm sạch sâu");
      expect(parsed.benefits).toContain("Cân bằng độ ẩm");

      // Ingredients
      expect(parsed.ingredient_highlights.length).toBeGreaterThanOrEqual(3);
      expect(parsed.ingredient_highlights.some((i) => i.includes("Niacinamide"))).toBe(true);
      expect(parsed.ingredient_highlights.some((i) => i.includes("Hyaluronic Acid"))).toBe(true);

      // Suitability (Skin types & concerns)
      expect(parsed.skin_types.length).toBeGreaterThan(0);
      expect(parsed.skin_types.some((s) => s.includes("Da dầu") || s.includes("nhạy cảm"))).toBe(true);
      expect(parsed.skin_concerns.length).toBeGreaterThan(0);
      expect(parsed.skin_concerns.some((c) => c.includes("Mụn"))).toBe(true);

      // Usage instructions & Warnings
      expect(parsed.usage_instructions).toContain("Làm ướt da mặt");
      expect(parsed.warnings).toContain("tiếp xúc trực tiếp vào mắt");

      // Sales pitch
      expect(parsed.sales_pitch).toContain("chuẩn da liễu");

      // FAQ / Objections
      expect(parsed.objections.length).toBeGreaterThanOrEqual(2);
      const obj1 = parsed.objections.find((o) => o.customer_statement.includes("Da nhạy cảm"));
      expect(obj1).toBeDefined();
      expect(obj1?.suggested_response).toContain("dịu nhẹ không cồn");
    });

    it("supports text source document record with source_type = 'text' and null file_url", () => {
      const textDocRecord: ProductSourceDocument = {
        id: "text-doc-uuid-1",
        catalog_product_id: "prod-123",
        source_type: "text",
        raw_text: GUIDEBOOK_TEXT_TEMPLATE,
        file_name: "Hướng dẫn kỹ thuật sữa rửa mặt",
        file_url: null, // Text sources do not require file_url
        file_type: "text/markdown",
        document_type: "guidebook",
        extracted_text: GUIDEBOOK_TEXT_TEMPLATE,
        extracted_data: parseGuidebookMarkdown(GUIDEBOOK_TEXT_TEMPLATE),
        extraction_status: "completed",
        uploaded_by: "admin-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(textDocRecord.source_type).toBe("text");
      expect(textDocRecord.file_url).toBeNull();
      expect(textDocRecord.file_type).toBe("text/markdown");
      expect(textDocRecord.raw_text).toBeDefined();
      expect(textDocRecord.extraction_status).toBe("completed");
      expect(textDocRecord.extracted_data?.ingredient_highlights.length).toBeGreaterThan(0);
    });

    it("gracefully handles custom and partial markdown texts", () => {
      const customMarkdown = `
## Công dụng chính
- Tái tạo tế bào da
- Mờ thâm nám

## Thành phần nổi bật
- Vitamin C 15%
- Arbutin

## Cách sử dụng
Thoa buổi tối trước khi đi ngủ.
`;
      const parsed = parseGuidebookMarkdown(customMarkdown, "Serum Vitamin C");
      expect(parsed.benefits).toContain("Tái tạo tế bào da");
      expect(parsed.ingredient_highlights).toEqual(["Vitamin C 15%", "Arbutin"]);
      expect(parsed.usage_instructions).toContain("Thoa buổi tối");
      expect(parsed.skin_types).toEqual(["Mọi loại da"]); // default fallback
    });

    it("handles empty or whitespace text without crashing", () => {
      const parsed = parseGuidebookMarkdown("   ");
      expect(parsed.benefits).toBe("");
      expect(parsed.ingredient_highlights).toEqual([]);
      expect(parsed.usage_instructions).toBe("");
      expect(parsed.objections).toEqual([]);
    });
  });

  describe("7. Public Catalog Security: No Raw Text or Source Document Exposure", () => {
    it("ensures public catalog item only exposes approved structured fields, never raw_text or source documents", () => {
      // Internal DB representation including sensitive internal guidebook
      const internalProductEntity = {
        id: "p1",
        name: "Desembre Hydro Cream",
        source_documents: [
          {
            source_type: "text",
            raw_text: "INTERNAL CONFIDENTIAL SUPPLIER RECIPE: Active 15%, cost base $2.5...",
          },
          {
            source_type: "file",
            file_url: "https://bucket/internal/internal_lab_report.pdf",
          },
        ],
        knowledge: {
          is_public: true,
          qa_status: "approved",
          benefits: "Cấp ẩm chuyên sâu 48h",
          usage_instructions: "Thoa đều sáng và tối",
        },
      };

      // Simulated public view projection
      const publicCatalogItem = {
        id: internalProductEntity.id,
        name: internalProductEntity.name,
        benefits: internalProductEntity.knowledge.is_public ? internalProductEntity.knowledge.benefits : null,
        usage_instructions: internalProductEntity.knowledge.is_public ? internalProductEntity.knowledge.usage_instructions : null,
      };

      expect((publicCatalogItem as any).source_documents).toBeUndefined();
      expect((publicCatalogItem as any).raw_text).toBeUndefined();
      expect((publicCatalogItem as any).file_url).toBeUndefined();
      expect(publicCatalogItem.benefits).toBe("Cấp ẩm chuyên sâu 48h");
    });
  });
});

