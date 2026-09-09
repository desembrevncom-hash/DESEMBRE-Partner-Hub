import { describe, it, expect } from "vitest";
import { canGenerateSalesSheet } from "../src/lib/salesSheetEligibility";
import { buildPublicProductProfile, getProductLaunchStatus } from "../src/lib/publicProductProfile";
import { INTERNAL_SENSITIVE_FIELDS } from "../src/lib/productLaunchValidation";
import fs from "fs";
import path from "path";

describe("Sales Sheet Eligibility & Launch Readiness Gates (Milestone 4)", () => {
  const approvedKnowledge = {
    catalog_product_id: "prod-desembre-mousse",
    qa_status: "approved",
    is_active: true,
    is_public: true,
    product_characteristics: "Bọt rửa mặt sinh học làm sạch dịu nhẹ",
    benefits: "Làm sạch sâu bã nhờn, cân bằng pH da",
    usage_instructions: "Thoa 1-2 păm bọt massage nhẹ nhàng",
  };

  it("1. Product without guidebook cannot generate Sales Sheet", () => {
    const result = canGenerateSalesSheet({
      hasGuidebook: false,
      hasExtractedGuidebook: false,
      knowledge: approvedKnowledge,
    });

    expect(result.ok).toBe(false);
    expect(result.blockingReasons).toContain("Chưa có Guidebook/Text nguồn");
  });

  it("2. Product with guidebook but not extracted cannot generate Sales Sheet", () => {
    const result = canGenerateSalesSheet({
      hasGuidebook: true,
      hasExtractedGuidebook: false,
      knowledge: approvedKnowledge,
    });

    expect(result.ok).toBe(false);
    expect(result.blockingReasons).toContain("Guidebook chưa trích xuất");
  });

  it("3. Product with extracted guidebook but draft/unapproved knowledge cannot generate Sales Sheet", () => {
    const draftKnowledge = {
      ...approvedKnowledge,
      qa_status: "draft",
    };

    const result = canGenerateSalesSheet({
      hasGuidebook: true,
      hasExtractedGuidebook: true,
      knowledge: draftKnowledge,
    });

    expect(result.ok).toBe(false);
    expect(result.blockingReasons).toContain("Tri thức AI chưa duyệt");
  });

  it("4. Product with extracted guidebook and approved active knowledge can generate Sales Sheet", () => {
    const result = canGenerateSalesSheet({
      hasGuidebook: true,
      hasExtractedGuidebook: true,
      knowledge: approvedKnowledge,
    });

    expect(result.ok).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it("5. Sales Sheet customer mode uses same PublicProductProfile fields as ProductDetailModal and strips internal fields", () => {
    const rawSalesSheetKnowledge = {
      benefits: "Làm sạch sâu, Cân bằng pH",
      ingredient_highlights: ["Micro Foam", "Tea Tree"],
      full_ingredients: "Aqua, Sodium Laureth Sulfate, Paraben",
      sales_pitch: "Bán kèm Toner cho hiệu quả gấp đôi",
      sales_notes: ["Gợi ý chốt đơn theo liệu trình 3 chai"],
      consultation_notes: "Ghi chú nội bộ cho Telesale",
      raw_text: "Text thô",
    };

    const sanitizedCustomerProfile = buildPublicProductProfile(
      rawSalesSheetKnowledge as Record<string, unknown>,
    );

    expect(sanitizedCustomerProfile.benefits).toBe("Làm sạch sâu, Cân bằng pH");
    expect(sanitizedCustomerProfile.ingredient_highlights).toEqual(["Micro Foam", "Tea Tree"]);

    for (const field of INTERNAL_SENSITIVE_FIELDS) {
      expect((sanitizedCustomerProfile as Record<string, unknown>)[field]).toBeUndefined();
    }
  });

  it("6. Server-side Edge Function code checks for MISSING_GUIDEBOOK, GUIDEBOOK_NOT_EXTRACTED, KNOWLEDGE_NOT_APPROVED", () => {
    const edgeFunctionPath = path.resolve(
      __dirname,
      "../supabase/functions/generate-product-sales-sheet/index.ts",
    );
    const code = fs.readFileSync(edgeFunctionPath, "utf-8");

    expect(code).toContain("MISSING_GUIDEBOOK");
    expect(code).toContain("GUIDEBOOK_NOT_EXTRACTED");
    expect(code).toContain("KNOWLEDGE_NOT_APPROVED");
  });

  it("7. Launch status badges compute correct states", () => {
    const readyStatus = getProductLaunchStatus(approvedKnowledge, {
      hasSourceDocs: true,
      hasCompletedGuidebook: true,
      salesSheetStatus: "approved",
    });

    expect(readyStatus.isLaunchReady).toBe(true);
    expect(readyStatus.guidebookStatus).toBe("extracted");
    expect(readyStatus.knowledgeStatus).toBe("approved");
    expect(readyStatus.salesSheetStatus).toBe("approved");
    expect(readyStatus.publicStatus).toBe("public_ready");

    const unreadyStatus = getProductLaunchStatus(
      { ...approvedKnowledge, is_public: false },
      {
        hasSourceDocs: true,
        hasCompletedGuidebook: false,
        salesSheetStatus: "draft",
      },
    );

    expect(unreadyStatus.isLaunchReady).toBe(false);
    expect(unreadyStatus.guidebookStatus).toBe("saved");
    expect(unreadyStatus.salesSheetStatus).toBe("draft");
    expect(unreadyStatus.publicStatus).toBe("draft");
  });
});
