import { describe, expect, it } from "vitest";
import {
  normalizeProductCodeToNo,
  buildOverrideMapByNo,
  resolveCatalogProductImage,
  mapDbProductToPublic,
  mapStaticProductToPublic,
  type ProductOverrideSafe,
} from "../src/features/catalog/catalogParityUtils";
import type { PublicCatalogProductDb } from "../src/lib/publicCatalogDb";
import { CATEGORIES, PRODUCTS } from "../src/data/products";
import { formatCatalogPrice } from "../src/lib/pricing";

describe("Catalog Parity Utils", () => {
  describe("normalizeProductCodeToNo", () => {
    it("product_code '1' matches override.no 1", () => {
      expect(normalizeProductCodeToNo("1")).toBe("1");
      expect(normalizeProductCodeToNo(1)).toBe("1");
    });

    it("product_code with leading zeros or whitespace normalizes to integer string", () => {
      expect(normalizeProductCodeToNo("01")).toBe("1");
      expect(normalizeProductCodeToNo(" 01 ")).toBe("1");
      expect(normalizeProductCodeToNo("001")).toBe("1");
      expect(normalizeProductCodeToNo("002")).toBe("2");
    });

    it("product_code with prefix extracts numeric ID string", () => {
      expect(normalizeProductCodeToNo("P-1")).toBe("1");
      expect(normalizeProductCodeToNo("DES-04")).toBe("4");
    });

    it("invalid code returns null", () => {
      expect(normalizeProductCodeToNo(null)).toBeNull();
      expect(normalizeProductCodeToNo("")).toBeNull();
      expect(normalizeProductCodeToNo("abc")).toBeNull();
    });
  });

  describe("buildOverrideMapByNo & Matching", () => {
    const rawOverrides: ProductOverrideSafe[] = [
      {
        no: 1,
        name: "DESEMBRE MILK ESSENTIAL CLEANSER",
        image_url: "https://example.com/p1.jpg",
        retail_size: "150ml",
        retail_price: 650000,
        salon_size: "1000ml",
      },
      {
        no: 2,
        image_url: "https://example.com/p2.jpg",
        salon_size: "1000ml",
      },
    ];

    const overrideByNo = buildOverrideMapByNo(rawOverrides);

    it("builds map indexed by numeric no", () => {
      expect(overrideByNo.has(1)).toBe(true);
      expect(overrideByNo.has(2)).toBe(true);
      expect(overrideByNo.get(1)?.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
    });

    it("product_code numeric string resolves image from override", () => {
      const prodCode = "1";
      const no = normalizeProductCodeToNo(prodCode)!;
      const matched = overrideByNo.get(no);
      const img = resolveCatalogProductImage({ image_url: null }, matched);
      expect(img).toBe("https://example.com/p1.jpg");
    });
  });

  describe("Image Resolution Priority Chain", () => {
    it("product image_url beats override image", () => {
      const img = resolveCatalogProductImage(
        { image_url: "https://example.com/from_product.jpg" },
        { image_url: "https://example.com/from_override.jpg", image_data_url: "data:..." },
      );
      expect(img).toBe("https://example.com/from_product.jpg");
    });

    it("product imageUrl beats override image when image_url is missing", () => {
      const img = resolveCatalogProductImage(
        { imageUrl: "https://example.com/from_product_legacy.jpg" },
        { image_url: "https://example.com/from_override.jpg" },
      );
      expect(img).toBe("https://example.com/from_product_legacy.jpg");
    });

    it("override image_url used when product has no image", () => {
      const img = resolveCatalogProductImage(
        {},
        { image_url: "https://example.com/from_override.jpg" },
      );
      expect(img).toBe("https://example.com/from_override.jpg");
    });

    it("override image_data_url used when override image_url is missing", () => {
      const img = resolveCatalogProductImage(
        {},
        { image_data_url: "data:image/jpeg;base64,sample" },
      );
      expect(img).toBe("data:image/jpeg;base64,sample");
    });

    it("returns undefined fallback when neither has an image", () => {
      const img = resolveCatalogProductImage({}, {});
      expect(img).toBeUndefined();
    });
  });

  describe("Size & Price Parity: mapDbProductToPublic", () => {
    const rawOverrides: ProductOverrideSafe[] = [
      {
        no: 1,
        image_url: "https://example.com/p1.jpg",
        retail_size: "150ml",
        retail_price: 650000,
        salon_size: "1000ml",
      },
      {
        no: 2,
        image_url: "https://example.com/p2.jpg",
      },
    ];
    const overrideByNo = buildOverrideMapByNo(rawOverrides);

    it("Product 1 (150ml retail + 1000ml salon) maps correctly", () => {
      const dbProd: PublicCatalogProductDb = {
        id: "db-1",
        brand_id: "b1",
        product_code: "1",
        name: "DESEMBRE MILK ESSENTIAL CLEANSER",
        status: "active",
        retailVariants: [
          {
            id: "v1",
            product_id: "db-1",
            channel: "retail",
            size_label: "150ml",
            price: 650000,
            is_active: true,
          },
        ],
        salonVariants: [
          { id: "v2", product_id: "db-1", channel: "salon", size_label: "1000ml", is_active: true },
        ],
      };

      const { product } = mapDbProductToPublic(dbProd, overrideByNo);

      expect(product.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
      expect(product.imageUrl).toBe("https://example.com/p1.jpg");
      expect(product.publicSizes).toEqual(["150ml", "1000ml"]);
      expect(product.publicPriceItems).toHaveLength(2);

      // Retail variant price displayed
      const retail = product.publicPriceItems.find((i) => i.sizeLabel === "150ml");
      expect(retail).toBeDefined();
      expect(retail?.retailPrice).toBe(650000);
      expect(retail?.requiresContact).toBe(false);

      // Salon variant size displayed as contact-only
      const salon = product.publicPriceItems.find((i) => i.sizeLabel === "1000ml");
      expect(salon).toBeDefined();
      expect(salon?.retailPrice).toBeUndefined();
      expect(salon?.requiresContact).toBe(true);

      // Security: salon price is never present
      const serialized = JSON.stringify(product);
      expect(serialized).not.toContain("salon_price");
      expect(serialized).not.toContain("wholesale_price");
    });

    it("Product 2 (only salon variant 1000ml) displays contact-only without retail price", () => {
      const dbProd: PublicCatalogProductDb = {
        id: "db-2",
        brand_id: "b1",
        product_code: "2",
        name: "DESEMBRE DERMA SCIENCE WATER CLEANSER",
        status: "active",
        retailVariants: [],
        salonVariants: [
          { id: "v3", product_id: "db-2", channel: "salon", size_label: "1000ml", is_active: true },
        ],
      };

      const { product } = mapDbProductToPublic(dbProd, overrideByNo);

      expect(product.name).toBe("DESEMBRE DERMA SCIENCE WATER CLEANSER");
      expect(product.imageUrl).toBe("https://example.com/p2.jpg");
      expect(product.retailPrice).toBeUndefined();
      expect(product.publicPriceItems[0]).toEqual({
        sizeLabel: "1000ml",
        channel: "salon",
        price: undefined,
        retailPrice: undefined,
        requiresContact: true,
      });
    });
  });

  describe("Static fallback mapping (mapStaticProductToPublic)", () => {
    const rawOverrides: ProductOverrideSafe[] = [
      {
        no: 1,
        image_url: "https://example.com/p1_override.jpg",
        retail_size: "150ml",
        retail_price: 650000,
        salon_size: "1000ml",
      },
    ];
    const overrideByNo = buildOverrideMapByNo(rawOverrides);

    it("static fallback maps Product 1 correctly with override image and price items", () => {
      const staticP1 = PRODUCTS.find((p) => p.id === 1)!;
      expect(staticP1).toBeDefined();

      const { product } = mapStaticProductToPublic(staticP1, overrideByNo, CATEGORIES);

      expect(product.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
      expect(product.imageUrl).toBe("https://example.com/p1_override.jpg");
      expect(product.publicSizes).toEqual(["150ml", "1000ml"]);
      expect(product.publicPriceItems[0]).toEqual({
        sizeLabel: "150ml",
        channel: "retail",
        price: 650000,
        retailPrice: 650000,
        requiresContact: false,
      });
      // In public full-price catalog, salon variant price (1650000) is visible to all
      expect(product.publicPriceItems[1]).toEqual({
        sizeLabel: "1000ml",
        channel: "salon",
        price: 1650000,
        retailPrice: 1650000,
        requiresContact: false,
      });
    });

    it("static fallback maps Product 3 (Repair Mousse) and Product 4 (Enzyme Powder)", () => {
      const staticP3 = PRODUCTS.find((p) => p.id === 3)!;
      const { product: p3 } = mapStaticProductToPublic(staticP3, overrideByNo, CATEGORIES);
      expect(p3.retailPrice).toBe(850000);
      expect(p3.publicPriceItems[0]).toEqual({
        sizeLabel: "150ml",
        channel: "retail",
        price: 850000,
        retailPrice: 850000,
        requiresContact: false,
      });

      const staticP4 = PRODUCTS.find((p) => p.id === 4)!;
      const { product: p4 } = mapStaticProductToPublic(staticP4, overrideByNo, CATEGORIES);
      expect(p4.retailPrice).toBe(700000);
      expect(p4.publicPriceItems[0]).toEqual({
        sizeLabel: "80g",
        channel: "retail",
        price: 700000,
        retailPrice: 700000,
        requiresContact: false,
      });
    });

    it("maps fallbackImageUrl when override has image_data_url", () => {
      const overridesWithDataUrl: ProductOverrideSafe[] = [
        {
          no: 1,
          image_url: "https://example.com/p1_broken.jpg",
          image_data_url: "data:image/jpeg;base64,backupData",
        },
      ];
      const map = buildOverrideMapByNo(overridesWithDataUrl);
      const staticP1 = PRODUCTS.find((p) => p.id === 1)!;
      const { product, diag } = mapStaticProductToPublic(staticP1, map, CATEGORIES);

      expect(product.imageUrl).toBe("https://example.com/p1_broken.jpg");
      expect(product.fallbackImageUrl).toBe("data:image/jpeg;base64,backupData");
      expect(diag.overrideFound).toBe(true);
      expect(diag["image_data_url exists?"]).toBe(true);
      expect(diag.imageLoadStatus).toBe("resolved");
    });
  });

  describe("Image Failure Fallback Recovery Logic", () => {
    function resolveWithFailureSimulation(
      primaryUrl: string | undefined,
      fallbackUrl: string | undefined,
      primaryFails: boolean,
      fallbackFails: boolean = false,
    ): string | undefined {
      if (!primaryUrl) return fallbackUrl;
      if (!primaryFails) return primaryUrl;
      // Primary failed (403/404) -> attempt fallback
      if (fallbackUrl && !fallbackFails) return fallbackUrl;
      // Both failed -> placeholder (undefined)
      return undefined;
    }

    it("falls back to image_data_url when primary image_url fails (403/404)", () => {
      const primaryUrl = "https://example.com/broken-image.jpg";
      const fallbackUrl = "data:image/jpeg;base64,validBackup";

      const resolved = resolveWithFailureSimulation(primaryUrl, fallbackUrl, true, false);
      expect(resolved).toBe("data:image/jpeg;base64,validBackup");
    });

    it("shows placeholder when both primary image_url and fallback fail", () => {
      const primaryUrl = "https://example.com/broken-image.jpg";
      const fallbackUrl = "https://example.com/broken-backup.jpg";

      const resolved = resolveWithFailureSimulation(primaryUrl, fallbackUrl, true, true);
      expect(resolved).toBeUndefined();
    });

    it("shows placeholder when primary image_url fails and no fallback exists", () => {
      const primaryUrl = "https://example.com/broken-image.jpg";
      const fallbackUrl = undefined;

      const resolved = resolveWithFailureSimulation(primaryUrl, fallbackUrl, true);
      expect(resolved).toBeUndefined();
    });
  });

  describe("VAT calculation immutability", () => {
    it("VAT toggle calculation does not mutate base price in state", () => {
      const base = 650000;
      const withoutVat = formatCatalogPrice(base, "without_vat");
      const withVat = formatCatalogPrice(base, "with_vat");

      expect(withoutVat).toBe("650.000đ");
      expect(withVat).toBe("702.000đ");
      expect(base).toBe(650000);
    });
  });

  describe("Public Full-Price Catalog: Guest & Authenticated Visibility", () => {
    const rawOverrides: ProductOverrideSafe[] = [
      {
        no: 1,
        image_url: "https://example.com/p1.jpg",
        retail_size: "150ml",
        retail_price: 650000,
        salon_size: "1000ml",
        salon_price: 1650000,
      },
    ];
    const overrideByNo = buildOverrideMapByNo(rawOverrides);

    const dbProd1: PublicCatalogProductDb = {
      id: "db-1",
      brand_id: "b1",
      product_code: "1",
      name: "DESEMBRE MILK ESSENTIAL CLEANSER",
      status: "active",
      retailVariants: [
        {
          id: "v1",
          product_id: "db-1",
          channel: "retail",
          size_label: "150ml",
          price: 650000,
          is_active: true,
        },
      ],
      salonVariants: [
        {
          id: "v2",
          product_id: "db-1",
          channel: "salon",
          size_label: "1000ml",
          price: 1650000,
          is_active: true,
        },
      ],
    };

    it("Guest and public users can see both retail and salon prices", () => {
      const { product } = mapDbProductToPublic(dbProd1, overrideByNo);

      expect(product.publicPriceItems).toHaveLength(2);

      const retailItem = product.publicPriceItems.find((i) => i.channel === "retail");
      expect(retailItem).toBeDefined();
      expect(retailItem?.sizeLabel).toBe("150ml");
      expect(retailItem?.price).toBe(650000);
      expect(retailItem?.requiresContact).toBe(false);

      const salonItem = product.publicPriceItems.find((i) => i.channel === "salon");
      expect(salonItem).toBeDefined();
      expect(salonItem?.sizeLabel).toBe("1000ml");
      expect(salonItem?.channel).toBe("salon");
      expect(salonItem?.price).toBe(1650000);
      expect(salonItem?.requiresContact).toBe(false);
    });

    it("Milk Essential Cleanser displays both 150ml (650.000đ) and 1000ml (1.650.000đ)", () => {
      const staticP1 = PRODUCTS.find((p) => p.id === 1)!;
      const { product } = mapStaticProductToPublic(staticP1, overrideByNo, CATEGORIES);

      const retail = product.publicPriceItems.find((i) => i.sizeLabel === "150ml");
      expect(retail?.price).toBe(650000);
      expect(retail?.requiresContact).toBe(false);

      const salon = product.publicPriceItems.find((i) => i.sizeLabel === "1000ml");
      expect(salon?.price).toBe(1650000);
      expect(salon?.requiresContact).toBe(false);
    });

    it("Product 2 (Derma Science Water Cleanser) shows salon 1000ml (1.400.000đ)", () => {
      const staticP2 = PRODUCTS.find((p) => p.id === 2)!;
      const { product } = mapStaticProductToPublic(staticP2, overrideByNo, CATEGORIES);

      const salon = product.publicPriceItems.find((i) => i.sizeLabel === "1000ml");
      expect(salon?.channel).toBe("salon");
      expect(salon?.price).toBe(1400000);
      expect(salon?.requiresContact).toBe(false);
    });

    it("'Liên hệ báo giá' appears only when price is missing", () => {
      const dbProdNoPrice: PublicCatalogProductDb = {
        id: "db-no-price",
        brand_id: "b1",
        product_code: "999",
        name: "PRODUCT WITHOUT PRICE",
        status: "active",
        retailVariants: [
          {
            id: "v-no-price",
            product_id: "db-no-price",
            channel: "salon",
            size_label: "500ml",
            is_active: true,
          },
        ],
        salonVariants: [],
      };

      const { product } = mapDbProductToPublic(dbProdNoPrice, overrideByNo);
      expect(product.publicPriceItems[0]).toEqual({
        sizeLabel: "500ml",
        channel: "retail",
        price: undefined,
        retailPrice: undefined,
        requiresContact: true,
      });
    });

    it("VAT toggle formats both retail and salon visible prices correctly", () => {
      const retailBase = 650000;
      const salonBase = 1650000;

      // Retail formatted with / without VAT
      expect(formatCatalogPrice(retailBase, "without_vat")).toBe("650.000đ");
      expect(formatCatalogPrice(retailBase, "with_vat")).toBe("702.000đ");

      // Salon formatted with / without VAT
      expect(formatCatalogPrice(salonBase, "without_vat")).toBe("1.650.000đ");
      expect(formatCatalogPrice(salonBase, "with_vat")).toBe("1.782.000đ");

      // Verify 8% VAT calculation: 1650000 * 1.08 = 1782000
      expect(Math.round(salonBase * 1.08)).toBe(1782000);
    });

    it("Security boundary: public mapped JSON does not contain cost, margin, wholesale_price, internal_note, supplier_note, admin_note", () => {
      const { product } = mapDbProductToPublic(dbProd1, overrideByNo);
      const json = JSON.stringify(product);

      expect(json).not.toContain("cost");
      expect(json).not.toContain("margin");
      expect(json).not.toContain("wholesale_price");
      expect(json).not.toContain("internal_note");
      expect(json).not.toContain("supplier_note");
      expect(json).not.toContain("admin_note");
      expect(json).not.toContain("link_url");
      expect(json).not.toContain("is_custom");
    });
  });
});
