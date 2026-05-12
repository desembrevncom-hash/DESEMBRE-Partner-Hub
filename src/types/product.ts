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
}

export interface Section {
  category: Category;
  products: Product[];
}
