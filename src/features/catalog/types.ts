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
 * A single size+price row for the public catalog.
 * retailPrice stores the BASE price (pre-VAT) — never mutated.
 * VAT is applied at render time via formatCatalogPrice().
 * Salon/professional prices are NEVER present here.
 */
export interface PublicPriceItem {
  sizeLabel: string;
  /** Base retail price (pre-VAT). Undefined when no public retail price exists. */
  retailPrice?: number;
  /** True when this size has no public retail price — display "Liên hệ báo giá" */
  requiresContact: boolean;
}

export interface PublicProduct {
  id: string | number;
  dbId?: string;
  name: string;
  brandName: string;
  brandCode?: string;
  brandId?: string;
  categoryName: string;
  categoryId?: string;
  description?: string;
  imageUrl?: string;
  /** Base retail price for single-size products. Use publicPriceItems for multi-size display. */
  retailPrice?: number;
  retailSize?: string;
  /** All public-safe size labels (retail + salon labels — but never salon prices). */
  publicSizes: string[];
  /**
   * Per-size price rows for display.
   * Each item has a sizeLabel and either a base retailPrice or requiresContact = true.
   * Salon/professional prices are NEVER included.
   */
  publicPriceItems: PublicPriceItem[];
  variants?: PublicProductVariant[];
  usageInstructions?: string;
  benefits?: string;
  skinConcerns?: string[];
  warnings?: string;
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
