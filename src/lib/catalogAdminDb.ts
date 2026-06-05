import { supabase } from "@/integrations/supabase/client";

export interface CatalogProductPayload {
  id?: string;
  brand_id: string;
  category_id?: string | null;
  product_code?: string | null;
  name: string;
  description?: string | null;
  image_url?: string | null;
  catalog_url?: string | null;
  status: "active" | "inactive" | "archived";
  sort_order?: number;
}

export interface CatalogVariantPayload {
  id?: string;
  product_id: string;
  brand_id: string;
  sku: string;
  channel: "retail" | "salon";
  size_label?: string | null;
  price: number;
  currency?: string;
  is_active: boolean;
  sort_order?: number;
}

/**
 * Validates if a string is a valid image URL (http/https) or relative/storage path.
 */
export function isValidImageUrl(val: string): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (trimmed === "") return true;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      new URL(trimmed);
      return true;
    } catch (_) {
      return false;
    }
  }
  // Allow valid storage path/relative path character sequence
  const startCheck = trimmed.startsWith("/") || /^[a-zA-Z0-9]/.test(trimmed);
  const charsCheck = !/[^a-zA-Z0-9_\-./]/.test(trimmed);
  return startCheck && charsCheck;
}

/**
 * Validates if a string is a valid http/https URL.
 */
export function isValidHttpUrl(val: string): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (trimmed === "") return true;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    new URL(trimmed);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Normalizes a SKU to uppercase alphanumeric characters, hyphens, and underscores.
 */
export function normalizeSku(sku: string): string {
  return sku
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_-]/g, "");
}

/**
 * Checks if a variant with the same channel and size label already exists on the product.
 */
export function hasDuplicateVariant(
  variants: { id?: string; channel: string; size_label?: string | null }[],
  newChannel: string,
  newSizeLabel: string | null,
  excludeId?: string,
): boolean {
  const normNewSize = (newSizeLabel || "").trim().toLowerCase();
  return variants.some((v) => {
    if (excludeId && v.id === excludeId) return false;
    const normSize = (v.size_label || "").trim().toLowerCase();
    return v.channel === newChannel && normSize === normNewSize;
  });
}

/**
 * Inserts or updates a catalog product record.
 */
export async function saveCatalogProduct(payload: CatalogProductPayload) {
  const { id, ...data } = payload;
  const cleanPayload = {
    brand_id: data.brand_id,
    category_id: data.category_id || null,
    product_code: data.product_code?.trim() || null,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    image_url: data.image_url?.trim() || null,
    catalog_url: data.catalog_url?.trim() || null,
    status: data.status,
    sort_order: Number(data.sort_order || 0),
  };

  if (id) {
    // Update existing product
    return await supabase
      .from("catalog_products")
      .update(cleanPayload)
      .eq("id", id)
      .select()
      .single();
  } else {
    // Insert new product
    return await supabase.from("catalog_products").insert(cleanPayload).select().single();
  }
}

/**
 * Inserts or updates a catalog product variant.
 * Enforces inventory_tracking_enabled = false and stock_policy = 'untracked'.
 * Also manages 1:1 inventory_stocks records.
 */
export async function saveCatalogVariant(payload: CatalogVariantPayload) {
  const { id, ...data } = payload;
  const cleanSku = normalizeSku(data.sku);
  const cleanSizeLabel = data.size_label?.trim() || null;

  const cleanPayload = {
    product_id: data.product_id,
    brand_id: data.brand_id,
    sku: cleanSku,
    channel: data.channel,
    size_label: cleanSizeLabel,
    price: Number(data.price || 0),
    currency: data.currency || "VND",
    inventory_tracking_enabled: false,
    stock_policy: "untracked",
    is_active: data.is_active,
    sort_order: Number(data.sort_order || 0),
  };

  if (id) {
    // Update existing variant
    const result = await supabase
      .from("catalog_product_variants")
      .update(cleanPayload)
      .eq("id", id)
      .select()
      .single();

    if (!result.error && result.data) {
      // Keep SKU in sync in inventory_stocks
      await supabase
        .from("inventory_stocks")
        .update({ sku: cleanSku, updated_at: new Date().toISOString() })
        .eq("variant_id", id);
    }
    return result;
  } else {
    // Insert new variant
    const result = await supabase
      .from("catalog_product_variants")
      .insert(cleanPayload)
      .select()
      .single();

    if (!result.error && result.data) {
      // Create 1:1 record in inventory_stocks
      const newVariantId = result.data.id;
      const { error: invErr } = await supabase.from("inventory_stocks").insert({
        variant_id: newVariantId,
        sku: cleanSku,
        stock_on_hand: 0,
        stock_reserved: 0,
        status: "untracked",
      });

      if (invErr) {
        console.warn("[catalogAdminDb] Failed to seed inventory stock row for variant:", invErr);
      }
    }
    return result;
  }
}

/**
 * Defensive check to verify if a product is used in orders.
 * Checks for matches in the `order_items` table where `product_no` corresponds
 * to the numeric `product_code` of the product.
 * Returns false if table is missing or columns do not exist.
 */
export async function checkProductInOrders(productCode: string | null): Promise<boolean> {
  if (!productCode) return false;
  const num = parseInt(productCode.trim(), 10);
  if (isNaN(num)) return false;

  try {
    const { count, error } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_no", num);

    if (error) {
      console.warn(
        "[catalogAdminDb] Defensive order check failed (normal if table/column does not exist):",
        error.message,
      );
      return false;
    }
    return (count || 0) > 0;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[catalogAdminDb] Exception in checkProductInOrders:", msg);
    return false;
  }
}
