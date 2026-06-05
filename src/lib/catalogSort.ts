/**
 * Stably sorts a list of products by sort_order (ASC), numeric product_code (ASC), and name (ASC).
 */
export function stableProductSort<
  T extends { sort_order?: number | null; product_code?: string | null; name: string },
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    // 1. Sort by sort_order ASC
    const sortA = a.sort_order ?? 0;
    const sortB = b.sort_order ?? 0;
    if (sortA !== sortB) {
      return sortA - sortB;
    }

    // 2. Sort by product_code numeric ASC if product_code is a number
    const codeA = (a.product_code || "").trim();
    const codeB = (b.product_code || "").trim();
    const isNumA = /^\d+$/.test(codeA);
    const isNumB = /^\d+$/.test(codeB);

    if (isNumA && isNumB) {
      const numA = parseInt(codeA, 10);
      const numB = parseInt(codeB, 10);
      if (numA !== numB) {
        return numA - numB;
      }
    } else if (isNumA) {
      return -1;
    } else if (isNumB) {
      return 1;
    }

    // 3. Fallback: name ASC
    return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
  });
}

/**
 * Computes the sort order for a new product: max(sort_order) + 10, fallback to 10.
 */
export function computeNextProductSortOrder(products: { sort_order?: number | null }[]): number {
  if (!products || products.length === 0) return 10;
  const max = Math.max(...products.map((p) => p.sort_order || 0));
  return max + 10;
}
