/**
 * Type definitions for the Public / Partner Product Catalog feature.
 */

export type { CatalogVatMode } from "@/lib/pricing";

export interface PublicProductVariant {
  size: string;
  price?: number;
  type: "retail" | "salon";
}

/**
 * A single size+price row for the catalog.
 * price stores the BASE price (pre-VAT) — never mutated.
 * VAT is applied at render time via formatCatalogPrice().
 */
export interface PublicPriceItem {
  sizeLabel: string;
  channel: "retail" | "salon";
  /** Base price (pre-VAT). Undefined when hidden or contact required. */
  price?: number;
  /** Backwards compatibility alias for retailPrice */
  retailPrice?: number;
  requiresContact: boolean;
}

export interface PublicProduct {
  id: string | number;
  dbId?: string;
  product_code?: string;
  sort_order?: number | null;
  name: string;
  brandName: string;
  brandCode?: string;
  brandId?: string;
  categoryName: string;
  categoryId?: string;
  description?: string;
  imageUrl?: string;
  /** Optional fallback image URL (e.g. image_data_url) if primary imageUrl fails (403/404) */
  fallbackImageUrl?: string;
  imageAlt?: string;
  /** Base retail price for single-size products. Use publicPriceItems for multi-size display. */
  retailPrice?: number;
  retailSize?: string;
  /** All public size labels (retail + salon). */
  publicSizes: string[];
  /**
   * Per-size price rows for display.
   * Each item has a sizeLabel, channel ("retail" | "salon"), and price (or requiresContact = true).
   */
  publicPriceItems: PublicPriceItem[];
  variants?: PublicProductVariant[];
  usageInstructions?: string;
  benefits?: string;
  skinConcerns?: string[];
  warnings?: string;
  ingredientHighlights?: string[];
  skinTypes?: string[];
}

export interface CatalogBrand {
  id: string;
  name: string;
  code?: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  brandId?: string;
}

export type CatalogViewMode = "grid" | "table";
