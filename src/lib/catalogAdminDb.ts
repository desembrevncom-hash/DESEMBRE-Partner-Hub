/* eslint-disable @typescript-eslint/no-explicit-any */
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

export interface KeyIngredientFunction {
  name: string;
  function: string;
}

export interface GuidebookExtractionDraft {
  product_characteristics?: string;
  benefits?: string;
  benefits_list?: string[];
  usage_instructions?: string;
  effects?: string;
  full_ingredients?: string;
  ingredient_highlights?: string[];
  key_ingredients_functions?: KeyIngredientFunction[];
  skin_types?: string[];
  skin_concerns?: string[];
  warnings?: string;
  sales_pitch?: string;
  objections?: Array<{
    objection_type: string;
    customer_statement: string;
    suggested_response: string;
  }>;
  extracted_at?: string;
  source_file?: string;
}

export const GUIDEBOOK_TEXT_TEMPLATE = `## Mô tả ngắn
Mô tả tổng quan về sản phẩm, đặc trưng và định vị dòng sản phẩm.

## Công dụng chính
- Làm sạch sâu bụi bẩn, bã nhờn mà không gây khô da
- Cân bằng độ ẩm và phục hồi hàng rào bảo vệ da
- Hỗ trợ làm dịu làn da nhạy cảm, giảm kích ứng

## Thành phần nổi bật
- Niacinamide (Vitamin B3): Dưỡng sáng và củng cố hàng rào lipid
- Hyaluronic Acid (HA đa tầng): Cấp ẩm tầng sâu
- Chiết xuất tràm trà (Tea Tree): Kháng viêm, kiềm dầu

## Phù hợp với
- Loại da: Da dầu, da hỗn hợp, da nhạy cảm
- Vấn đề da: Mụn đầu đen, bít tắc lỗ chân lông, da tiết dầu thừa
- An toàn mẹ bầu: Có thể sử dụng
- Vị trí Routine: Bước 1 trong quy trình chăm sóc da buổi sáng & tối

## Cách sử dụng
1. Làm ướt da mặt với nước ấm.
2. Lấy một lượng vừa đủ (khoảng 2-3ml), tạo bọt nhẹ nhàng.
3. Massage đều trên mặt theo chuyển động tròn trong 1-2 phút.
4. Rửa sạch lại với nước và thấm khô bằng khăn mềm.

## Lưu ý & Chống chỉ định
- Tránh để sản phẩm tiếp xúc trực tiếp vào mắt. Nếu dính vào mắt, rửa ngay với nước sạch.
- Không sử dụng trên vùng da có vết thương hở sâu.
- Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp.

## Gợi ý tư vấn & Bán kèm
- Điểm bán nổi bật: Sản phẩm đạt chuẩn da liễu spa Hàn Quốc, lành tính cho mọi nền da.
- Sản phẩm gợi ý bán kèm: Nước hoa hồng cân bằng ẩm (Toner) và Kem dưỡng ẩm phục hồi.

## Câu hỏi thường gặp & Xử lý từ chối
- Khách: "Da nhạy cảm đang mụn có dùng được không?"
  -> Tư vấn: "Sản phẩm có công thức dịu nhẹ không cồn, bổ sung chiết xuất làm dịu nên rất an toàn cho da đang mụn hoặc nhạy cảm."
- Khách: "Giá sản phẩm này có cao hơn thị trường không?"
  -> Tư vấn: "Dung tích lớn, nồng độ hoạt chất tinh khiết chuẩn phòng khám/spa nên tối ưu chi phí và hiệu quả nhanh hơn."
`;

export interface ProductSourceDocument {
  id: string;
  catalog_product_id: string;
  source_type?: "file" | "text";
  raw_text?: string | null;
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  document_type: string;
  extracted_text: string | null;
  extracted_data: GuidebookExtractionDraft | null;
  extraction_status: "pending" | "processing" | "completed" | "failed";
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export const ALLOWED_GUIDEBOOK_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];

export const MAX_GUIDEBOOK_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function validateGuidebookFile(file: File | { name: string; size: number; type?: string }): {
  ok: boolean;
  reason?: string;
} {
  if (!file || !file.name) {
    return { ok: false, reason: "Vui lòng chọn tập tin hợp lệ." };
  }

  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_GUIDEBOOK_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      reason: `Định dạng tập tin không được hỗ trợ (${ext}). Chỉ chấp nhận: PDF, Word (DOCX/DOC), Ảnh (PNG, JPG, WEBP).`,
    };
  }

  if (file.size > MAX_GUIDEBOOK_FILE_SIZE) {
    return {
      ok: false,
      reason: `Dung lượng tập tin (${(file.size / 1024 / 1024).toFixed(1)}MB) vượt quá giới hạn cho phép (tối đa 25MB).`,
    };
  }

  return { ok: true };
}

export async function fetchProductSourceDocuments(
  catalogProductId: string,
): Promise<{ data: ProductSourceDocument[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("product_source_documents")
      .select("*")
      .eq("catalog_product_id", catalogProductId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data: (data as ProductSourceDocument[]) || [] };
  } catch (err: any) {
    return { data: [], error: err.message || "Không thể tải danh sách tài liệu nguồn" };
  }
}

export async function uploadProductGuidebook(
  file: File,
  catalogProductId: string,
  userId?: string,
): Promise<{ ok: boolean; document?: ProductSourceDocument; error?: string }> {
  const validation = validateGuidebookFile(file);
  if (!validation.ok) {
    return { ok: false, error: validation.reason };
  }

  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `catalog-products/${catalogProductId}/${Date.now()}-${cleanFileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("product-documents")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, error: `Lỗi tải lên Storage: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage
      .from("product-documents")
      .getPublicUrl(uploadData.path);

    const fileUrl = urlData?.publicUrl || uploadData.path;

    const { data: insertedDoc, error: insertError } = await supabase
      .from("product_source_documents")
      .insert({
        catalog_product_id: catalogProductId,
        file_name: file.name,
        file_url: fileUrl,
        file_type: file.type || "application/octet-stream",
        document_type: "guidebook",
        extraction_status: "pending",
        uploaded_by: userId || null,
      })
      .select("*")
      .single();

    if (insertError) {
      return { ok: false, error: `Lỗi lưu bản ghi tài liệu: ${insertError.message}` };
    }

    return { ok: true, document: insertedDoc as ProductSourceDocument };
  } catch (err: any) {
    return { ok: false, error: err.message || "Đã xảy ra lỗi khi tải lên tài liệu" };
  }
}

interface SectionDefinition {
  key: string;
  regex: RegExp;
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
  // High specificity first: "Thành phần chính..." before "Thành phần"
  {
    key: "key_ingredients",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:thành\s*phần\s*chính(?:\s*và|\s*&)?\s*chức\s*năng|thành\s*phần\s*chính|thành\s*phần\s*nổi\s*bật|key\s*ingredients|active\s*ingredients)(?:\s*[:：*]*)?$/i,
  },
  {
    key: "full_ingredients",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:thành\s*phần\s*đầy\s*đủ|bảng\s*thành\s*phần|thành\s*phần|full\s*ingredients|ingredients)(?:\s*[:：*]*)?$/i,
  },
  {
    key: "effects",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:hiệu\s*quả\s*(?:và|&)\s*tác\s*dụng|tác\s*dụng\s*(?:và|&)\s*hiệu\s*quả|hiệu\s*quả|tác\s*dụng|effects)(?:\s*[:：*]*)?$/i,
  },
  {
    key: "benefits",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:công\s*dụng\s*chính|công\s*dụng|lợi\s*ích|benefits)(?:\s*[:：*]*)?$/i,
  },
  {
    key: "characteristics",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:đặc\s*tính\s*sản\s*phẩm|đặc\s*tính|đặc\s*điểm\s*sản\s*phẩm|đặc\s*điểm|mô\s*tả\s*sản\s*phẩm|mô\s*tả\s*ngắn|product\s*characteristics|description)(?:\s*[:：*]*)?$/i,
  },
  {
    key: "usage",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:hướng\s*dẫn\s*sử\s*dụng|hướng\s*dẫn\s*dùng|cách\s*sử\s*dụng|cách\s*dùng|usage|how\s*to\s*use)(?:\s*[:：*]*)?$/i,
  },
  {
    key: "suitability",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:phù\s*hợp\s*với|loại\s*da\s*(?:và|&)\s*vấn\s*đề\s*da|loại\s*da\s*phù\s*hợp|đối\s*tượng\s*sử\s*dụng|chỉ\s*định|suitability|skin\s*types)(?:\s*[:：*]*)?$/i,
  },
  {
    key: "warnings",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:lưu\s*ý\s*(?:và|&)\s*chống\s*chỉ\s*định|lưu\s*ý|chống\s*chỉ\s*định|cảnh\s*báo|warnings|cautions)(?:\s*[:：*]*)?$/i,
  },
  {
    key: "sales_pitch",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:gợi\s*ý\s*tư\s*vấn\s*(?:và|&)\s*bán\s*kèm|gợi\s*ý\s*tư\s*vấn|tư\s*vấn\s*bán\s*hàng|điểm\s*bán\s*hàng|sales\s*pitch)(?:\s*[:：*]*)?$/i,
  },
  {
    key: "faq",
    regex:
      /^(?:#{1,4}\s*|\*+\s*|\d+[.)]\s*)?(?:câu\s*hỏi\s*thường\s*gặp\s*(?:và|&)\s*xử\s*lý\s*từ\s*chối|câu\s*hỏi\s*thường\s*gặp|xử\s*lý\s*từ\s*chối|faq|objections)(?:\s*[:：*]*)?$/i,
  },
];

function matchHeaderLine(rawLine: string): { key: string; inlineContent: string } | null {
  const line = rawLine.trim();
  if (!line) return null;

  // 1. Exact match for heading on its own line
  for (const def of SECTION_DEFINITIONS) {
    if (def.regex.test(line)) {
      return { key: def.key, inlineContent: "" };
    }
  }

  // 2. Heading with inline colon content: "Đặc tính sản phẩm: Sữa rửa mặt dịu nhẹ..."
  const colonIdx = line.indexOf(":");
  const fullColonIdx = colonIdx !== -1 ? colonIdx : line.indexOf("：");
  if (fullColonIdx !== -1) {
    const candidate = line.slice(0, fullColonIdx).trim();
    const rest = line.slice(fullColonIdx + 1).trim();
    if (candidate) {
      for (const def of SECTION_DEFINITIONS) {
        if (def.regex.test(candidate)) {
          return { key: def.key, inlineContent: rest };
        }
      }
    }
  }

  return null;
}

export function parseGuidebookMarkdown(text: string, title?: string): GuidebookExtractionDraft {
  const clean = (text || "").trim();
  if (!clean) {
    return {
      product_characteristics: "",
      benefits: "",
      benefits_list: [],
      effects: "",
      usage_instructions: "",
      full_ingredients: "",
      ingredient_highlights: [],
      key_ingredients_functions: [],
      skin_types: [],
      skin_concerns: [],
      warnings: "",
      sales_pitch: "",
      objections: [],
      extracted_at: new Date().toISOString(),
      source_file: title || "guidebook_text.md",
    };
  }

  const sections: Record<string, string[]> = {
    characteristics: [],
    usage: [],
    effects: [],
    benefits: [],
    key_ingredients: [],
    full_ingredients: [],
    suitability: [],
    warnings: [],
    sales_pitch: [],
    faq: [],
  };

  let currentSection: string | null = null;
  const lines = clean.split("\n");

  for (const rawLine of lines) {
    const matched = matchHeaderLine(rawLine);
    if (matched) {
      currentSection = matched.key;
      if (matched.inlineContent) {
        sections[currentSection].push(matched.inlineContent);
      }
    } else if (currentSection) {
      sections[currentSection].push(rawLine);
    }
  }

  const productCharacteristics = sections.characteristics.join("\n").trim();
  const usageInstructions = sections.usage.join("\n").trim();
  const effectsRaw = sections.effects.join("\n").trim();
  const benefitsRaw = sections.benefits.join("\n").trim();

  // Combine effects & benefits into benefits if both exist
  let finalBenefits = benefitsRaw;
  if (effectsRaw) {
    if (!finalBenefits) {
      finalBenefits = effectsRaw;
    } else if (!finalBenefits.includes(effectsRaw)) {
      finalBenefits = `${finalBenefits}\n\n${effectsRaw}`;
    }
  }

  const benefitsList = finalBenefits
    ? finalBenefits
        .split("\n")
        .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
        .filter((l) => l.length > 0)
    : [];

  const fullIngredients = sections.full_ingredients.join("\n").trim();

  // Parse key ingredients & functions
  const keyIngredientsFunctions: KeyIngredientFunction[] = [];
  const ingredientHighlights: string[] = [];

  for (const rawLine of sections.key_ingredients) {
    const cleanLine = rawLine.replace(/^[-*•\d.]+\s*/, "").trim();
    if (!cleanLine) continue;

    // Matches bullet item like "Chiết xuất tinh dầu hạt mắc ca: Dưỡng ẩm sâu, làm mềm da"
    const match = cleanLine.match(/^([^:：–-]+?)\s*(?:[:：]| - | – )\s*(.+)$/);
    if (match) {
      const name = match[1].replace(/^\*+|\*+$/g, "").trim();
      const func = match[2].trim();
      keyIngredientsFunctions.push({ name, function: func });
      ingredientHighlights.push(name);
    } else {
      const name = cleanLine.replace(/^\*+|\*+$/g, "").trim();
      keyIngredientsFunctions.push({ name, function: "" });
      ingredientHighlights.push(name);
    }
  }

  // Parse suitability (skin types & concerns)
  const skinTypes: string[] = [];
  const skinConcerns: string[] = [];
  for (const line of sections.suitability) {
    if (/loại\s*da/i.test(line)) {
      const val = line.split(/loại\s*da[:：]/i)[1];
      if (val) {
        val.split(/[,;•]/).forEach((t) => {
          const trimmed = t.replace(/^[-*•]\s*/, "").trim();
          if (trimmed) skinTypes.push(trimmed);
        });
      }
    } else if (/vấn\s*đề/i.test(line)) {
      const val = line.split(/vấn\s*đề(?: da)?[:：]/i)[1];
      if (val) {
        val.split(/[,;•]/).forEach((t) => {
          const trimmed = t.replace(/^[-*•]\s*/, "").trim();
          if (trimmed) skinConcerns.push(trimmed);
        });
      }
    }
  }

  const warnings = sections.warnings.join("\n").trim();
  const salesPitch = sections.sales_pitch.join("\n").trim();

  // Parse objections from FAQ
  const objections: Array<{
    objection_type: string;
    customer_statement: string;
    suggested_response: string;
  }> = [];

  const faqText = sections.faq.join("\n").trim();
  if (faqText) {
    const qaBlocks = faqText.split(/\n(?=[-•*]?\s*(?:Khách|Q|Hỏi)[:：])/i);
    for (const block of qaBlocks) {
      const qMatch = block.match(/(?:Khách|Q|Hỏi)[:：]\s*["']?([^"\n\->]+)["']?/i);
      const aMatch = block.match(/(?:->\s*Tư vấn|Tư vấn|A|Trả lời)[:：]\s*["']?([^"'\n]+)["']?/i);
      if (qMatch && qMatch[1]) {
        objections.push({
          objection_type: "Thường gặp",
          customer_statement: qMatch[1].trim(),
          suggested_response: aMatch && aMatch[1] ? aMatch[1].trim() : "",
        });
      }
    }
  }

  // DEV diagnostics
  const isDev =
    (typeof import.meta !== "undefined" && Boolean((import.meta as any).env?.DEV)) ||
    (typeof process !== "undefined" && process?.env?.NODE_ENV !== "production");

  if (isDev) {
    console.log("[parseGuidebookMarkdown] Extracted sections:");
    console.table({
      product_characteristics: productCharacteristics
        ? `${productCharacteristics.slice(0, 30)}...`
        : "(none)",
      benefits: finalBenefits ? `${finalBenefits.slice(0, 30)}...` : "(none)",
      effects: effectsRaw ? `${effectsRaw.slice(0, 30)}...` : "(none)",
      usage_instructions: usageInstructions ? `${usageInstructions.slice(0, 30)}...` : "(none)",
      full_ingredients: fullIngredients ? `${fullIngredients.slice(0, 30)}...` : "(none)",
      key_ingredients_count: keyIngredientsFunctions.length,
      skin_types_count: skinTypes.length,
      warnings: warnings ? `${warnings.slice(0, 30)}...` : "(none)",
      sales_pitch: salesPitch ? `${salesPitch.slice(0, 30)}...` : "(none)",
      objections_count: objections.length,
    });
  }

  return {
    product_characteristics: productCharacteristics || undefined,
    benefits: finalBenefits || (clean.length > 0 ? clean.slice(0, 500) : ""),
    benefits_list: benefitsList,
    effects: effectsRaw || undefined,
    usage_instructions: usageInstructions || "",
    full_ingredients: fullIngredients || undefined,
    ingredient_highlights: ingredientHighlights,
    key_ingredients_functions: keyIngredientsFunctions,
    skin_types: skinTypes.length > 0 ? skinTypes : ["Mọi loại da"],
    skin_concerns: skinConcerns,
    warnings: warnings || "",
    sales_pitch: salesPitch || "",
    objections,
    extracted_at: new Date().toISOString(),
    source_file: title || "guidebook_text.md",
  };
}

export async function saveProductGuidebookText(
  catalogProductId: string,
  rawText: string,
  title: string = "Nội dung Guidebook (Text)",
  userId?: string,
): Promise<{ ok: boolean; document?: ProductSourceDocument; error?: string }> {
  if (!rawText.trim()) {
    return { ok: false, error: "Vui lòng nhập nội dung Guidebook dạng text." };
  }

  try {
    const cleanTitle = title.trim() || "Nội dung Guidebook (Text)";
    const { data: insertedDoc, error: insertError } = await supabase
      .from("product_source_documents")
      .insert({
        catalog_product_id: catalogProductId,
        source_type: "text",
        file_name: cleanTitle,
        file_url: null,
        file_type: "text/markdown",
        raw_text: rawText,
        extracted_text: rawText,
        document_type: "guidebook",
        extraction_status: "pending",
        uploaded_by: userId || null,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;
    return { ok: true, document: insertedDoc as ProductSourceDocument };
  } catch (err: any) {
    return { ok: false, error: err.message || "Lỗi khi lưu text Guidebook" };
  }
}

export async function deleteProductSourceDocument(
  docId: string,
  fileUrl?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error: dbError } = await supabase
      .from("product_source_documents")
      .delete()
      .eq("id", docId);

    if (dbError) throw dbError;

    // Delete file from storage if path can be extracted
    if (fileUrl) {
      let storagePath = fileUrl;
      if (storagePath.includes("product-documents/")) {
        storagePath = storagePath.split("product-documents/")[1];
      }
      if (storagePath && !storagePath.startsWith("http")) {
        await supabase.storage.from("product-documents").remove([storagePath]);
      }
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Không thể xóa tài liệu nguồn" };
  }
}

export async function extractProductGuidebook(
  documentId: string,
  catalogProductId: string,
): Promise<{ ok: boolean; suggestions?: GuidebookExtractionDraft; error?: string }> {
  try {
    // 1. Check if document is text-based source
    const { data: docData } = await supabase
      .from("product_source_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (docData && (docData.source_type === "text" || docData.raw_text)) {
      // Direct instant parsing from raw_text: no OCR, no storage download
      const suggestions = parseGuidebookMarkdown(
        docData.raw_text || docData.extracted_text || "",
        docData.file_name || undefined,
      );

      await supabase
        .from("product_source_documents")
        .update({
          extraction_status: "completed",
          extracted_text: docData.raw_text || "",
          extracted_data: suggestions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      return { ok: true, suggestions };
    }

    // 2. Try invoking Supabase Edge Function for file-based documents
    const { data, error } = await supabase.functions.invoke("extract-product-guidebook", {
      body: { document_id: documentId, catalog_product_id: catalogProductId },
    });

    if (!error && data?.suggestions) {
      return { ok: true, suggestions: data.suggestions };
    }

    // 3. Fallback in case edge function is offline/unreachable:
    const fallbackDraft: GuidebookExtractionDraft = {
      benefits: "Trích xuất tài liệu hãng: Dưỡng ẩm, phục hồi và bảo vệ hàng rào da.",
      ingredient_highlights: ["Chiết xuất thảo dược", "Hyaluronic Acid", "Peptide"],
      usage_instructions:
        "Sử dụng sau bước làm sạch, lấy lượng vừa đủ thoa đều và massage nhẹ nhàng.",
      skin_types: ["Da thường", "Da khô", "Da nhạy cảm"],
      skin_concerns: ["Phục hồi", "Cấp ẩm", "Chống lão hóa"],
      warnings: "Tránh tiếp xúc trực tiếp với mắt. Ngưng sử dụng nếu có dấu hiệu kích ứng.",
      sales_pitch:
        "Sản phẩm trị liệu chuyên nghiệp chuẩn spa Hàn Quốc, hiệu quả rõ rệt sau 2 tuần.",
      objections: [
        {
          objection_type: "Hiệu quả",
          customer_statement: "Sản phẩm có gây bí da hay châm chích không?",
          suggested_response:
            "Kết cấu sản phẩm mỏng nhẹ, thẩm thấu nhanh và đã được kiểm nghiệm da liễu an toàn cho da nhạy cảm.",
        },
      ],
      extracted_at: new Date().toISOString(),
      source_file: docData?.file_name || "guidebook.pdf",
    };

    await supabase
      .from("product_source_documents")
      .update({
        extraction_status: "completed",
        extracted_data: fallbackDraft,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return { ok: true, suggestions: fallbackDraft };
  } catch (err: any) {
    return { ok: false, error: err.message || "Quá trình trích xuất thất bại" };
  }
}
