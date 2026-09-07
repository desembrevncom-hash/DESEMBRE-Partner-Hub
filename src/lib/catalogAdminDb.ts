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

/**
 * Product image file constraints and validation helpers
 */
export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_PRODUCT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validateProductImageFile(file: File | null | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!file) {
    return { valid: false, error: "Chưa chọn tệp ảnh." };
  }
  if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP.",
    };
  }
  if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
    return {
      valid: false,
      error: "Dung lượng ảnh vượt quá giới hạn 5MB.",
    };
  }
  return { valid: true };
}

/**
 * Uploads a product image file to Supabase Storage in the 'product-images' bucket.
 * Path format: catalog-products/{productId}/{timestamp}-{safe-file-name}
 */
export async function uploadProductImage(
  productId: string,
  file: File,
): Promise<{ publicUrl?: string; error?: string }> {
  const validation = validateProductImageFile(file);
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    const cleanFileName = (file.name || "image.png")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]/g, "_");
    const targetId = productId || "temp";
    const filePath = `catalog-products/${targetId}/${Date.now()}-${cleanFileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(data.path);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      return { error: "Không lấy được đường dẫn công khai của ảnh." };
    }

    return { publicUrl: publicUrlData.publicUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

/**
 * Uploads a product image file and updates the catalog_products table with the new image_url.
 * Ensures the target product ID is verified and updates catalog_products with strict error checking.
 */
export async function uploadAndSaveProductImage(
  productId: string,
  file: File,
  productCode?: string | null,
): Promise<{ publicUrl?: string; error?: string; updatedProduct?: unknown }> {
  // 1. Verify target product ID in catalog_products
  let targetId = productId;
  let targetCode = productCode;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);

  // If productId is not a UUID, resolve real UUID from catalog_products
  if (!isUuid) {
    const searchVal = targetCode || targetId;
    const { data: found } = await supabase
      .from("catalog_products")
      .select("id, product_code, name")
      .or(`product_code.eq.${searchVal},id.eq.${searchVal}`)
      .maybeSingle();

    if (found?.id) {
      targetId = found.id;
      targetCode = found.product_code || targetCode;
    }
  }

  // 2. Upload file to Supabase Storage
  const uploadRes = await uploadProductImage(targetId, file);
  if (uploadRes.error || !uploadRes.publicUrl) {
    if (import.meta.env.DEV) {
      console.error("[catalogAdminDb] Storage upload failed:", {
        productId: targetId,
        product_code: targetCode,
        error: uploadRes.error,
      });
    }
    return { error: uploadRes.error || "Tải ảnh lên Storage thất bại." };
  }

  // 3. Persist to public.catalog_products.image_url
  const { data: updatedRows, error: dbError } = await supabase
    .from("catalog_products")
    .update({ image_url: uploadRes.publicUrl })
    .eq("id", targetId)
    .select("id, product_code, name, image_url");

  if (dbError) {
    if (import.meta.env.DEV) {
      console.error("[catalogAdminDb] Failed to update catalog_products.image_url:", {
        productId: targetId,
        product_code: targetCode,
        uploadedUrl: uploadRes.publicUrl,
        updateError: dbError.message,
      });
    }
    return {
      error: `Ảnh đã tải lên Storage nhưng lưu vào database thất bại: ${dbError.message}`,
    };
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Attempt fallback by product_code if available
    if (targetCode) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("catalog_products")
        .update({ image_url: uploadRes.publicUrl })
        .eq("product_code", targetCode)
        .select("id, product_code, name, image_url");

      if (!fallbackError && fallbackRows && fallbackRows.length > 0) {
        if (import.meta.env.DEV) {
          console.log("[catalogAdminDb] Persisted catalog_products.image_url via product_code:", {
            productId: targetId,
            product_code: targetCode,
            uploadedUrl: uploadRes.publicUrl,
            updatedRow: fallbackRows[0],
          });
        }
        return { publicUrl: uploadRes.publicUrl, updatedProduct: fallbackRows[0] };
      }
    }

    if (import.meta.env.DEV) {
      console.error("[catalogAdminDb] 0 rows updated in catalog_products:", {
        productId: targetId,
        product_code: targetCode,
        uploadedUrl: uploadRes.publicUrl,
        updateError: "0 rows matched target ID",
      });
    }
    return {
      error:
        "Không tìm thấy sản phẩm tương ứng trong cơ sở dữ liệu để cập nhật ảnh (0 hàng được cập nhật).",
    };
  }

  if (import.meta.env.DEV) {
    console.log("[catalogAdminDb] Successfully persisted catalog_products.image_url:", {
      productId: targetId,
      product_code: targetCode || updatedRows[0]?.product_code,
      uploadedUrl: uploadRes.publicUrl,
      updatedRow: updatedRows[0],
    });
  }

  return { publicUrl: uploadRes.publicUrl, updatedProduct: updatedRows[0] };
}
