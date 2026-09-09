export const SENSITIVE_CLAIM_KEYWORDS = [
  "điều trị",
  "chữa khỏi",
  "trị tận gốc",
  "hết mụn 100%",
  "cam kết khỏi",
  "an toàn tuyệt đối",
  "không kích ứng 100%",
  "phục hồi hoàn toàn",
] as const;

export const REQUIRED_PUBLIC_FIELDS = [
  "product_characteristics",
  "benefits",
  "usage_instructions",
] as const;

export const RECOMMENDED_PUBLIC_FIELDS = [
  "ingredient_highlights",
  "skin_types",
  "warnings",
] as const;

export const INTERNAL_SENSITIVE_FIELDS = [
  "full_ingredients",
  "sales_pitch",
  "consultation_notes",
  "objections",
  "raw_text",
  "extracted_text",
  "file_url",
] as const;

export interface ProductLaunchValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sensitiveClaims: string[];
}

/**
 * Detects sensitive marketing or medical claim keywords in text or structured data.
 */
export function detectSensitiveClaims(text: unknown): string[] {
  if (text === null || text === undefined) {
    return [];
  }

  let strToSearch = "";
  if (typeof text === "string") {
    strToSearch = text;
  } else if (Array.isArray(text)) {
    strToSearch = text.filter((item) => typeof item === "string").join(" ");
  } else if (typeof text === "object") {
    try {
      strToSearch = JSON.stringify(text);
    } catch {
      strToSearch = String(text);
    }
  } else {
    strToSearch = String(text);
  }

  const normalizedText = strToSearch.toLowerCase();
  const detected: string[] = [];

  for (const keyword of SENSITIVE_CLAIM_KEYWORDS) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      detected.push(keyword);
    }
  }

  return Array.from(new Set(detected));
}

function getFieldVal(input: Record<string, unknown>, field: string): unknown {
  if (input[field] !== undefined) return input[field];
  const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  return input[camelField];
}

/**
 * Validates if a product knowledge record is ready for public launch or sales sheet generation.
 */
export function validateProductLaunchReady(
  input: Record<string, unknown> | null | undefined,
): ProductLaunchValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      errors: ["Dữ liệu tri thức sản phẩm là bắt buộc"],
      warnings: [],
      sensitiveClaims: [],
    };
  }

  // 1. Check QA status and active state if provided
  const qaStatus = getFieldVal(input, "qa_status");
  if (qaStatus !== undefined && qaStatus !== null && qaStatus !== "approved") {
    errors.push("Trạng thái QA chưa được duyệt (qa_status phải là 'approved')");
  }

  const isActive = getFieldVal(input, "is_active");
  if (isActive !== undefined && isActive !== null && isActive === false) {
    errors.push("Sản phẩm chưa ở trạng thái hoạt động (is_active phải là true)");
  }

  // 2. Check required public fields
  for (const field of REQUIRED_PUBLIC_FIELDS) {
    const val = getFieldVal(input, field);
    let isMissing = false;

    if (val === null || val === undefined) {
      isMissing = true;
    } else if (typeof val === "string" && val.trim().length === 0) {
      isMissing = true;
    } else if (Array.isArray(val) && val.length === 0) {
      isMissing = true;
    }

    if (isMissing) {
      errors.push(`Trường bắt buộc còn thiếu: ${field}`);
    }
  }

  // 3. Check recommended fields (warnings only)
  for (const field of RECOMMENDED_PUBLIC_FIELDS) {
    const val = getFieldVal(input, field);
    let isMissing = false;

    if (val === null || val === undefined) {
      isMissing = true;
    } else if (typeof val === "string" && val.trim().length === 0) {
      isMissing = true;
    } else if (Array.isArray(val) && val.length === 0) {
      isMissing = true;
    }

    if (isMissing) {
      warnings.push(`Trường khuyến nghị còn thiếu: ${field}`);
    }
  }

  // 4. Detect sensitive claims across the entire record
  const sensitiveClaims = detectSensitiveClaims(input);
  for (const claim of sensitiveClaims) {
    errors.push(`Phát hiện tuyên bố y khoa/nhạy cảm không hợp lệ: "${claim}"`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sensitiveClaims,
  };
}

/**
 * Sanitizes product knowledge for public display by removing internal/unverified fields.
 */
export function sanitizePublicProductKnowledge<T extends Record<string, unknown>>(
  knowledge: T,
): Omit<T, (typeof INTERNAL_SENSITIVE_FIELDS)[number]> {
  if (!knowledge || typeof knowledge !== "object") {
    return {} as Omit<T, (typeof INTERNAL_SENSITIVE_FIELDS)[number]>;
  }

  const sanitized = { ...knowledge };
  for (const field of INTERNAL_SENSITIVE_FIELDS) {
    delete (sanitized as Record<string, unknown>)[field];
  }

  return sanitized;
}
