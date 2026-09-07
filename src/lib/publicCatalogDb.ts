import { supabase } from "@/integrations/supabase/client";

export interface PublicCatalogVariant {
  id: string;
  product_id: string;
  sku?: string | null;
  channel: "retail" | "salon";
  size_label?: string | null;
  /** Variant price (retail or salon). Publicly accessible. */
  price?: number;
  is_active: boolean;
}

export interface PublicCatalogProductDb {
  id: string;
  brand_id: string;
  brand_name?: string;
  brand_code?: string;
  category_id?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  product_code?: string | null;
  name: string;
  description?: string | null;
  image_url?: string | null;
  status: string;
  sort_order?: number | null;
  retailVariants: PublicCatalogVariant[];
  salonVariants: PublicCatalogVariant[];
}

export interface PublicCatalogDbResult {
  products: PublicCatalogProductDb[];
  brands: Array<{ id: string; name: string; code: string; slug: string }>;
  categories: Array<{ id: string; name: string; slug: string; brand_id: string }>;
}

export interface FetchPublicCatalogOptions {
  canViewPartnerPrices?: boolean;
}

/**
 * Dedicated catalog data fetcher.
 * Explicitly queries only public-safe fields:
 * - catalog_products: id, brand_id, category_id, product_code, name, description, image_url, status, sort_order
 * - product_brands: id, name, code, slug
 * - product_categories: id, name, slug, brand_id
 * - retail variants: id, product_id, sku, channel, size_label, price, is_active (channel = retail)
 * - salon variants: id, product_id, sku, channel, size_label, price, is_active (channel = salon)
 */
export async function fetchPublicCatalogSafe(
  options?: FetchPublicCatalogOptions,
): Promise<PublicCatalogDbResult> {
  const canViewPartnerPrices = Boolean(options?.canViewPartnerPrices);

  // A. Fetch brands
  const { data: brands, error: brandsError } = await supabase
    .from("product_brands")
    .select("id, name, code, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (brandsError) {
    console.warn("[publicCatalogDb] Error fetching brands:", brandsError);
  }

  const activeBrandIds = (brands || []).map((b) => b.id);
  const brandMap = new Map((brands || []).map((b) => [b.id, b]));

  // B. Fetch categories
  let categoriesQuery = supabase
    .from("product_categories")
    .select("id, name, slug, brand_id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (activeBrandIds.length > 0) {
    categoriesQuery = categoriesQuery.in("brand_id", activeBrandIds);
  }

  const { data: categories, error: catError } = await categoriesQuery;
  if (catError) {
    console.warn("[publicCatalogDb] Error fetching categories:", catError);
  }

  const categoryMap = new Map((categories || []).map((c) => [c.id, c]));

  // C. Fetch catalog_products
  let productsQuery = supabase
    .from("catalog_products")
    .select(
      "id, brand_id, category_id, product_code, name, description, image_url, status, sort_order",
    )
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("product_code", { ascending: true });

  if (activeBrandIds.length > 0) {
    productsQuery = productsQuery.in("brand_id", activeBrandIds);
  }

  const { data: products, error: prodError } = await productsQuery;
  if (prodError || !products || products.length === 0) {
    if (prodError) {
      console.warn("[publicCatalogDb] Error fetching products:", prodError);
    }
    return {
      products: [],
      brands: brands || [],
      categories: categories || [],
    };
  }

  const activeProductIds = products.map((p) => p.id);

  // D. Fetch retail variants — price included for retail
  const { data: retailVariants, error: retailError } = await supabase
    .from("catalog_product_variants")
    .select("id, product_id, sku, channel, size_label, price, is_active")
    .eq("channel", "retail")
    .eq("is_active", true)
    .in("product_id", activeProductIds);

  if (retailError) {
    console.warn("[publicCatalogDb] Error fetching retail variants:", retailError);
  }

  // E. Fetch salon/professional variants — price is now public for salon channel as well
  const { data: salonVariants, error: salonError } = await supabase
    .from("catalog_product_variants")
    .select("id, product_id, sku, channel, size_label, price, is_active")
    .eq("channel", "salon")
    .eq("is_active", true)
    .in("product_id", activeProductIds);

  if (salonError) {
    console.warn("[publicCatalogDb] Error fetching salon variants:", salonError);
  }

  // Group variants by product_id
  const retailByProduct = new Map<string, PublicCatalogVariant[]>();
  (retailVariants || []).forEach((v) => {
    const list = retailByProduct.get(v.product_id) || [];
    list.push({
      id: v.id,
      product_id: v.product_id,
      sku: v.sku,
      channel: "retail",
      size_label: v.size_label,
      price: v.price != null ? Number(v.price) : undefined,
      is_active: v.is_active,
    });
    retailByProduct.set(v.product_id, list);
  });

  const salonByProduct = new Map<string, PublicCatalogVariant[]>();
  (salonVariants || []).forEach((v) => {
    const list = salonByProduct.get(v.product_id) || [];
    list.push({
      id: v.id,
      product_id: v.product_id,
      sku: v.sku,
      channel: "salon",
      size_label: v.size_label,
      price: v.price != null ? Number(v.price) : undefined,
      is_active: v.is_active,
    });
    salonByProduct.set(v.product_id, list);
  });

  const combinedProducts: PublicCatalogProductDb[] = products.map((p) => {
    const brand = brandMap.get(p.brand_id);
    const cat = p.category_id ? categoryMap.get(p.category_id) : undefined;

    return {
      id: p.id,
      brand_id: p.brand_id,
      brand_name: brand?.name,
      brand_code: brand?.code,
      category_id: p.category_id,
      category_name: cat?.name,
      category_slug: cat?.slug,
      product_code: p.product_code,
      name: p.name,
      description: p.description,
      image_url: p.image_url,
      status: p.status,
      sort_order: p.sort_order,
      retailVariants: retailByProduct.get(p.id) || [],
      salonVariants: salonByProduct.get(p.id) || [],
    };
  });

  return {
    products: combinedProducts,
    brands: brands || [],
    categories: categories || [],
  };
}
