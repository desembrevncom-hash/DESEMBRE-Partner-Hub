import { OverrideRow } from "@/lib/saveOverride";

export const PRODUCT_DEFAULTS: Record<number, Partial<OverrideRow>> = {
  // CLEANSER
  1: { retail_size: "150ml", retail_price: 650000, salon_size: "1000ml", salon_price: 1650000 },
  2: { salon_size: "1000ml", salon_price: 1400000 },
  3: { name: "DESEMBRE REPAIR MOUSSE CLEANSER", retail_size: "150ml", retail_price: 850000 },
  4: { retail_size: "80g", retail_price: 700000 },
  5: { retail_size: "130ml", retail_price: 900000 },
  6: { retail_size: "200ml", retail_price: 850000 },
  7: { retail_size: "200ml", retail_price: 950000 },
  // TONER
  8: { retail_size: "150ml", retail_price: 750000, salon_size: "1000ml", salon_price: 1650000 },
  9: { retail_size: "150ml", retail_price: 750000, salon_size: "1000ml", salon_price: 1650000 },
  10: { retail_size: "100ml", retail_price: 550000 },
  // CREAM MASK
  11: { salon_size: "200g", salon_price: 950000 },
  12: { salon_size: "200g", salon_price: 950000 },
  13: { salon_size: "200g", salon_price: 950000 },
  // CREAM
  16: { retail_size: "30g", retail_price: 1200000, salon_size: "120g", salon_price: 1800000 },
  17: { retail_size: "50g", retail_price: 1200000, salon_size: "200g", salon_price: 1800000 },
  18: { retail_size: "50g", retail_price: 1200000, salon_size: "200g", salon_price: 1800000 },
  19: { name: "DESEMBRE REPAIR 24H CARE CREAM", retail_size: "50g", retail_price: 1200000, salon_size: "200g", salon_price: 1800000 },
  20: { retail_size: "50g", retail_price: 1200000, salon_size: "200g", salon_price: 1800000 },
  21: { salon_size: "120g", salon_price: 2400000 },
  22: { retail_size: "50g", retail_price: 1200000 },
  23: { retail_size: "30g", retail_price: 650000 },
  // SERUM
  24: { retail_size: "100ml", retail_price: 2150000 },
  25: { retail_size: "100ml", retail_price: 1450000 },
  26: { retail_size: "50ml", retail_price: 750000 },
  27: { retail_size: "100ml", retail_price: 1200000 },
  28: { retail_size: "100ml", retail_price: 1450000 },
  // CONCENTRATE
  29: { retail_size: "30ml", retail_price: 750000, salon_size: "100ml", salon_price: 1250000 },
  30: { retail_size: "30ml", retail_price: 750000, salon_size: "100ml", salon_price: 1250000 },
  31: { retail_size: "30ml", retail_price: 750000, salon_size: "100ml", salon_price: 1250000 },
  32: { retail_size: "30ml", retail_price: 750000, salon_size: "100ml", salon_price: 1250000 },
  // AMPOULE
  33: { salon_size: "7ml x 10ea", salon_price: 2500000 },
  34: { salon_size: "7ml x 10ea", salon_price: 2500000 },
  35: { salon_size: "7ml x 10ea", salon_price: 2500000 },
  36: { salon_size: "7ml x 10ea", salon_price: 2500000 },
  // AMPOULING
  37: { retail_size: "2ml x 12ea", retail_price: 1250000 },
  38: { retail_size: "2ml x 12ea", retail_price: 1250000 },
  39: { retail_size: "2ml x 12ea", retail_price: 1250000 },
  40: { retail_size: "2ml x 12ea", retail_price: 1250000 },
  41: { retail_size: "2ml x 12ea", retail_price: 1250000 },
  // ESSENCE
  42: { salon_size: "200ml", salon_price: 1400000 },
  43: { salon_size: "200ml", salon_price: 1400000 },
  44: { salon_size: "200ml", salon_price: 1400000 },
  45: { salon_size: "200ml", salon_price: 1400000 },
  // GEL
  46: { retail_size: "110ml", retail_price: 600000, salon_size: "500ml", salon_price: 1650000 },
  47: { retail_size: "110ml", retail_price: 450000, salon_size: "500ml", salon_price: 1350000 },
  // MASSAGE
  48: { salon_size: "1000g", salon_price: 1650000 },
  49: { salon_size: "1000g", salon_price: 1650000 },
  50: { salon_size: "250g", salon_price: 1550000 },
  // PROTECTION CARE
  14: { retail_size: "50ml", retail_price: 850000 },
  15: { retail_size: "70ml", retail_price: 850000 },
  // MASSAGE / BELLA CUP
  51: { salon_size: "2ea", salon_price: 450000 },
  // SHEET MASK
  52: { retail_size: "30mlx10pcs", retail_price: 850000 },
  53: { salon_size: "10ea", salon_price: 950000 },
  54: { retail_size: "25mlx10pcs", retail_price: 850000 },
  55: { salon_size: "50pcs", salon_price: 12000000 },
  // MODELING
  57: { retail_size: "500g", retail_price: 1250000, salon_size: "1000g", salon_price: 2400000 },
  58: { salon_size: "1000g", salon_price: 1500000 },
  59: { salon_size: "1000g", salon_price: 1500000 },
  60: { salon_size: "1000g", salon_price: 1500000 },
  61: { salon_size: "1000g", salon_price: 1500000 },
  62: { retail_size: "500g", retail_price: 1500000 },
  63: { retail_size: "500g", retail_price: 1500000 },
  // THERAPY
  64: { salon_size: "Set", salon_price: 9500000 },
  65: { salon_size: "Set", salon_price: 2300000 },
  66: { salon_size: "Set", salon_price: 3300000 },
  67: { salon_size: "Set", salon_price: 2000000 },
  68: { retail_size: "5ml x 6ea", retail_price: 1750000 },
};
