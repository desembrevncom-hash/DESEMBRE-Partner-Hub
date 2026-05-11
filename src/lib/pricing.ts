export const VAT_RATE = 0.08;
export const DEFAULT_SALE_DISCOUNT = 0.4;

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
  role: "admin" | "sale" | "user" = "user"
): number | null => {
  if (price == null) return null;
  
  let finalPrice = price;
  
  // Apply sale discount if role is sale (and not admin)
  if (role === "sale") {
    finalPrice = calculateSalePrice(finalPrice) || finalPrice;
  }
  
  // Apply VAT if requested
  if (vatMode === "with") {
    finalPrice = calculateVatIncludedPrice(finalPrice) || finalPrice;
  }
  
  return finalPrice;
};
