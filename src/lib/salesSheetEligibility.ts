import { validateProductLaunchReady } from "./productLaunchValidation";

export interface SalesSheetEligibilityInput {
  hasGuidebook?: boolean;
  hasExtractedGuidebook?: boolean;
  knowledge?: Record<string, unknown> | null;
}

export interface SalesSheetEligibilityResult {
  ok: boolean;
  blockingReasons: string[];
  warnings: string[];
}

/**
 * Checks whether a product meets all eligibility requirements to generate an AI Product Sales Sheet.
 */
export function canGenerateSalesSheet(
  input: SalesSheetEligibilityInput,
): SalesSheetEligibilityResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // 1. Check Guidebook document presence
  if (!input.hasGuidebook) {
    blockingReasons.push("Chưa có Guidebook/Text nguồn");
  } else if (!input.hasExtractedGuidebook) {
    blockingReasons.push("Guidebook chưa trích xuất");
  }

  // 2. Check AI Knowledge state
  if (!input.knowledge) {
    blockingReasons.push("Chưa có tri thức sản phẩm");
  } else {
    const qaStatus = input.knowledge.qa_status;
    const isActive = input.knowledge.is_active;

    if (qaStatus !== "approved") {
      blockingReasons.push("Tri thức AI chưa duyệt");
    }

    if (isActive === false) {
      blockingReasons.push("Tri thức AI chưa bật Active");
    }

    // 3. Anti-hallucination validation layer check
    const validation = validateProductLaunchReady(input.knowledge);
    if (!validation.isValid) {
      for (const err of validation.errors) {
        // Exclude qa_status and is_active duplicate messages as they are formatted above
        if (
          !err.includes("qa_status") &&
          !err.includes("is_active") &&
          !blockingReasons.includes(err)
        ) {
          // Format user-friendly descriptions
          if (err.includes("product_characteristics")) {
            blockingReasons.push("Thiếu đặc tính sản phẩm");
          } else if (err.includes("benefits")) {
            blockingReasons.push("Thiếu công dụng chính");
          } else if (err.includes("usage_instructions")) {
            blockingReasons.push("Thiếu hướng dẫn sử dụng");
          } else if (err.includes("nhạy cảm")) {
            blockingReasons.push("Có claim nhạy cảm cần kiểm tra");
          } else {
            blockingReasons.push(err);
          }
        }
      }
    }

    for (const warn of validation.warnings) {
      if (!warnings.includes(warn)) {
        warnings.push(warn);
      }
    }
  }

  return {
    ok: blockingReasons.length === 0,
    blockingReasons,
    warnings,
  };
}
