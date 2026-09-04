/**
 * Local types for the Product Catalog feature.
 * Complements the global types in @/types/product.
 */

export interface ProductGuard {
  retailOrderable: boolean;
  salonOrderable: boolean;
  retailMismatchReason?: string;
  salonMismatchReason?: string;
}

export interface SalesSheetInfo {
  id: string;
  status: "draft" | "approved" | "archived";
}

/** A cart item produced from a DB-catalog product. */
export interface DbCartEntry {
  source: "db_catalog";
  catalog_product_id: string;
  variant_id: string;
  brand_id: string;
  brand_name: string;
  brand_code: string;
  product_code: string | null;
  sku: string;
  product_name: string;
  category_name: string | null;
  channel: "retail" | "salon";
  size_label: string | null;
  unit_price: number;
  currency: "VND";
  image_url: string | null;
  catalog_url: string | null;
  inventory_tracking_enabled: false;
  stock_policy: "untracked";
  added_at: string;
}

/** A cart item produced from a legacy static product. */
export interface LegacyCartEntry {
  source?: undefined;
  no: number;
  sizeType: "retail" | "salon";
}

/** Union of all possible cart item shapes. */
export type CartItemAny = DbCartEntry | LegacyCartEntry;

/**
 * Returns a human-readable display label for a cart entry.
 */
export function getCartEntryLabel(item: CartItemAny): string {
  if (item.source === "db_catalog") {
    return `${item.product_name} (${item.channel === "retail" ? "Retail" : "Salon"}${item.size_label ? ` – ${item.size_label}` : ""})`;
  }
  return `SP #${item.no} (${item.sizeType === "retail" ? "Retail" : "Salon"})`;
}

/**
 * Returns the unit price of a cart entry (DB items only; legacy price is unknown here).
 */
export function getCartEntryPrice(item: CartItemAny): number | null {
  if (item.source === "db_catalog") {
    return item.unit_price;
  }
  return null;
}
