export type PriceType = "retail" | "salon";

export type Category = {
  id: string;
  name: string;
  description?: string;
  nameVi?: string;
};

export interface ProductVariant {
  id: string;
  type: PriceType;
  size: string;
  price: number;
  inventory_tracking_enabled?: boolean;
  stock_policy?: string;
  sku?: string;
}

export interface Product {
  id: number; // Stable ID from current 'no'
  name: string;
  description: string;
  categoryId: string;
  imageUrl?: string;
  linkUrl?: string;
  variants: ProductVariant[];
  isCustom?: boolean;
  isDeleted?: boolean;
  // DB catalog extended properties
  dbId?: string;
  product_code?: string | null;
  brand_name?: string;
  brand_code?: string;
  brand_id?: string;
  categoryName?: string | null;
  pdfUrl?: string;
  isDbProduct?: boolean;
  sort_order?: number;
}

export interface Section {
  category: Category;
  products: Product[];
}
