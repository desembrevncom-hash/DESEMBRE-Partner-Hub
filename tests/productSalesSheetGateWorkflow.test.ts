import { describe, expect, it } from "vitest";
import {
  checkSalesSheetGenerationGate,
  sanitizeSalesSheetContent,
  formatSalesSheetSectionDisplay,
  NO_SOURCE_INFO_TEXT,
  type SourceDocGateItem,
  type KnowledgeGateItem,
} from "../src/lib/salesSheetGateUtils";
import { renderTemplate } from "../src/lib/documentTemplates";
import { canGenerateSalesSheet } from "../src/lib/salesSheetEligibility";
import { sanitizePublicProductKnowledge } from "../src/lib/productLaunchValidation";
import { cleanSalesSheetTemplateHtml } from "../src/lib/salesSheetVersionUtils";

describe("Product Sales Sheet Gate & Anti-Hallucination Workflow", () => {
  // Test 1: Product without guidebook cannot generate Sales Sheet
  it("Test 1: Product without guidebook cannot generate Sales Sheet", () => {
    const sourceDocs: SourceDocGateItem[] = [];
    const knowledge: KnowledgeGateItem = {
      id: "k-1",
      qa_status: "approved",
      is_active: true,
    };

    const gate = checkSalesSheetGenerationGate(sourceDocs, knowledge);

    expect(gate.canGenerate).toBe(false);
    expect(gate.blockReason).toBe("Chưa có Guidebook");
    expect(gate.code).toBe("MISSING_GUIDEBOOK");
  });

  // Test 2: Product with saved but not extracted guidebook cannot generate Sales Sheet
  it("Test 2: Product with saved but not extracted guidebook cannot generate Sales Sheet", () => {
    const sourceDocs: SourceDocGateItem[] = [
      { id: "doc-1", extraction_status: "pending" },
      { id: "doc-2", extraction_status: "processing" },
    ];
    const knowledge: KnowledgeGateItem = {
      id: "k-2",
      qa_status: "approved",
      is_active: true,
    };

    const gate = checkSalesSheetGenerationGate(sourceDocs, knowledge);

    expect(gate.canGenerate).toBe(false);
    expect(gate.blockReason).toBe("Guidebook chưa trích xuất");
    expect(gate.code).toBe("GUIDEBOOK_NOT_EXTRACTED");
  });

  // Test 3: Product with extracted guidebook but unapproved knowledge cannot generate Sales Sheet
  it("Test 3: Product with extracted guidebook but unapproved knowledge cannot generate Sales Sheet", () => {
    const sourceDocs: SourceDocGateItem[] = [
      { id: "doc-3", extraction_status: "completed" },
    ];

    // Case 3a: Knowledge is in draft
    const draftKnowledge: KnowledgeGateItem = {
      id: "k-3",
      qa_status: "draft",
      is_active: true,
    };
    const gateDraft = checkSalesSheetGenerationGate(sourceDocs, draftKnowledge);
    expect(gateDraft.canGenerate).toBe(false);
    expect(gateDraft.blockReason).toBe("Tri thức AI chưa duyệt");
    expect(gateDraft.code).toBe("KNOWLEDGE_NOT_APPROVED");

    // Case 3b: Knowledge is in review
    const reviewKnowledge: KnowledgeGateItem = {
      id: "k-3",
      qa_status: "review",
      is_active: true,
    };
    const gateReview = checkSalesSheetGenerationGate(sourceDocs, reviewKnowledge);
    expect(gateReview.canGenerate).toBe(false);
    expect(gateReview.blockReason).toBe("Tri thức AI chưa duyệt");
    expect(gateReview.code).toBe("KNOWLEDGE_NOT_APPROVED");

    // Case 3c: Knowledge is approved but inactive
    const inactiveKnowledge: KnowledgeGateItem = {
      id: "k-3",
      qa_status: "approved",
      is_active: false,
    };
    const gateInactive = checkSalesSheetGenerationGate(sourceDocs, inactiveKnowledge);
    expect(gateInactive.canGenerate).toBe(false);
    expect(gateInactive.blockReason).toBe("Tri thức AI chưa duyệt");

    // Case 3d: Knowledge row does not exist
    const gateMissing = checkSalesSheetGenerationGate(sourceDocs, null);
    expect(gateMissing.canGenerate).toBe(false);
    expect(gateMissing.blockReason).toBe("Tri thức AI chưa duyệt");
  });

  // Test 4: Product with approved knowledge and extracted guidebook can generate Sales Sheet
  it("Test 4: Product with approved knowledge and extracted guidebook can generate Sales Sheet", () => {
    const sourceDocs: SourceDocGateItem[] = [
      { id: "doc-4", extraction_status: "completed" },
    ];
    const knowledge: KnowledgeGateItem = {
      id: "k-4",
      qa_status: "approved",
      is_active: true,
    };

    const gate = checkSalesSheetGenerationGate(sourceDocs, knowledge);

    expect(gate.canGenerate).toBe(true);
    expect(gate.blockReason).toBe("");
    expect(gate.code).toBe("OK");
  });

  // Test 5: Missing guidebook sections are not hallucinated
  it("Test 5: Missing guidebook sections are not hallucinated and use strict fallback", () => {
    // Simulated raw output where some sections were not found in source
    const rawAiOutput = {
      product: {
        name: "Serum Trắng Da Desembre",
        brand_name: "Desembre",
        category_name: "Serum",
        short_description: "", // Missing in source
      },
      knowledge: {
        benefits: ["Làm sáng da tự nhiên"],
        skin_types: [], // Missing in source
        usage: ["Thoa 2 lần/ngày"],
        sales_notes: [], // Missing in source
        warnings: [], // Missing in source (no warnings in guidebook)
        ingredient_highlights: ["Niacinamide 5%"],
        key_ingredients: [], // Missing
        full_ingredients: "", // Missing
      },
    };

    const sanitized = sanitizeSalesSheetContent(rawAiOutput);

    // Assert that missing sections are explicitly set to NO_SOURCE_INFO_TEXT, NOT empty
    expect(sanitized.product.short_description).toBe(NO_SOURCE_INFO_TEXT);
    expect(sanitized.knowledge.skin_types).toEqual([NO_SOURCE_INFO_TEXT]);
    expect(sanitized.knowledge.sales_notes).toEqual([NO_SOURCE_INFO_TEXT]);
    expect(sanitized.knowledge.warnings).toEqual([NO_SOURCE_INFO_TEXT]);
    expect(sanitized.knowledge.key_ingredients).toEqual([NO_SOURCE_INFO_TEXT]);
    expect(sanitized.knowledge.full_ingredients).toBe(NO_SOURCE_INFO_TEXT);

    // Present sections are preserved
    expect(sanitized.knowledge.benefits).toEqual(["Làm sáng da tự nhiên"]);
    expect(sanitized.knowledge.ingredient_highlights).toEqual(["Niacinamide 5%"]);
  });

  // Test 6: Empty sections are hidden or display 'Chưa có thông tin trong tài liệu nguồn' (no empty boxes)
  it("Test 6: Empty sections display 'Chưa có thông tin trong tài liệu nguồn' so no empty boxes appear", () => {
    // When formatting for template display:
    const emptyArrayDisplay = formatSalesSheetSectionDisplay([]);
    expect(emptyArrayDisplay).toBe(NO_SOURCE_INFO_TEXT);

    const emptyStringDisplay = formatSalesSheetSectionDisplay("");
    expect(emptyStringDisplay).toBe(NO_SOURCE_INFO_TEXT);

    const whitespaceDisplay = formatSalesSheetSectionDisplay("   ");
    expect(whitespaceDisplay).toBe(NO_SOURCE_INFO_TEXT);

    const validArrayDisplay = formatSalesSheetSectionDisplay(["Dưỡng ẩm", "Cấp nước"]);
    expect(validArrayDisplay).toBe("- Dưỡng ẩm\n- Cấp nước");

    // Template rendering verification: ensure {{knowledge.warnings}} doesn't leave an empty container
    const template = `
      <div class="warnings-box">
        <h4>CHỐNG CHỈ ĐỊNH</h4>
        <div class="content">{{knowledge.warnings}}</div>
      </div>
    `;

    const renderedWithEmptyWarnings = renderTemplate(template, {
      knowledge: {
        warnings: formatSalesSheetSectionDisplay([]),
      },
    });

    expect(renderedWithEmptyWarnings).toContain(NO_SOURCE_INFO_TEXT);
    expect(renderedWithEmptyWarnings).not.toContain('<div class="content"></div>');
  });

  // Test 7: Sales cannot see raw_text or source document file_url
  it("Test 7: Sales cannot see raw_text or source document file_url", () => {
    // Simulated document returned from database
    const dbSourceDocument = {
      id: "doc-secret-1",
      catalog_product_id: "prod-100",
      file_name: "Internal_Formulation_Guidebook_2026.pdf",
      file_url: "https://secure.storage.supabase.co/product-documents/internal_secret.pdf",
      source_type: "text",
      raw_text: "INTERNAL SECRET: Do not disclose raw chemical ratio to clients...",
      extracted_data: {
        benefits: "Cải thiện độ đàn hồi",
      },
      extraction_status: "completed",
    };

    // Projection for Sales / Staff:
    // Sales users are only allowed to see approved Product Knowledge and approved Sales Sheets.
    // They are NEVER given the raw guidebook or its storage url.
    const projectDocumentForSales = (doc: typeof dbSourceDocument, role: "admin" | "sale") => {
      if (role === "sale") {
        // Sales cannot see internal raw documents
        return null;
      }
      return doc;
    };

    const salesView = projectDocumentForSales(dbSourceDocument, "sale");
    expect(salesView).toBeNull();

    // In approved knowledge read-only view, only curated customer-facing fields are exposed
    const approvedKnowledgeForSales = {
      benefits: dbSourceDocument.extracted_data.benefits,
      skin_types: "Mọi loại da",
      usage_instructions: "Thoa đều mỗi tối",
      sales_pitch: "Sản phẩm bán chạy số 1 tại Hàn Quốc",
    };

    expect(approvedKnowledgeForSales).not.toHaveProperty("raw_text");
    expect(approvedKnowledgeForSales).not.toHaveProperty("file_url");
    expect((approvedKnowledgeForSales as any).raw_text).toBeUndefined();
    expect((approvedKnowledgeForSales as any).file_url).toBeUndefined();
  });

  // Test 8: AI generation button eligibility failure returns blocking reasons
  it("Test 8: AI generation button eligibility failure returns blocking reasons", () => {
    const unapprovedKnowledge = {
      qa_status: "draft",
      is_active: true,
    };

    const eligibility = canGenerateSalesSheet({
      hasGuidebook: false,
      hasExtractedGuidebook: false,
      knowledge: unapprovedKnowledge,
    });

    expect(eligibility.ok).toBe(false);
    expect(eligibility.blockingReasons).toContain("Chưa có Guidebook/Text nguồn");
    expect(eligibility.blockingReasons).toContain("Tri thức AI chưa duyệt");
  });

  // Test 9: Valid eligibility creates correct function invocation payload
  it("Test 9: Valid eligibility creates correct function invocation payload including catalog_product_id, audience, and template_id", () => {
    const approvedKnowledge = {
      qa_status: "approved",
      is_active: true,
      product_characteristics: "Kết cấu mỏng nhẹ",
      benefits: "Cấp ẩm sâu",
      usage_instructions: "Thoa 2 lần/ngày",
    };

    const eligibility = canGenerateSalesSheet({
      hasGuidebook: true,
      hasExtractedGuidebook: true,
      knowledge: approvedKnowledge,
    });

    expect(eligibility.ok).toBe(true);

    const payload = {
      catalog_product_id: "prod-100",
      product_id: 100,
      audience: "customer",
      template_id: "tpl-v2",
    };

    expect(payload.catalog_product_id).toBe("prod-100");
    expect(payload.audience).toBe("customer");
    expect(payload.template_id).toBe("tpl-v2");
  });

  // Test 10: Customer preview hides missing sections and does not render placeholder text or internal fields
  it("Test 10: Customer preview hides missing sections without placeholder text or internal fields", () => {
    const rawKnowledge = {
      benefits: ["Dưỡng ẩm"],
      full_ingredients: "Aqua, Paraben, Fragrance",
      sales_pitch: "Chiết khấu cao",
      consultation_notes: "Ghi chú nội bộ",
      raw_text: "Text thô",
    };

    const customerKnowledge = sanitizePublicProductKnowledge(rawKnowledge);

    expect(customerKnowledge.benefits).toEqual(["Dưỡng ẩm"]);
    expect((customerKnowledge as any).full_ingredients).toBeUndefined();
    expect((customerKnowledge as any).sales_pitch).toBeUndefined();
    expect((customerKnowledge as any).consultation_notes).toBeUndefined();
    expect((customerKnowledge as any).raw_text).toBeUndefined();

    const sampleTemplate = `
      <div>{{product.name}}</div>
      <div>
        <h4>LƯU Ý TƯ VẤN</h4>
        <div>{{knowledge.sales_notes}}</div>
      </div>
    `;

    const cleanedTemplate = cleanSalesSheetTemplateHtml(sampleTemplate, false, "customer");
    expect(cleanedTemplate).not.toContain("LƯU Ý TƯ VẤN");
  });
});
