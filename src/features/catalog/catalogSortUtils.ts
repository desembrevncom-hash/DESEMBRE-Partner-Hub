/**
 * Shared sorting utility for Catalog products across Admin and /san-pham.
 *
 * Rules:
 * 1. Primary: numeric product_code / no ascending
 *    - "1" -> 1
 *    - "01" -> 1
 *    - "002" -> 2
 *    - "P-04" -> 4
 *    - Products with numeric codes come before products without numeric codes.
 * 2. Secondary: sort_order ascending (if product_code is missing, non-numeric, or identical)
 * 3. Tertiary: name ascending (Vietnamese collation, case-insensitive)
 */

export interface SortableCatalogProduct {
  product_code?: string | number | null;
  sort_order?: number | null;
  name: string;
}

/**
 * Parses numeric value from product_code/no/id.
 * Examples:
 * - 1 -> 1
 * - "1" -> 1
 * - "01" -> 1
 * - "002" -> 2
 * - "P-03" -> 3
 * - "ABC" -> null
 * - null/undefined -> null
 */
export function extractNumericCode(code: string | number | null | undefined): number | null {
  if (code == null) return null;
  if (typeof code === "number") {
    return Number.isFinite(code) && code > 0 ? Math.floor(code) : null;
  }
  const str = String(code).trim();
  if (!str) return null;

  // 1. Direct integer check (including leading zeros, e.g. "01", "002", "1")
  const direct = parseInt(str, 10);
  if (
    !Number.isNaN(direct) &&
    direct > 0 &&
    (String(direct) === str || String(direct) === str.replace(/^0+/, ""))
  ) {
    return direct;
  }

  // 2. Extract leading or contained digit group (e.g. "P-01" -> 1, "#4" -> 4)
  const match = str.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return !Number.isNaN(num) && num > 0 ? num : null;
  }

  return null;
}

/**
 * Compares two catalog products according to catalog ordering rules.
 */
export function compareCatalogProducts(
  a: SortableCatalogProduct,
  b: SortableCatalogProduct,
): number {
  const numA = extractNumericCode(a.product_code);
  const numB = extractNumericCode(b.product_code);

  // 1. Primary: numeric product_code / no ASC
  if (numA !== null && numB !== null) {
    if (numA !== numB) {
      return numA - numB;
    }
  } else if (numA !== null) {
    return -1; // numeric items come before non-numeric
  } else if (numB !== null) {
    return 1;
  }

  // 2. Secondary: sort_order ASC
  const sortA = a.sort_order ?? 0;
  const sortB = b.sort_order ?? 0;
  if (sortA !== sortB) {
    return sortA - sortB;
  }

  // 3. Tertiary: name ASC (Vietnamese locale, case-insensitive)
  return (a.name || "").localeCompare(b.name || "", "vi", { sensitivity: "base" });
}

/**
 * Stably sorts an array of catalog products.
 * Returns a new sorted array; does not mutate the input array.
 */
export function sortCatalogProducts<T extends SortableCatalogProduct>(list: T[]): T[] {
  return [...list].sort(compareCatalogProducts);
}
