/**
 * Extractor functions for customer-facing product previews on catalog cards.
 */

/**
 * Extracts up to limit preview bullet points from string or array input.
 * Strips bullet symbols (-, *, •, 1.) and filters empty/invalid items.
 */
export function extractPreviewBullets(value: unknown, limit = 2): string[] {
  const items: string[] = [];

  if (Array.isArray(value)) {
    for (const val of value) {
      if (typeof val === "string") {
        const clean = val.replace(/^[-*•\d.]+\s*/, "").trim();
        if (clean && clean !== "Chưa có thông tin trong tài liệu nguồn.") {
          items.push(clean);
        }
      }
    }
  } else if (typeof value === "string") {
    const lines = value.split(/\r?\n/);
    for (const line of lines) {
      const clean = line.replace(/^[-*•\d.]+\s*/, "").trim();
      if (clean && clean !== "Chưa có thông tin trong tài liệu nguồn.") {
        items.push(clean);
      }
    }
  }

  return items.slice(0, limit);
}

/**
 * Cleans an ingredient item by stripping bullet symbols and extracting only
 * the ingredient name before ':' or '('.
 */
function cleanIngredientName(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let clean = raw.replace(/^[-*•\d.]+\s*/, "").trim();
  if (clean === "Chưa có thông tin trong tài liệu nguồn.") return "";

  // Cut at first occurrence of ':' or '('
  const cutIndex = clean.search(/[:(]/);
  if (cutIndex !== -1) {
    clean = clean.substring(0, cutIndex);
  }

  return clean.trim().replace(/[-–—,.;]+$/, "").trim();
}

/**
 * Extracts up to limit active ingredient names from string or array input.
 * Extracts only the ingredient name before ':' or '(' and deduplicates names.
 */
export function extractIngredientNames(value: unknown, limit = 3): string[] {
  const rawList: string[] = [];

  if (Array.isArray(value)) {
    for (const val of value) {
      if (typeof val === "string") {
        rawList.push(val);
      }
    }
  } else if (typeof value === "string") {
    const lines = value.split(/\r?\n/);
    for (const line of lines) {
      rawList.push(line);
    }
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawList) {
    const name = cleanIngredientName(raw);
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      result.push(name);
      if (result.length >= limit) break;
    }
  }

  return result;
}
