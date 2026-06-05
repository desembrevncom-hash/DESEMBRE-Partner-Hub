export type CartItem = {
  productId: string | number;
  name: string;
  unitPrice: number;
  quantity: number;
  size?: string;
  sizeType?: "retail" | "salon";
};

export type OrderCreationInput = {
  items: CartItem[];
  customerName: string;
  role: "admin" | "sale" | "guest";
  includeVat: boolean;
  vatRate?: number;
};

export function calculateOrderTotal(items: CartItem[]) {
  return items.reduce((total, item) => {
    return total + item.unitPrice * item.quantity;
  }, 0);
}

export function validateAndPrepareOrder(input: OrderCreationInput) {
  if (!input.items || input.items.length === 0) {
    return { ok: false as const, error: "Giỏ hàng rỗng, không thể tạo đơn hàng." };
  }

  const cleanName = (input.customerName || "").trim();
  if (!cleanName) {
    return { ok: false as const, error: "Vui lòng nhập tên khách hàng." };
  }

  const subtotal = calculateOrderTotal(input.items);
  const discountRate = input.role === "sale" ? 0.4 : 0;
  const priceAfterDiscount = Math.round(subtotal * (1 - discountRate));

  const vatRate = input.vatRate ?? 0.08;
  const vatAmount = input.includeVat ? Math.round(priceAfterDiscount * vatRate) : 0;
  const total = priceAfterDiscount + vatAmount;

  return {
    ok: true as const,
    data: {
      customerName: cleanName,
      subtotal,
      discountRate,
      vatRate: input.includeVat ? vatRate : 0,
      vatAmount,
      total,
      itemCount: input.items.reduce((acc, item) => acc + item.quantity, 0),
    },
  };
}

// ==========================================
// NEW DB PAYLOAD & HYDRATION HELPERS (Phase v1.4.1E.2)
// ==========================================

export interface DbCartItem {
  source: "db_catalog";
  catalog_product_id: string;
  variant_id: string;
  brand_id: string;
  brand_name: string;
  brand_code: string;
  product_code: string | null;
  sku: string;
  product_name: string;
  category_name: string | null;
  channel: "retail" | "salon";
  size_label: string | null;
  unit_price: number; // original price in catalog_product_variants
  currency: "VND";
  image_url: string | null;
  catalog_url: string | null;
  inventory_tracking_enabled: false;
  stock_policy: "untracked";
  added_at: string;
  quantity?: number; // Optional quantity in cart
}

export interface HydratedLineItem {
  source: "legacy_static" | "db_catalog";
  product_no: number | null;
  catalog_product_id: string | null;
  variant_id: string | null;
  sku_snapshot: string;
  brand_name_snapshot: string;
  product_name_snapshot: string;
  variant_label_snapshot: string;
  channel_snapshot: "retail" | "salon";
  unit_price_snapshot: number; // original price
  display_name: string;
  size: string;
  size_type: "retail" | "salon";
  unit_price: number; // price after role/gift discounts
  quantity: number;
  line_total: number;
  image_url: string | null;
  catalog_url: string | null;
}

/**
 * Validates a DB-native cart item and returns a detailed status result.
 */
export function validateDbCartItem(
  item: any,
): { ok: true; value: DbCartItem } | { ok: false; reason: string } {
  if (!item || typeof item !== "object") {
    return { ok: false, reason: "Item is not an object or is null/undefined" };
  }
  if (item.source !== "db_catalog") {
    return { ok: false, reason: "source must be 'db_catalog'" };
  }
  if (!item.catalog_product_id) {
    return { ok: false, reason: "catalog_product_id is required" };
  }
  if (!item.variant_id) {
    return { ok: false, reason: "variant_id is required" };
  }
  if (!item.brand_name) {
    return { ok: false, reason: "brand_name is required" };
  }
  if (!item.sku) {
    return { ok: false, reason: "sku is required" };
  }
  if (!item.product_name) {
    return { ok: false, reason: "product_name is required" };
  }
  if (item.channel !== "retail" && item.channel !== "salon") {
    return { ok: false, reason: "channel must be 'retail' or 'salon'" };
  }
  if (typeof item.unit_price !== "number" || item.unit_price < 0 || isNaN(item.unit_price)) {
    return { ok: false, reason: "unit_price must be a number >= 0" };
  }
  if (item.inventory_tracking_enabled !== false) {
    return { ok: false, reason: "inventory_tracking_enabled must be false" };
  }
  if (item.stock_policy !== "untracked") {
    return { ok: false, reason: "stock_policy must be 'untracked'" };
  }

  return { ok: true, value: item as DbCartItem };
}

/**
 * Normalizes a legacy static cart item to a HydratedLineItem.
 */
export function normalizeLegacyCartItem(
  pk: { no: number; sizeType: "retail" | "salon"; quantity?: number },
  staticProducts: any[],
  overridesMap: Record<number, any>,
  isSale: boolean,
  defaultDiscount: number,
): HydratedLineItem | null {
  const staticP = staticProducts.find((p) => p.id === pk.no);
  const o = overridesMap[pk.no];

  if (!staticP && (!o || !o.is_custom)) return null;

  let productName = staticP?.name ?? o?.name ?? "(Chưa có tên)";
  const imageUrl = o?.image_url ?? staticP?.imageUrl ?? null;
  const catalogUrl = staticP?.pdfUrl ?? o?.link_url ?? null;
  let basePrice = 0;
  let size = "";

  const staticVariant = staticP?.variants?.find((v: any) => v.type === pk.sizeType);
  basePrice = staticVariant?.price ?? 0;
  size = staticVariant?.size ?? "";

  if (o) {
    productName = o.name ?? productName;
    if (pk.sizeType === "retail") {
      if (o.retail_price != null) basePrice = o.retail_price;
      if (o.retail_size != null) size = o.retail_size;
    } else {
      if (o.salon_price != null) basePrice = o.salon_price;
      if (o.salon_size != null) size = o.salon_size;
    }
  }

  if (basePrice === 0) return null;

  const discounted = basePrice * (isSale ? 1 - defaultDiscount : 1);
  const variantLabel = `${pk.sizeType === "retail" ? "Retail" : "Salon"} - ${size}`;
  const sku = `DESEMBRE-${pk.no}-${pk.sizeType.toUpperCase()}`;

  return {
    source: "legacy_static",
    product_no: pk.no,
    catalog_product_id: null,
    variant_id: null,
    sku_snapshot: sku,
    brand_name_snapshot: "Desembre",
    product_name_snapshot: productName,
    variant_label_snapshot: variantLabel,
    channel_snapshot: pk.sizeType,
    unit_price_snapshot: basePrice,
    display_name: `${productName} (${variantLabel})`,
    size,
    size_type: pk.sizeType,
    unit_price: discounted,
    quantity: pk.quantity || 1,
    line_total: discounted * (pk.quantity || 1),
    image_url: imageUrl,
    catalog_url: catalogUrl,
  };
}

/**
 * Normalizes a DB-native cart item to a HydratedLineItem.
 */
export function normalizeDbCartItem(
  item: any,
  isSale: boolean,
  defaultDiscount: number,
): HydratedLineItem | null {
  const check = validateDbCartItem(item);
  if (!check.ok) return null;

  const dbItem = check.value;
  const basePrice = dbItem.unit_price;
  const discounted = basePrice * (isSale ? 1 - defaultDiscount : 1);

  const variantLabel = `${dbItem.channel === "retail" ? "Retail" : "Salon"}${dbItem.size_label ? ` - ${dbItem.size_label}` : ""}`;

  let productNo: number | null = null;
  if (dbItem.product_code) {
    const parsed = parseInt(dbItem.product_code, 10);
    if (!isNaN(parsed) && String(parsed) === dbItem.product_code.trim()) {
      productNo = parsed;
    }
  }

  return {
    source: "db_catalog",
    product_no: productNo,
    catalog_product_id: dbItem.catalog_product_id,
    variant_id: dbItem.variant_id,
    sku_snapshot: dbItem.sku,
    brand_name_snapshot: dbItem.brand_name,
    product_name_snapshot: dbItem.product_name,
    variant_label_snapshot: variantLabel,
    channel_snapshot: dbItem.channel,
    unit_price_snapshot: basePrice,
    display_name: `${dbItem.product_name} (${variantLabel})`,
    size: dbItem.size_label || "",
    size_type: dbItem.channel,
    unit_price: discounted,
    quantity: dbItem.quantity || 1,
    line_total: discounted * (dbItem.quantity || 1),
    image_url: dbItem.image_url,
    catalog_url: dbItem.catalog_url,
  };
}

/**
 * Returns grouping key based on item source.
 */
export function getGroupingKey(item: HydratedLineItem): string {
  if (item.source === "db_catalog") {
    return `db:${item.variant_id}`;
  }
  return `legacy:${item.product_no}:${item.size_type}`;
}

/**
 * Groups identical items in a cart, summing their quantities.
 */
export function groupCartItems(items: HydratedLineItem[]): HydratedLineItem[] {
  const merged: HydratedLineItem[] = [];
  for (const item of items) {
    const key = getGroupingKey(item);
    const existing = merged.find((m) => getGroupingKey(m) === key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.line_total = existing.unit_price * existing.quantity;
    } else {
      merged.push({
        ...item,
        line_total: item.unit_price * item.quantity,
      });
    }
  }
  return merged;
}

/**
 * Helper to check if a DB item (product & variant) is active.
 */
export function isDbItemActive(productStatus: string, variantIsActive: boolean): boolean {
  return productStatus === "active" && variantIsActive;
}

/**
 * Validates if the source value is acceptable.
 */
export function isValidSource(source: string): boolean {
  return source === "legacy_static" || source === "db_catalog";
}

/**
 * Maps a hydrated line item to the order_items insert payload.
 */
export function mapItemToOrderInsert(it: HydratedLineItem, orderId: string) {
  const isLegacy = it.source === "legacy_static";

  let productNo: number | null = null;
  if (isLegacy) {
    productNo = it.product_no;
  } else if (it.product_no !== null) {
    productNo = it.product_no; // Only fill if numeric legacy-safe
  }

  return {
    order_id: orderId,
    product_no: productNo,
    product_name: it.product_name_snapshot,
    size: it.size || null,
    size_type: it.size_type,
    unit_price: it.unit_price,
    quantity: it.quantity,
    line_total: it.unit_price * it.quantity,

    // New snapshot columns
    source: it.source,
    catalog_product_id: it.catalog_product_id,
    variant_id: it.variant_id,
    sku_snapshot: it.sku_snapshot,
    brand_name_snapshot: it.brand_name_snapshot,
    product_name_snapshot: it.product_name_snapshot,
    variant_label_snapshot: it.variant_label_snapshot,
    channel_snapshot: it.channel_snapshot,
    unit_price_snapshot: it.unit_price_snapshot,
  };
}
