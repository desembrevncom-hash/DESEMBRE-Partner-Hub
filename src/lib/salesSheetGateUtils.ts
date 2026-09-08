/**
 * salesSheetGateUtils.ts
 *
 * Rules:
 * 1. product_source_documents là nguồn gốc bắt buộc.
 * 2. Không có source document => không cho tạo, hiển thị "Chưa có Guidebook"
 * 3. extraction_status != completed => không cho tạo, hiển thị "Guidebook chưa trích xuất"
 * 4. product_knowledge chưa approved (qa_status != 'approved' || !is_active) => hiển thị "Tri thức AI chưa duyệt"
 * 5. Chỉ tạo khi thỏa mãn ĐỦ cả 4 điều kiện.
 * 6. Chống bịa đặt (No hallucination): Thiếu dữ liệu => hiển thị "Chưa có thông tin trong tài liệu nguồn.", không để ô rỗng.
 */

export interface SourceDocGateItem {
  id: string;
  extraction_status: string;
}

export interface KnowledgeGateItem {
  id?: string;
  qa_status?: string;
  is_active?: boolean;
}

export interface SalesSheetGateResult {
  canGenerate: boolean;
  blockReason: string;
  code: "OK" | "MISSING_GUIDEBOOK" | "GUIDEBOOK_NOT_EXTRACTED" | "KNOWLEDGE_NOT_APPROVED";
}

export const NO_SOURCE_INFO_TEXT = "Chưa có thông tin trong tài liệu nguồn.";

export function checkSalesSheetGenerationGate(
  sourceDocs: SourceDocGateItem[] | null | undefined,
  knowledge: KnowledgeGateItem | null | undefined,
): SalesSheetGateResult {
  if (!sourceDocs || sourceDocs.length === 0) {
    return {
      canGenerate: false,
      blockReason: "Chưa có Guidebook",
      code: "MISSING_GUIDEBOOK",
    };
  }

  const hasCompleted = sourceDocs.some((d) => d.extraction_status === "completed");
  if (!hasCompleted) {
    return {
      canGenerate: false,
      blockReason: "Guidebook chưa trích xuất",
      code: "GUIDEBOOK_NOT_EXTRACTED",
    };
  }

  if (!knowledge || knowledge.qa_status !== "approved" || !knowledge.is_active) {
    return {
      canGenerate: false,
      blockReason: "Tri thức AI chưa duyệt",
      code: "KNOWLEDGE_NOT_APPROVED",
    };
  }

  return {
    canGenerate: true,
    blockReason: "",
    code: "OK",
  };
}

export function sanitizeSalesSheetSectionList(val: unknown): string[] {
  if (!Array.isArray(val) || val.length === 0) {
    return [NO_SOURCE_INFO_TEXT];
  }
  const valid = val.filter((item) => typeof item === "string" && item.trim() !== "");
  return valid.length > 0 ? valid : [NO_SOURCE_INFO_TEXT];
}

export function sanitizeSalesSheetText(val: unknown): string {
  if (typeof val === "string" && val.trim() !== "") {
    return val.trim();
  }
  return NO_SOURCE_INFO_TEXT;
}

export function formatSalesSheetSectionDisplay(val: unknown): string {
  if (Array.isArray(val)) {
    const valid = val.filter((v) => typeof v === "string" && v.trim() !== "");
    if (valid.length === 0) return NO_SOURCE_INFO_TEXT;
    return valid.map((v) => `- ${v}`).join("\n");
  }
  if (typeof val === "string" && val.trim() !== "") {
    return val;
  }
  return NO_SOURCE_INFO_TEXT;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeSalesSheetContent(contentJson: any): any {
  if (!contentJson || typeof contentJson !== "object") return {};
  const cloned = JSON.parse(JSON.stringify(contentJson));
  if (!cloned.product) cloned.product = {};
  if (!cloned.knowledge) cloned.knowledge = {};

  cloned.product.short_description = sanitizeSalesSheetText(cloned.product.short_description);
  cloned.knowledge.benefits = sanitizeSalesSheetSectionList(cloned.knowledge.benefits);
  cloned.knowledge.skin_types = sanitizeSalesSheetSectionList(cloned.knowledge.skin_types);
  cloned.knowledge.usage = sanitizeSalesSheetSectionList(cloned.knowledge.usage);
  cloned.knowledge.sales_notes = sanitizeSalesSheetSectionList(cloned.knowledge.sales_notes);
  cloned.knowledge.warnings = sanitizeSalesSheetSectionList(cloned.knowledge.warnings);
  cloned.knowledge.ingredient_highlights = sanitizeSalesSheetSectionList(
    cloned.knowledge.ingredient_highlights,
  );
  cloned.knowledge.key_ingredients = sanitizeSalesSheetSectionList(
    cloned.knowledge.key_ingredients,
  );
  cloned.knowledge.full_ingredients = sanitizeSalesSheetText(cloned.knowledge.full_ingredients);

  return cloned;
}
