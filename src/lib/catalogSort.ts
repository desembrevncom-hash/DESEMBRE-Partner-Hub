import {
  sortCatalogProducts,
  compareCatalogProducts,
  extractNumericCode,
  type SortableCatalogProduct,
} from "@/features/catalog/catalogSortUtils";

export {
  sortCatalogProducts,
  compareCatalogProducts,
  extractNumericCode,
  type SortableCatalogProduct,
};

/**
 * Stably sorts a list of products by numeric product_code (ASC), sort_order (ASC), and name (ASC).
 */
export function stableProductSort<
  T extends { sort_order?: number | null; product_code?: string | number | null; name: string },
>(list: T[]): T[] {
  return sortCatalogProducts(list as SortableCatalogProduct[]) as T[];
}

/**
 * Computes the sort order for a new product: max(sort_order) + 10, fallback to 10.
 */
export function computeNextProductSortOrder(products: { sort_order?: number | null }[]): number {
  if (!products || products.length === 0) return 10;
  const max = Math.max(...products.map((p) => p.sort_order || 0));
  return max + 10;
}
