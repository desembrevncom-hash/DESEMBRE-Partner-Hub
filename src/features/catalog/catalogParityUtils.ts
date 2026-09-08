import type { PublicProduct, PublicPriceItem } from "./types";
import type { PublicCatalogProductDb } from "@/lib/publicCatalogDb";
import type { Product, Category } from "@/types/product";

export interface ProductOverrideSafe {
  no?: number | null;
  name?: string | null;
  desc?: string | null;
  image_url?: string | null;
  image_data_url?: string | null;
  retail_size?: string | null;
  retail_price?: number | null;
  salon_size?: string | null;
}

/**
 * Normalizes product code or product id into a positive numeric string index matching override.no.
 * Handles "01" -> "1", "001" -> "1", "1" -> "1", numeric 1 -> "1", "P-01" -> "1", etc.
 */
export function normalizeProductCodeToNo(code: string | number | null | undefined): string | null {
  if (code == null) return null;
  if (typeof code === "number") {
    return Number.isFinite(code) && code > 0 ? String(Math.floor(code)) : null;
  }
  const str = String(code).trim();
  if (!str) return null;

  // Direct integer parse
  const direct = parseInt(str, 10);
  if (
    !Number.isNaN(direct) &&
    direct > 0 &&
    (String(direct) === str || String(direct) === str.replace(/^0+/, ""))
  ) {
    return String(direct);
  }

  // Extract first digit group: e.g. "P-01" -> "1"
  const match = str.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return !Number.isNaN(num) && num > 0 ? String(num) : null;
  }

  return null;
}

/**
 * Builds an index of overrides keyed by numeric no (both string and number for fast, safe lookup).
 */
export function buildOverrideMapByNo(
  overrides: ProductOverrideSafe[],
): Map<string | number, ProductOverrideSafe> {
  const map = new Map<string | number, ProductOverrideSafe>();
  for (const row of overrides) {
    if (row.no != null) {
      const num = typeof row.no === "number" ? row.no : parseInt(String(row.no), 10);
      if (!Number.isNaN(num) && num > 0) {
        map.set(num, row);
        map.set(String(num), row);
      }
    }
  }
  return map;
}

/**
 * Image resolution priority matching Admin:
 * 1. product.image_url (or product.imageUrl)
 * 2. override.image_url
 * 3. override.image_data_url
 * 4. fallback icon (undefined)
 */
export function resolveCatalogProductImage(
  productImg?: { image_url?: string | null; imageUrl?: string | null } | null,
  override?: { image_url?: string | null; image_data_url?: string | null } | null,
): string | undefined {
  if (productImg?.image_url && productImg.image_url.trim().length > 0) {
    return productImg.image_url.trim();
  }
  if (productImg?.imageUrl && productImg.imageUrl.trim().length > 0) {
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

/**
 * Maps a public DB product (PublicCatalogProductDb) into a PublicProduct.
 */
export function mapDbProductToPublic(
  dbProd: PublicCatalogProductDb,
  overrideByNo: Map<string | number, ProductOverrideSafe>,
  knowledgeOrCanView?:
    | {
        usageInstructions?: string;
        benefits?: string;
        skinConcerns?: string[];
        warnings?: string;
        ingredientHighlights?: string[];
        skinTypes?: string[];
      }
    | boolean,
  canViewPartnerPricesArg: boolean = true,
): {
  product: PublicProduct;
  diag: DiagItem;
} {
  const knowledge =
    typeof knowledgeOrCanView === "object" && knowledgeOrCanView !== null
      ? knowledgeOrCanView
      : undefined;
  const canViewPartnerPrices =
    typeof knowledgeOrCanView === "boolean" ? knowledgeOrCanView : canViewPartnerPricesArg;

  const normNo =
    normalizeProductCodeToNo(dbProd.product_code) ?? normalizeProductCodeToNo(dbProd.id);
  const matchedOverride = normNo != null ? overrideByNo.get(normNo) : undefined;

  const name = matchedOverride?.name?.trim() || dbProd.name;
  const description = matchedOverride?.desc?.trim() || dbProd.description || undefined;
  const finalImageUrl = resolveCatalogProductImage(dbProd, matchedOverride);
  const fallbackImageUrl =
    matchedOverride?.image_data_url && matchedOverride.image_data_url.trim().length > 0
      ? matchedOverride.image_data_url.trim()
      : undefined;

  const primaryRetail = dbProd.retailVariants[0];
  const primarySalon = dbProd.salonVariants[0];

  const retailSize =
    matchedOverride?.retail_size?.trim() || primaryRetail?.size_label?.trim() || undefined;
  const retailPrice =
    matchedOverride?.retail_price != null && matchedOverride.retail_price > 0
      ? matchedOverride.retail_price
      : primaryRetail?.price != null && primaryRetail.price > 0
        ? primaryRetail.price
        : undefined;

  const salonSize =
    matchedOverride?.salon_size?.trim() || primarySalon?.size_label?.trim() || undefined;

  const salonPrice = canViewPartnerPrices
    ? matchedOverride?.salon_price != null && matchedOverride.salon_price > 0
      ? matchedOverride.salon_price
      : primarySalon?.price != null && primarySalon.price > 0
        ? primarySalon.price
        : undefined
    : undefined;

  const publicPriceItems: PublicPriceItem[] = [];
  const publicSizes: string[] = [];

  if (retailSize) {
    publicSizes.push(retailSize);
    publicPriceItems.push({
      sizeLabel: retailSize,
      channel: "retail",
      price: retailPrice,
      retailPrice,
      requiresContact: retailPrice == null || retailPrice <= 0,
    });
  }

  // Additional retail variants
  for (let i = 1; i < dbProd.retailVariants.length; i++) {
    const v = dbProd.retailVariants[i];
    const s = v.size_label?.trim();
    if (s && s !== retailSize && s !== salonSize) {
      publicSizes.push(s);
      const p = v.price != null && v.price > 0 ? v.price : undefined;
      publicPriceItems.push({
        sizeLabel: s,
        channel: "retail",
        price: p,
        retailPrice: p,
        requiresContact: p == null || p <= 0,
      });
    }
  }

  if (salonSize && salonSize !== retailSize) {
    publicSizes.push(salonSize);
    publicPriceItems.push({
      sizeLabel: salonSize,
      channel: "salon",
      price: salonPrice,
      retailPrice: salonPrice,
      requiresContact: salonPrice == null || salonPrice <= 0,
    });
  }

  // Additional salon variants
  for (let i = 1; i < dbProd.salonVariants.length; i++) {
    const v = dbProd.salonVariants[i];
    const s = v.size_label?.trim();
    if (s && !publicSizes.includes(s)) {
      publicSizes.push(s);
      const p = canViewPartnerPrices && v.price != null && v.price > 0 ? v.price : undefined;
      publicPriceItems.push({
        sizeLabel: s,
        channel: "salon",
        price: p,
        retailPrice: p,
        requiresContact: p == null || p <= 0,
      });
    }
  }

  const product: PublicProduct = {
    id: dbProd.id,
    dbId: dbProd.id,
    product_code: dbProd.product_code || undefined,
    sort_order: dbProd.sort_order ?? 0,
    name,
    brandName: dbProd.brand_name || "Desembre",
    brandCode: dbProd.brand_code,
    brandId: dbProd.brand_id,
    categoryName: dbProd.category_name || "Mỹ phẩm",
    categoryId: dbProd.category_slug || undefined,
    description,
    imageUrl: finalImageUrl,
    fallbackImageUrl,
    imageAlt: name,
    retailPrice,
    retailSize,
    publicSizes,
    publicPriceItems,
    usageInstructions: knowledge?.usageInstructions,
    benefits: knowledge?.benefits,
    skinConcerns: knowledge?.skinConcerns,
    warnings: knowledge?.warnings,
    ingredientHighlights: knowledge?.ingredientHighlights,
    skinTypes: knowledge?.skinTypes,
  };

  const diag: DiagItem = {
    product_code: dbProd.product_code ?? dbProd.id,
    normalizedNo: normNo,
    overrideFound: Boolean(matchedOverride),
    image_url: matchedOverride?.image_url ?? dbProd.image_url ?? null,
    "image_data_url exists?": Boolean(matchedOverride?.image_data_url?.trim()),
    finalImageUrl,
    imageLoadStatus: finalImageUrl ? "resolved" : "placeholder",
    publicPriceItems,
  };

  return { product, diag };
}

/**
 * Maps a static Product fallback into a PublicProduct.
 */
export function mapStaticProductToPublic(
  prod: Product,
  overrideByNo: Map<string | number, ProductOverrideSafe>,
  categories: Category[],
  knowledgeOrCanView?:
    | {
        usageInstructions?: string;
        benefits?: string;
        skinConcerns?: string[];
        warnings?: string;
      }
    | boolean,
  canViewPartnerPricesArg: boolean = true,
): {
  product: PublicProduct;
  diag: DiagItem;
} {
  const knowledge =
    typeof knowledgeOrCanView === "object" && knowledgeOrCanView !== null
      ? knowledgeOrCanView
      : undefined;
  const canViewPartnerPrices =
    typeof knowledgeOrCanView === "boolean" ? knowledgeOrCanView : canViewPartnerPricesArg;

  const normNo = normalizeProductCodeToNo(prod.id);
  const matchedOverride = normNo != null ? overrideByNo.get(normNo) : undefined;

  const name = matchedOverride?.name?.trim() || prod.name;
  const description = matchedOverride?.desc?.trim() || prod.description || undefined;
  const finalImageUrl = resolveCatalogProductImage({ imageUrl: prod.imageUrl }, matchedOverride);
  const fallbackImageUrl =
    matchedOverride?.image_data_url && matchedOverride.image_data_url.trim().length > 0
      ? matchedOverride.image_data_url.trim()
      : undefined;

  const cat = categories.find((c) => c.id === prod.categoryId);
  const categoryName = cat?.nameVi || cat?.name || prod.categoryId;

  const retailVar = prod.variants.find((v) => v.type === "retail");
  const salonVar = prod.variants.find((v) => v.type === "salon");

  const retailSize = matchedOverride?.retail_size?.trim() || retailVar?.size?.trim() || undefined;
  const retailPrice =
    matchedOverride?.retail_price != null && matchedOverride.retail_price > 0
      ? matchedOverride.retail_price
      : retailVar?.price != null && retailVar.price > 0
        ? retailVar.price
        : undefined;

  const salonSize = matchedOverride?.salon_size?.trim() || salonVar?.size?.trim() || undefined;
  const salonPrice = canViewPartnerPrices
    ? matchedOverride?.salon_price != null && matchedOverride.salon_price > 0
      ? matchedOverride.salon_price
      : salonVar?.price != null && salonVar.price > 0
        ? salonVar.price
        : undefined
    : undefined;

  const publicPriceItems: PublicPriceItem[] = [];
  const publicSizes: string[] = [];

  if (retailSize) {
    publicSizes.push(retailSize);
    publicPriceItems.push({
      sizeLabel: retailSize,
      channel: "retail",
      price: retailPrice,
      retailPrice,
      requiresContact: retailPrice == null || retailPrice <= 0,
    });
  }

  if (salonSize && salonSize !== retailSize) {
    publicSizes.push(salonSize);
    publicPriceItems.push({
      sizeLabel: salonSize,
      channel: "salon",
      price: salonPrice,
      retailPrice: salonPrice,
      requiresContact: salonPrice == null || salonPrice <= 0,
    });
  }

  const product: PublicProduct = {
    id: prod.id,
    product_code: String(prod.id),
    sort_order: prod.sort_order ?? 0,
    name,
    brandName: "Desembre",
    categoryName,
    categoryId: prod.categoryId,
    description,
    imageUrl: finalImageUrl,
    fallbackImageUrl,
    imageAlt: name,
    retailPrice,
    retailSize,
    publicSizes,
    publicPriceItems,
    usageInstructions: knowledge?.usageInstructions,
    benefits: knowledge?.benefits,
    skinConcerns: knowledge?.skinConcerns,
    warnings: knowledge?.warnings,
    ingredientHighlights: knowledge?.ingredientHighlights,
    skinTypes: knowledge?.skinTypes,
  };

  const diag: DiagItem = {
    product_code: prod.id,
    normalizedNo: normNo,
    overrideFound: Boolean(matchedOverride),
    image_url: matchedOverride?.image_url ?? null,
    "image_data_url exists?": Boolean(matchedOverride?.image_data_url?.trim()),
    finalImageUrl,
    imageLoadStatus: finalImageUrl ? "resolved" : "placeholder",
    publicPriceItems,
  };

  return { product, diag };
}

/**
 * Ensures the resolved final image URL is assigned to the actual UI field:
 * imageUrl: resolvedImageUrl
 * fallbackImageUrl: fallbackImageUrl
 * imageAlt: imageAlt
 */
export function buildPublicProductData(
  product: {
    id: string | number;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    image_url?: string | null;
    brandName?: string;
    categoryName?: string;
    categoryId?: string;
    retailPrice?: number;
    retailSize?: string;
    publicSizes?: string[];
    publicPriceItems?: PublicPriceItem[];
  },
  override?: ProductOverrideSafe,
  knowledge?: {
    usageInstructions?: string;
    benefits?: string;
    skinConcerns?: string[];
    warnings?: string;
    ingredientHighlights?: string[];
    skinTypes?: string[];
  },
  canViewPartnerPrices: boolean = true,
): PublicProduct {
  const resolvedImageUrl = resolveCatalogProductImage(
    { image_url: product.image_url, imageUrl: product.imageUrl },
    override,
  );
  const fallbackImageUrl =
    override?.image_data_url && override.image_data_url.trim().length > 0
      ? override.image_data_url.trim()
      : undefined;

  const publicPriceItems: PublicPriceItem[] = (product.publicPriceItems || []).map((it) => {
    if (it.channel === "salon") {
      const salonPrice = canViewPartnerPrices ? (override?.salon_price ?? it.price) : undefined;
      return {
        ...it,
        price: salonPrice,
        retailPrice: salonPrice,
        requiresContact: salonPrice == null || salonPrice <= 0,
      };
    }
    return it;
  });

  return {
    id: product.id,
    name: override?.name?.trim() || product.name,
    brandName: product.brandName || "Desembre",
    categoryName: product.categoryName || "Mỹ phẩm",
    categoryId: product.categoryId,
    description: override?.desc?.trim() || product.description || undefined,
    imageUrl: resolvedImageUrl,
    fallbackImageUrl,
    imageAlt: override?.name?.trim() || product.name,
    retailPrice: override?.retail_price ?? product.retailPrice,
    retailSize: override?.retail_size ?? product.retailSize,
    publicSizes: product.publicSizes || [],
    publicPriceItems,
    usageInstructions: knowledge?.usageInstructions,
    benefits: knowledge?.benefits,
    skinConcerns: knowledge?.skinConcerns,
    warnings: knowledge?.warnings,
    ingredientHighlights: knowledge?.ingredientHighlights,
    skinTypes: knowledge?.skinTypes,
  };
}

export interface DiagItem {
  product_code: string | number | null | undefined;
  normalizedNo: string | number | null;
  overrideFound: boolean;
  image_url: string | null | undefined;
  "image_data_url exists?": boolean;
  finalImageUrl: string | undefined;
  imageLoadStatus: string;
  publicPriceItems: PublicPriceItem[];
}

/**
 * Dev-only parity diagnostics console.table.
 */
export function logCatalogParityDiagnostics(diagItems: DiagItem[]) {
  if (!import.meta.env.DEV) return;
  try {
    console.groupCollapsed("[CatalogParityDiagnostics] First 10 public mapped products");

    console.table(
      diagItems.slice(0, 10).map((row) => ({
        product_code: row.product_code ?? "N/A",
        normalizedNo: row.normalizedNo ?? "none",
        overrideFound: row.overrideFound,
        image_url: row.image_url ?? "none",
        "image_data_url exists?": row["image_data_url exists?"],
        finalImageUrl: row.finalImageUrl ?? "none",
        imageLoadStatus: row.imageLoadStatus,
      })),
    );

    console.groupEnd();
  } catch {
    // Non-fatal
  }
}
