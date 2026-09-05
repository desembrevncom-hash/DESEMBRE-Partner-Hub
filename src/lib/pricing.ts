export let VAT_RATE = 0.08;
export let DEFAULT_SALE_DISCOUNT = 0.4;

export const setPricingSettings = (vatRate: number, discountRate: number) => {
  VAT_RATE = vatRate;
  DEFAULT_SALE_DISCOUNT = discountRate;
};

export type UserRole = "admin" | "sub_admin" | "sale" | "tele_lead" | "telesale" | "guest";

type CalculatePriceInput = {
  basePrice: number;
  role: UserRole | "user"; // support legacy user literal mapping
  includeVat: boolean;
  vatRate?: number;
};

export function calculatePrice({
  basePrice,
  role,
  includeVat,
  vatRate = 0.08,
}: CalculatePriceInput) {
  const isFieldStaff = role === "sale" || role === "tele_lead" || role === "telesale";
  const discountRate = isFieldStaff ? 0.4 : 0;

  const priceAfterDiscount = Math.round(basePrice * (1 - discountRate));

  const finalPrice = includeVat
    ? Math.round(priceAfterDiscount * (1 + vatRate))
    : priceAfterDiscount;

  return {
    basePrice,
    discountRate,
    priceAfterDiscount,
    finalPrice,
  };
}

/**
 * Format number to Vietnamese Dong currency format
 */
export const formatCurrencyVND = (amount: number | null | undefined): string => {
  if (amount == null) return "";
  return new Intl.NumberFormat("vi-VN", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
};

/**
 * Calculate price including VAT
 */
export const calculateVatIncludedPrice = (price: number | null | undefined): number | null => {
  if (price == null) return null;
  return price * (1 + VAT_RATE);
};

/**
 * Calculate discounted price for Sales role
 */
export const calculateSalePrice = (price: number | null | undefined): number | null => {
  if (price == null) return null;
  return price * (1 - DEFAULT_SALE_DISCOUNT);
};

/**
 * Common logic to apply VAT and/or Discount based on modes
 */
export const getDisplayPrice = (
  price: number | null | undefined,
  vatMode: "with" | "without",
  role: UserRole | "user" = "user",
): number | null => {
  if (price == null) return null;

  let finalPrice = price;

  // Apply sale discount if role is field staff
  const isFieldStaff = role === "sale" || role === "tele_lead" || role === "telesale";
  if (isFieldStaff) {
    finalPrice = calculateSalePrice(finalPrice) || finalPrice;
  }

  // Apply VAT if requested
  if (vatMode === "with") {
    finalPrice = calculateVatIncludedPrice(finalPrice) || finalPrice;
  }

  return finalPrice;
};

// ---------------------------------------------------------------------------
// Public Catalog price helpers
// ---------------------------------------------------------------------------

/**
 * VAT mode for the public-facing product catalog.
 * "without_vat" — show base retail price.
 * "with_vat"    — show retail price + 8% VAT.
 * Prices are NEVER mutated in state; VAT is applied at render time only.
 */
export type CatalogVatMode = "without_vat" | "with_vat";

/** Re-export so catalog components can reference the same constant. */
export const CATALOG_VAT_RATE = VAT_RATE;

/**
 * Format a public catalog retail price string according to the active VAT mode.
 * Does NOT apply any discount. Base price is never mutated.
 *
 * @param price   Base retail price (pre-VAT)
 * @param vatMode "without_vat" | "with_vat"
 * @returns       Formatted VND string, e.g. "650.000đ" or "702.000đ"
 */
export function formatCatalogPrice(price: number, vatMode: CatalogVatMode): string {
  const display = vatMode === "with_vat" ? Math.round(price * (1 + VAT_RATE)) : Math.round(price);
  return formatCurrencyVND(display) + "đ";
}
