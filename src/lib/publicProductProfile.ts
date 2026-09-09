import {
  sanitizePublicProductKnowledge,
  validateProductLaunchReady,
  INTERNAL_SENSITIVE_FIELDS,
} from "./productLaunchValidation";
import { selectSingleIngredientSource } from "./salesSheetVersionUtils";
import {
  extractPreviewBullets,
  extractIngredientNames,
} from "./productPreviewExtractors";

export interface PublicProductProfile {
  id?: string | number;
  catalog_product_id?: string | null;
  product_id?: number | null;
  name: string;
  brand_name: string;
  category_name: string;
  short_description?: string;
  description?: string;
  image_url?: string;
  fallback_image_url?: string;
  product_characteristics?: string;
  benefits?: string;
  usage_instructions?: string;
  ingredient_highlights?: string[];
  skin_types?: string[];
  skin_concerns?: string[];
  warnings?: string;
  qa_status?: string;
  is_active?: boolean;
  is_public?: boolean;
  highlightPreview: string[];
  characteristicsPreview: string[];
  activeIngredientPreview: string[];
}

export interface ProductLaunchStatus {
  guidebookStatus: "none" | "saved" | "extracted";
  knowledgeStatus: "none" | "draft" | "review" | "approved" | "archived";
  publicStatus: "draft" | "public_ready";
  salesSheetStatus: "none" | "draft" | "approved";
  isLaunchReady: boolean;
  blockingReasons: string[];
  warnings: string[];
}

/**
 * Normalizes a string input: trims whitespace and returns undefined if empty.
 */
function normalizeString(val: unknown): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalizes a string array: filters out empty items and returns undefined if array is empty.
 */
function normalizeArray(val: unknown): string[] | undefined {
  if (!Array.isArray(val)) return undefined;
  const filtered = val
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return filtered.length > 0 ? filtered : undefined;
}


/**
 * Normalizes all possible ingredient field aliases from raw/sanitized input into a single-source string array.
 */
function normalizeIngredientList(
  input: Record<string, unknown>,
  sanitized: Record<string, unknown>,
): string[] | undefined {
  const merged = { ...input, ...sanitized };
  const items = selectSingleIngredientSource(merged);
  return items.length > 0 ? items : undefined;
}

/**
 * Builds a unified, customer-safe PublicProductProfile from raw input data.
 * Internally strips forbidden internal fields using sanitizePublicProductKnowledge
 * and normalizes empty values without adding dummy placeholders.
 */
export function buildPublicProductProfile(
  input: Record<string, unknown> | null | undefined,
): PublicProductProfile {
  if (!input || typeof input !== "object") {
    return {
      name: "",
      brand_name: "Desembre",
      category_name: "Mỹ phẩm",
      highlightPreview: [],
      characteristicsPreview: [],
      activeIngredientPreview: [],
    };
  }

  // 1. Sanitize raw input to strip forbidden internal fields
  const sanitized = sanitizePublicProductKnowledge(input) as Record<string, unknown>;

  const productCharacteristics = normalizeString(
    sanitized.product_characteristics ?? input.product_characteristics ?? sanitized.productCharacteristics ?? input.productCharacteristics,
  );
  const benefitsVal = normalizeString(sanitized.benefits ?? input.benefits);
  const ingredientHighlights = normalizeIngredientList(input, sanitized);

  const benefitsBullets = extractPreviewBullets(benefitsVal, 2);
  const characteristicsBullets = extractPreviewBullets(productCharacteristics, 2);
  const highlightPreview = benefitsBullets.length > 0 ? benefitsBullets : characteristicsBullets;

  // 2. Extract and normalize public fields
  const profile: PublicProductProfile = {
    id: (sanitized.id as string | number) ?? (input.id as string | number),
    catalog_product_id: (sanitized.catalog_product_id as string) ?? null,
    product_id: (sanitized.product_id as number) ?? null,
    name: normalizeString(sanitized.name ?? input.name) ?? "",
    brand_name:
      normalizeString(sanitized.brand_name ?? input.brand_name ?? input.brandName) ?? "Desembre",
    category_name:
      normalizeString(sanitized.category_name ?? input.category_name ?? input.categoryName) ??
      "Mỹ phẩm",
    short_description: normalizeString(sanitized.short_description ?? input.short_description),
    description: normalizeString(sanitized.description ?? input.description),
    image_url: normalizeString(sanitized.image_url ?? input.image_url ?? input.imageUrl),
    fallback_image_url: normalizeString(
      sanitized.fallback_image_url ?? input.fallback_image_url ?? input.fallbackImageUrl,
    ),
    product_characteristics: productCharacteristics,
    benefits: benefitsVal,
    usage_instructions: normalizeString(
      sanitized.usage_instructions ?? input.usage_instructions ?? input.usageInstructions,
    ),
    ingredient_highlights: ingredientHighlights,
    skin_types: normalizeArray(sanitized.skin_types ?? input.skin_types ?? input.skinTypes),
    skin_concerns: normalizeArray(
      sanitized.skin_concerns ?? input.skin_concerns ?? input.skinConcerns,
    ),
    warnings: normalizeString(sanitized.warnings ?? input.warnings),
    qa_status: normalizeString(sanitized.qa_status ?? input.qa_status),
    is_active:
      typeof sanitized.is_active === "boolean"
        ? sanitized.is_active
        : typeof input.is_active === "boolean"
          ? input.is_active
          : undefined,
    is_public:
      typeof sanitized.is_public === "boolean"
        ? sanitized.is_public
        : typeof input.is_public === "boolean"
          ? input.is_public
          : undefined,
    highlightPreview,
    characteristicsPreview: highlightPreview,
    activeIngredientPreview: extractIngredientNames(ingredientHighlights, 3),
  };

  // Ensure forbidden fields are strictly deleted if present
  for (const forbiddenField of INTERNAL_SENSITIVE_FIELDS) {
    delete (profile as Record<string, unknown>)[forbiddenField];
  }

  return profile;
}

/**
 * Computes launch status and launch readiness for a product based on its knowledge and source documents.
 */
export function getProductLaunchStatus(
  input: Record<string, unknown> | null | undefined,
  options?: {
    hasSourceDocs?: boolean;
    hasCompletedGuidebook?: boolean;
    salesSheetStatus?: "none" | "draft" | "approved";
  },
): ProductLaunchStatus {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  const guidebookStatus: "none" | "saved" | "extracted" = options?.hasCompletedGuidebook
    ? "extracted"
    : options?.hasSourceDocs
      ? "saved"
      : "none";

  const rawQaStatus = normalizeString(input?.qa_status ?? input?.qaStatus);
  const knowledgeStatus: "none" | "draft" | "review" | "approved" | "archived" =
    rawQaStatus === "approved"
      ? "approved"
      : rawQaStatus === "review"
        ? "review"
        : rawQaStatus === "archived"
          ? "archived"
          : input
            ? "draft"
            : "none";

  const salesSheetStatus = options?.salesSheetStatus ?? "none";

  if (!input || typeof input !== "object") {
    blockingReasons.push("Chưa có dữ liệu tri thức sản phẩm");
    return {
      guidebookStatus,
      knowledgeStatus: "none",
      publicStatus: "draft",
      salesSheetStatus,
      isLaunchReady: false,
      blockingReasons,
      warnings,
    };
  }

  // Check QA approval
  if (knowledgeStatus !== "approved") {
    blockingReasons.push("Tri thức chưa được duyệt QA (qa_status phải là 'approved')");
  }

  // Check active state
  const isActive = input.is_active ?? input.isActive;
  if (isActive === false) {
    blockingReasons.push("Sản phẩm chưa ở trạng thái hoạt động (is_active phải là true)");
  }

  // Check public flag
  const isPublic = input.is_public ?? input.isPublic;
  if (isPublic === false || isPublic === undefined || isPublic === null) {
    blockingReasons.push("Sản phẩm chưa bật chế độ công khai (is_public phải là true)");
  }

  // Check anti-hallucination validation layer
  const validation = validateProductLaunchReady(input);
  if (!validation.isValid) {
    for (const err of validation.errors) {
      if (!blockingReasons.includes(err)) {
        blockingReasons.push(err);
      }
    }
  }
  for (const warn of validation.warnings) {
    if (!warnings.includes(warn)) {
      warnings.push(warn);
    }
  }

  const isLaunchReady = blockingReasons.length === 0;

  return {
    guidebookStatus,
    knowledgeStatus,
    publicStatus: isLaunchReady ? "public_ready" : "draft",
    salesSheetStatus,
    isLaunchReady,
    blockingReasons,
    warnings,
  };
}
