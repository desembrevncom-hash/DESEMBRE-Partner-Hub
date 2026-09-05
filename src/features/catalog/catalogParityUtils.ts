import type { PublicProduct, PublicPriceItem } from "./types";

export interface ProductOverrideSafe {
  no?: number | null;
  product_no?: number | string | null;
  product_id?: string | null;
  catalog_product_id?: string | null;
  sku?: string | null;
  name?: string | null;
  desc?: string | null;
  image_url?: string | null;
  image_data_url?: string | null;
  retail_size?: string | null;
  retail_price?: number | null;
  salon_size?: string | null;
}

/**
 * Builds a multi-key lookup index from product overrides.
 * Indexes by all safe available identifiers:
 * - no
 * - product_no
 * - product_id
 * - catalog_product_id
 * - sku
 */
export function buildOverrideIndex(
  overrides: ProductOverrideSafe[],
): Map<string, ProductOverrideSafe> {
  const index = new Map<string, ProductOverrideSafe>();

  for (const row of overrides) {
    if (row.no != null) {
      index.set(String(row.no), row);
    }
    if (row.product_no != null) {
      index.set(String(row.product_no), row);
    }
    if (row.product_id != null && String(row.product_id).trim()) {
      index.set(String(row.product_id).trim(), row);
    }
    if (row.catalog_product_id != null && String(row.catalog_product_id).trim()) {
      index.set(String(row.catalog_product_id).trim(), row);
    }
    if (row.sku != null && String(row.sku).trim()) {
      index.set(String(row.sku).trim().toLowerCase(), row);
    }
  }

  return index;
}

/**
 * Finds matching override for a product using all safe available identifiers.
 */
export function findMatchingOverride(
  p: {
    id?: string | number | null;
    dbId?: string | null;
    product_code?: string | null;
    catalog_product_id?: string | null;
    sku?: string | null;
    variants?: Array<{ sku?: string | null }>;
  },
  index: Map<string, ProductOverrideSafe>,
): ProductOverrideSafe | undefined {
  if (p.product_code != null && index.has(String(p.product_code).trim())) {
    return index.get(String(p.product_code).trim());
  }
  if (p.id != null && index.has(String(p.id).trim())) {
    return index.get(String(p.id).trim());
  }
  if (p.dbId != null && index.has(String(p.dbId).trim())) {
    return index.get(String(p.dbId).trim());
  }
  if (p.catalog_product_id != null && index.has(String(p.catalog_product_id).trim())) {
    return index.get(String(p.catalog_product_id).trim());
  }
  if (p.sku != null && index.has(String(p.sku).trim().toLowerCase())) {
    return index.get(String(p.sku).trim().toLowerCase());
  }
  if (Array.isArray(p.variants)) {
    for (const v of p.variants) {
      if (v.sku && index.has(String(v.sku).trim().toLowerCase())) {
        return index.get(String(v.sku).trim().toLowerCase());
      }
    }
  }
  return undefined;
}

/**
 * Image resolution priority:
 * 1. product.image_url
 * 2. product.imageUrl
 * 3. matched override.image_url
 * 4. matched override.image_data_url
 * 5. fallback (undefined)
 */
export function resolveCatalogProductImage(
  productImg: { image_url?: string | null; imageUrl?: string | null },
  override?: { image_url?: string | null; image_data_url?: string | null },
): string | undefined {
  if (productImg.image_url && productImg.image_url.trim().length > 0) {
    return productImg.image_url.trim();
  }
  if (productImg.imageUrl && productImg.imageUrl.trim().length > 0) {
    return productImg.imageUrl.trim();
  }
  if (override?.image_url && override.image_url.trim().length > 0) {
    return override.image_url.trim();
  }
  if (override?.image_data_url && override.image_data_url.trim().length > 0) {
    return override.image_data_url.trim();
  }
  return undefined;
}

export interface RawCatalogProductInput {
  id: string | number;
  dbId?: string;
  product_code?: string | null;
  catalog_product_id?: string;
  name: string;
  description?: string | null;
  categoryId?: string;
  categoryName?: string | null;
  brandId?: string;
  brandName?: string;
  brandCode?: string;
  image_url?: string | null;
  imageUrl?: string | null;
  variants?: Array<{
    id?: string;
    channel?: string;
    type?: string;
    size?: string | null;
    size_label?: string | null;
    price?: number | string | null;
    sku?: string | null;
  }>;
}

/**
 * Builds a safe PublicProduct mirroring admin resolution rules:
 * - Names & description prefer override if present, else base product
 * - Image resolved via priority chain
 * - Retail variant gets retail price (override retail_price takes precedence)
 * - Salon/professional variant gets size label only; retailPrice is undefined, requiresContact = true
 * - Salon/wholesale/internal prices are NEVER present
 */
export function buildPublicProductData(
  rawProd: RawCatalogProductInput,
  override?: ProductOverrideSafe,
  knowledge?: {
    usageInstructions?: string;
    benefits?: string;
    skinConcerns?: string[];
    warnings?: string;
  },
): PublicProduct {
  const name = override?.name?.trim() || rawProd.name;
  const description = override?.desc?.trim() || rawProd.description || undefined;
  const resolvedImageUrl = resolveCatalogProductImage(rawProd, override);

  let retailSize: string | undefined;
  let retailPrice: number | undefined;
  let salonSize: string | undefined;

  const variants = rawProd.variants || [];

  for (const v of variants) {
    const isRetail = v.channel === "retail" || v.type === "retail";
    const isSalon = v.channel === "salon" || v.type === "salon";
    const rawSize = (v.size_label || v.size)?.trim();
    const rawPrice =
      typeof v.price === "number" ? v.price : Number(v.price) > 0 ? Number(v.price) : undefined;

    if (isRetail) {
      retailSize = override?.retail_size?.trim() || rawSize || retailSize;
      const finalPrice =
        override?.retail_price != null && override.retail_price > 0
          ? override.retail_price
          : rawPrice;
      if (finalPrice != null && finalPrice > 0) {
        retailPrice = finalPrice;
      }
    } else if (isSalon) {
      salonSize = override?.salon_size?.trim() || rawSize || salonSize;
    }
  }

  // If override added retail size/price and no retail variant existed
  if (!retailSize && override?.retail_size?.trim()) {
    retailSize = override.retail_size.trim();
  }
  if (retailPrice == null && override?.retail_price != null && override.retail_price > 0) {
    retailPrice = override.retail_price;
  }

  // If override added salon size and no salon variant existed
  if (!salonSize && override?.salon_size?.trim()) {
    salonSize = override.salon_size.trim();
  }

  const publicPriceItems: PublicPriceItem[] = [];
  const publicSizes: string[] = [];

  if (retailSize) {
    publicSizes.push(retailSize);
    publicPriceItems.push({
      sizeLabel: retailSize,
      retailPrice: retailPrice != null && retailPrice > 0 ? retailPrice : undefined,
      requiresContact: retailPrice == null || retailPrice <= 0,
    });
  }

  if (salonSize && salonSize !== retailSize) {
    publicSizes.push(salonSize);
    publicPriceItems.push({
      sizeLabel: salonSize,
      retailPrice: undefined, // Salon prices are NEVER mapped
      requiresContact: true, // Always contact-only
    });
  }

  // Any other variants not covered by retail/salon
  for (const v of variants) {
    const rawSize = (v.size_label || v.size)?.trim();
    if (!rawSize || rawSize === retailSize || rawSize === salonSize) continue;

    const isRetail = v.channel === "retail" || v.type === "retail";
    const rawPrice =
      typeof v.price === "number" ? v.price : Number(v.price) > 0 ? Number(v.price) : undefined;

    publicSizes.push(rawSize);
    if (isRetail && rawPrice && rawPrice > 0) {
      publicPriceItems.push({
        sizeLabel: rawSize,
        retailPrice: rawPrice,
        requiresContact: false,
      });
    } else {
      publicPriceItems.push({
        sizeLabel: rawSize,
        retailPrice: undefined,
        requiresContact: true,
      });
    }
  }

  return {
    id: rawProd.id,
    dbId: rawProd.dbId,
    name,
    brandName: rawProd.brandName || "Desembre",
    brandCode: rawProd.brandCode,
    brandId: rawProd.brandId,
    categoryName: rawProd.categoryName || "Mỹ phẩm",
    categoryId: rawProd.categoryId,
    description,
    imageUrl: resolvedImageUrl,
    retailPrice,
    retailSize,
    publicSizes,
    publicPriceItems,
    usageInstructions: knowledge?.usageInstructions,
    benefits: knowledge?.benefits,
    skinConcerns: knowledge?.skinConcerns,
    warnings: knowledge?.warnings,
  };
}

/**
 * Dev-only parity diagnostics.
 * Compares the first 10 products safely without exposing salon or internal prices.
 */
export function logCatalogParityDiagnostics(products: PublicProduct[]) {
  if (!import.meta.env.DEV) return;
  try {
    console.groupCollapsed("[CatalogParityDiagnostics] First 10 public mapped products");

    console.table(
      products.slice(0, 10).map((p) => ({
        id: p.id,
        name: p.name,
        hasImage: Boolean(p.imageUrl),
        category: p.categoryName,
        retailPrice: p.retailPrice ? `${p.retailPrice.toLocaleString("vi-VN")}đ` : "N/A",
        publicSizes: p.publicSizes.join(", "),
        priceItems: p.publicPriceItems
          .map(
            (it) =>
              `${it.sizeLabel}: ${
                it.requiresContact
                  ? "Liên hệ báo giá"
                  : `${it.retailPrice?.toLocaleString("vi-VN")}đ`
              }`,
          )
          .join(" | "),
      })),
    );

    console.groupEnd();
  } catch (err) {
    // Non-fatal dev helper
    void err;
  }
}
