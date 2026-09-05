/**
 * Type definitions for the Public / Partner Product Catalog feature.
 */

export interface PublicProductVariant {
  size: string;
  price?: number;
  type: "retail" | "salon";
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
  retailPrice?: number;
  retailSize?: string;
  publicSizes: string[];
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
