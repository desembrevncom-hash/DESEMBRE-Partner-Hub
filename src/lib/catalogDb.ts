import { supabase } from "@/integrations/supabase/client";
import type { Product, Category, ProductVariant } from "@/types/product";
import { CATEGORIES as INITIAL_CATEGORIES, PRODUCTS as INITIAL_PRODUCTS } from "@/data/products";
import { stableProductSort } from "./catalogSort";

// ==========================================
// NEW CATALOG DB STRUCTURE AND HELPERS (Phase v1.4.1C.1)
// ==========================================

export interface DbProductVariant {
  variant_id: string; // The variant UUID in the DB
  sku: string;
  channel: "retail" | "salon";
  size_label: string | null;
  price: number;
  currency: string;
  inventory_tracking_enabled: boolean;
  stock_policy: string;
}

export interface DbCatalogProduct {
  id: string; // UUID in DB
  catalog_product_id: string; // UUID in DB
  product_code: string | null; // e.g. "1", "2"...
  brand_id: string;
  brand_name: string;
  brand_code: string;
  category_name: string | null;
  category_slug: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  catalog_url: string | null;
  variants: DbProductVariant[];
  retail?: DbProductVariant;
  salon?: DbProductVariant;
  sort_order?: number | null;
}

export interface RawProduct {
  id: string;
  brand_id: string;
  category_id?: string | null;
  product_code?: string | null;
  name: string;
  description?: string | null;
  image_url?: string | null;
  catalog_url?: string | null;
  status?: string;
  sort_order?: number;
}

export interface RawVariant {
  id: string;
  product_id: string;
  sku: string;
  channel: string;
  size_label?: string | null;
  price: string | number;
  currency?: string | null;
  inventory_tracking_enabled?: boolean | null;
  stock_policy?: string | null;
  is_active?: boolean | null;
}

/**
 * Pure function to transform raw DB query results into the unified DbCatalogProduct shape.
 * This function does not touch the database, making it 100% unit-testable with mock data.
 */
export function transformDbProduct(
  rawProduct: RawProduct,
  rawVariants: RawVariant[],
  brandMap: Map<string, { name: string; code: string }>,
  categoryMap: Map<string, { name: string; slug: string }>,
): DbCatalogProduct {
  const brand = brandMap.get(rawProduct.brand_id) || { name: "Unknown Brand", code: "UNKNOWN" };
  const cat = rawProduct.category_id ? categoryMap.get(rawProduct.category_id) : null;

  const dbVariants: DbProductVariant[] = rawVariants
    .filter((v) => v.product_id === rawProduct.id && v.is_active !== false)
    .map((v) => ({
      variant_id: v.id,
      sku: v.sku,
      channel: v.channel as "retail" | "salon",
      size_label: v.size_label || null,
      price: Number(v.price),
      currency: v.currency || "VND",
      inventory_tracking_enabled: !!v.inventory_tracking_enabled,
      stock_policy: v.stock_policy || "untracked",
    }));

  const retail = dbVariants.find((v) => v.channel === "retail");
  const salon = dbVariants.find((v) => v.channel === "salon");

  return {
    id: rawProduct.id,
    catalog_product_id: rawProduct.id,
    product_code: rawProduct.product_code || null,
    brand_id: rawProduct.brand_id,
    brand_name: brand.name,
    brand_code: brand.code,
    category_name: cat ? cat.name : null,
    category_slug: cat ? cat.slug : null,
    name: rawProduct.name,
    description: rawProduct.description || null,
    image_url: rawProduct.image_url || null,
    catalog_url: rawProduct.catalog_url || null,
    variants: dbVariants,
    retail,
    salon,
    sort_order: rawProduct.sort_order || 0,
  };
}

/**
 * RLS-safe read-only function to fetch all active brands, categories, products, and variants,
 * then transform them into the unified DbCatalogProduct output shape.
 * Intended for client-side use without service role keys.
 */
export async function fetchActiveDBCatalog(): Promise<DbCatalogProduct[]> {
  // 1. Fetch active brands
  const { data: brands, error: brandsError } = await supabase
    .from("product_brands")
    .select("id, name, code, slug")
    .eq("is_active", true);

  if (brandsError || !brands) {
    console.error("[CatalogDB] Error fetching active brands:", brandsError);
    return [];
  }
  const activeBrandIds = brands.map((b) => b.id);
  const brandMap = new Map(brands.map((b) => [b.id, { name: b.name, code: b.code }]));

  // 2. Fetch active categories
  const { data: categories, error: categoriesError } = await supabase
    .from("product_categories")
    .select("id, name, slug, brand_id")
    .eq("is_active", true)
    .in("brand_id", activeBrandIds);

  if (categoriesError || !categories) {
    console.error("[CatalogDB] Error fetching active categories:", categoriesError);
    return [];
  }
  const categoryMap = new Map(categories.map((c) => [c.id, { name: c.name, slug: c.slug }]));

  // 3. Fetch active products
  const { data: products, error: productsError } = await supabase
    .from("catalog_products")
    .select(
      "id, brand_id, category_id, product_code, name, description, image_url, catalog_url, status, sort_order",
    )
    .eq("status", "active")
    .in("brand_id", activeBrandIds)
    .order("sort_order", { ascending: true })
    .order("product_code", { ascending: true });

  if (productsError || !products) {
    console.error("[CatalogDB] Error fetching active products:", productsError);
    return [];
  }

  // 4. Fetch active variants
  const activeProductIds = products.map((p) => p.id);
  if (activeProductIds.length === 0) {
    return [];
  }

  const { data: variants, error: variantsError } = await supabase
    .from("catalog_product_variants")
    .select(
      "id, product_id, sku, channel, size_label, price, currency, inventory_tracking_enabled, stock_policy, is_active",
    )
    .eq("is_active", true)
    .in("product_id", activeProductIds);

  if (variantsError || !variants) {
    console.error("[CatalogDB] Error fetching active variants:", variantsError);
    return [];
  }

  // 5. Transform and return
  const transformed = products.map((p) => transformDbProduct(p, variants, brandMap, categoryMap));
  return stableProductSort(transformed);
}

// ==========================================
// LEGACY CATALOG DB HELPERS (Retained for backwards compatibility)
// ==========================================

export async function getDbCatalog(): Promise<{ categories: Category[]; products: Product[] }> {
  // Query DB categories
  const { data: catData, error: catErr } = await supabase
    .from("categories")
    .select("*")
    .order("created_at", { ascending: true });

  // Query DB products with variants
  const { data: prodData, error: prodErr } = await supabase
    .from("products")
    .select(
      `
      *,
      variants:product_variants(*)
    `,
    )
    .order("id", { ascending: true });

  // If DB query fails or returns empty (not seeded yet), fallback to initial seed catalog seamlessly
  const isDevMock = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_AUTH === "true";
  const useMock = isDevMock && localStorage.getItem("mock_session");

  if (useMock || !prodData || prodData.length === 0) {
    return {
      categories: INITIAL_CATEGORIES,
      products: INITIAL_PRODUCTS,
    };
  }

  // Map DB categories
  const categories: Category[] = (catData || []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description || undefined,
    nameVi: c.name_vi || undefined,
  }));

  // Map DB products
  const products: Product[] = prodData.map((p) => {
    const variants: ProductVariant[] = (p.variants || []).map(
      (v: { id: string; type: string; size: string; price: string | number }) => ({
        id: v.id,
        type: v.type as "retail" | "salon",
        size: v.size,
        price: Number(v.price),
      }),
    );

    return {
      id: p.id,
      name: p.name,
      description: p.description || "",
      categoryId: p.category_id,
      imageUrl: p.image_url || undefined,
      linkUrl: p.link_url || undefined,
      isCustom: p.is_custom,
      isDeleted: p.is_deleted,
      variants,
    };
  });

  return { categories, products };
}

export async function saveDbProduct(
  p: Partial<Product> & { id: number; variants?: ProductVariant[] },
) {
  const isDevMock = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_AUTH === "true";
  if (isDevMock && localStorage.getItem("mock_session")) {
    return { ok: true };
  }

  // Ensure category exists if customizing
  if (p.categoryId) {
    await supabase
      .from("categories")
      .upsert({
        id: p.categoryId,
        name: p.categoryId,
      })
      .select()
      .maybeSingle();
  }

  // 1. Upsert product record
  const { error: pErr } = await supabase.from("products").upsert({
    id: p.id,
    name: p.name || "",
    description: p.description || "",
    category_id: p.categoryId,
    image_url: p.imageUrl || null,
    link_url: p.linkUrl || null,
    is_custom: p.isCustom || false,
    is_deleted: p.isDeleted || false,
    updated_at: new Date().toISOString(),
  });

  if (pErr) return { ok: false, error: pErr.message };

  // 2. Upsert variants
  if (p.variants) {
    for (const v of p.variants) {
      await supabase.from("product_variants").upsert({
        id: v.id,
        product_id: p.id,
        type: v.type,
        size: v.size,
        price: v.price,
      });
    }
  }

  return { ok: true };
}

export async function deleteDbProduct(id: number) {
  const { error } = await supabase.from("products").update({ is_deleted: true }).eq("id", id);
  return { ok: !error, error: error?.message };
}

/**
 * Adapter to map DbCatalogProduct to the legacy Product shape used by the UI.
 */
export function mapDbCatalogToProduct(dbProd: DbCatalogProduct): Product {
  const retailVar = dbProd.variants.find((v) => v.channel === "retail");
  const salonVar = dbProd.variants.find((v) => v.channel === "salon");

  const legacyVariants: ProductVariant[] = [];
  if (retailVar) {
    legacyVariants.push({
      id: retailVar.variant_id,
      type: "retail",
      size: retailVar.size_label || "",
      price: retailVar.price,
      inventory_tracking_enabled: retailVar.inventory_tracking_enabled,
      stock_policy: retailVar.stock_policy,
      sku: retailVar.sku,
    });
  }
  if (salonVar) {
    legacyVariants.push({
      id: salonVar.variant_id,
      type: "salon",
      size: salonVar.size_label || "",
      price: salonVar.price,
      inventory_tracking_enabled: salonVar.inventory_tracking_enabled,
      stock_policy: salonVar.stock_policy,
      sku: salonVar.sku,
    });
  }

  let numericId = 999999;
  if (dbProd.product_code) {
    const parsed = parseInt(dbProd.product_code, 10);
    if (!isNaN(parsed)) {
      numericId = parsed;
    }
  }

  return {
    id: numericId,
    dbId: dbProd.id,
    product_code: dbProd.product_code,
    brand_name: dbProd.brand_name,
    brand_code: dbProd.brand_code,
    brand_id: dbProd.brand_id,
    name: dbProd.name,
    description: dbProd.description || "",
    categoryId: dbProd.category_slug || "OTHER",
    categoryName: dbProd.category_name,
    imageUrl: dbProd.image_url || undefined,
    pdfUrl: dbProd.catalog_url || undefined,
    variants: legacyVariants,
    isCustom: false,
    isDbProduct: true,
    sort_order: dbProd.sort_order || 0,
  };
}

export interface OrderabilityResult {
  retailOrderable: boolean;
  salonOrderable: boolean;
  retailMismatchReason?: string;
  salonMismatchReason?: string;
}

/**
 * Legacy Order Guard to check if a DB product variant matches the static configuration.
 */
export function checkLegacyOrderability(dbProd: Product): OrderabilityResult {
  // 1. Check if it's a DB product and has product_code
  if (!dbProd.isDbProduct || !dbProd.product_code) {
    return {
      retailOrderable: false,
      salonOrderable: false,
      retailMismatchReason: "Chưa hỗ trợ lên đơn",
      salonMismatchReason: "Chưa hỗ trợ lên đơn",
    };
  }

  // 2. Strict match product_code with staticProduct.id
  const codeTrimmed = dbProd.product_code.trim();
  const staticProduct = INITIAL_PRODUCTS.find((sp) => String(sp.id) === codeTrimmed);

  if (!staticProduct) {
    return {
      retailOrderable: false,
      salonOrderable: false,
      retailMismatchReason: "Chưa hỗ trợ lên đơn",
      salonMismatchReason: "Chưa hỗ trợ lên đơn",
    };
  }

  const retailVar = dbProd.variants.find((v) => v.type === "retail");
  const salonVar = dbProd.variants.find((v) => v.type === "salon");

  const staticRetail = staticProduct.variants.find((v) => v.type === "retail");
  const staticSalon = staticProduct.variants.find((v) => v.type === "salon");

  let retailOrderable = false;
  let retailMismatchReason: string | undefined;

  let salonOrderable = false;
  let salonMismatchReason: string | undefined;

  // Check Retail
  if (retailVar) {
    if (!staticRetail) {
      retailMismatchReason = "Chưa hỗ trợ lên đơn";
    } else {
      const priceMatch = Number(retailVar.price) === Number(staticRetail.price);
      const sizeMatch =
        (retailVar.size || "").trim().toLowerCase() ===
        (staticRetail.size || "").trim().toLowerCase();

      if (priceMatch && sizeMatch) {
        retailOrderable = true;
      } else {
        retailMismatchReason = "Giá/size DB khác catalog legacy — chưa hỗ trợ lên đơn";
      }
    }
  }

  // Check Salon
  if (salonVar) {
    if (!staticSalon) {
      salonMismatchReason = "Chưa hỗ trợ lên đơn";
    } else {
      const priceMatch = Number(salonVar.price) === Number(staticSalon.price);
      const sizeMatch =
        (salonVar.size || "").trim().toLowerCase() ===
        (staticSalon.size || "").trim().toLowerCase();

      if (priceMatch && sizeMatch) {
        salonOrderable = true;
      } else {
        salonMismatchReason = "Giá/size DB khác catalog legacy — chưa hỗ trợ lên đơn";
      }
    }
  }

  return {
    retailOrderable,
    salonOrderable,
    retailMismatchReason,
    salonMismatchReason,
  };
}
