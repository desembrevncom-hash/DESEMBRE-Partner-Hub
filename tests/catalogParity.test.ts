import { describe, expect, it } from "vitest";
import {
  buildOverrideIndex,
  findMatchingOverride,
  resolveCatalogProductImage,
  buildPublicProductData,
  type ProductOverrideSafe,
  type RawCatalogProductInput,
} from "../src/features/catalog/catalogParityUtils";
import { formatCatalogPrice, VAT_RATE } from "../src/lib/pricing";

describe("Catalog Parity Utils", () => {
  describe("Multi-key Override Matching", () => {
    const overrides: ProductOverrideSafe[] = [
      {
        no: 1,
        product_no: "P-001",
        product_id: "uuid-001",
        catalog_product_id: "cat-001",
        sku: "DES-001",
        name: "DESEMBRE MILK ESSENTIAL CLEANSER",
        image_url: "https://example.com/p1.jpg",
        retail_size: "150ml",
        retail_price: 650000,
        salon_size: "1000ml",
      },
      {
        no: 2,
        sku: "DES-WATER-1000",
        image_url: "https://example.com/p2.jpg",
        salon_size: "1000ml",
      },
    ];

    const index = buildOverrideIndex(overrides);

    it("matches by product_code", () => {
      const match = findMatchingOverride({ product_code: "1" }, index);
      expect(match).toBeDefined();
      expect(match?.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
    });

    it("matches by numeric id", () => {
      const match = findMatchingOverride({ id: 1 }, index);
      expect(match).toBeDefined();
      expect(match?.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
    });

    it("matches by product_id / dbId UUID", () => {
      const match = findMatchingOverride({ dbId: "uuid-001" }, index);
      expect(match).toBeDefined();
      expect(match?.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
    });

    it("matches by catalog_product_id", () => {
      const match = findMatchingOverride({ catalog_product_id: "cat-001" }, index);
      expect(match).toBeDefined();
      expect(match?.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
    });

    it("matches by variant sku", () => {
      const match = findMatchingOverride({ id: 999, variants: [{ sku: "DES-WATER-1000" }] }, index);
      expect(match).toBeDefined();
      expect(match?.no).toBe(2);
    });

    it("returns undefined when no identifier matches", () => {
      const match = findMatchingOverride({ id: 999 }, index);
      expect(match).toBeUndefined();
    });
  });

  describe("Image Resolution Priority Chain", () => {
    it("prefers product.image_url over everything else", () => {
      const img = resolveCatalogProductImage(
        {
          image_url: "https://example.com/prod_db.jpg",
          imageUrl: "https://example.com/prod_legacy.jpg",
        },
        {
          image_url: "https://example.com/override.jpg",
          image_data_url: "data:image/jpeg;base64,123",
        },
      );
      expect(img).toBe("https://example.com/prod_db.jpg");
    });

    it("prefers product.imageUrl when product.image_url is missing", () => {
      const img = resolveCatalogProductImage(
        { imageUrl: "https://example.com/prod_legacy.jpg" },
        { image_url: "https://example.com/override.jpg" },
      );
      expect(img).toBe("https://example.com/prod_legacy.jpg");
    });

    it("prefers matched override.image_url when product has no image", () => {
      const img = resolveCatalogProductImage(
        {},
        {
          image_url: "https://example.com/override.jpg",
          image_data_url: "data:image/jpeg;base64,123",
        },
      );
      expect(img).toBe("https://example.com/override.jpg");
    });

    it("prefers matched override.image_data_url when override.image_url is missing", () => {
      const img = resolveCatalogProductImage({}, { image_data_url: "data:image/jpeg;base64,123" });
      expect(img).toBe("data:image/jpeg;base64,123");
    });

    it("returns undefined when neither product nor override has an image", () => {
      const img = resolveCatalogProductImage({}, {});
      expect(img).toBeUndefined();
    });
  });

  describe("Public Product Data Parity & Privacy", () => {
    it("Product 1 (150ml retail + 1000ml salon) maps correctly with retail price and salon contact-only", () => {
      const rawProd: RawCatalogProductInput = {
        id: 1,
        name: "DESEMBRE MILK ESSENTIAL CLEANSER",
        description: "Sữa rửa mặt không bọt cho mọi loại da",
        categoryId: "CLEANSER",
        variants: [
          { type: "retail", size: "150ml", price: 650000 },
          { type: "salon", size: "1000ml", price: 1650000 },
        ],
      };

      const override: ProductOverrideSafe = {
        no: 1,
        image_url:
          "https://xhfqjupiidexvlltstal.supabase.co/storage/v1/object/public/product-images/1.jpg",
        retail_size: "150ml",
        retail_price: 650000,
        salon_size: "1000ml",
      };

      const publicProd = buildPublicProductData(rawProd, override);

      expect(publicProd.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
      expect(publicProd.imageUrl).toBe(
        "https://xhfqjupiidexvlltstal.supabase.co/storage/v1/object/public/product-images/1.jpg",
      );
      expect(publicProd.publicSizes).toEqual(["150ml", "1000ml"]);
      expect(publicProd.publicPriceItems).toHaveLength(2);

      // Retail size
      const retailItem = publicProd.publicPriceItems.find((i) => i.sizeLabel === "150ml");
      expect(retailItem).toBeDefined();
      expect(retailItem?.retailPrice).toBe(650000);
      expect(retailItem?.requiresContact).toBe(false);

      // Salon size
      const salonItem = publicProd.publicPriceItems.find((i) => i.sizeLabel === "1000ml");
      expect(salonItem).toBeDefined();
      expect(salonItem?.retailPrice).toBeUndefined();
      expect(salonItem?.requiresContact).toBe(true);

      // Security check: no salon price in public mapped state
      expect(JSON.stringify(publicProd)).not.toContain("1650000");
    });

    it("Product 2 (only 1000ml salon variant) maps correctly as contact-only without retail price", () => {
      const rawProd: RawCatalogProductInput = {
        id: 2,
        name: "DESEMBRE DERMA SCIENCE WATER CLEANSER",
        description: "Nước tẩy trang cân bằng pH cho mọi loại da",
        categoryId: "CLEANSER",
        variants: [{ type: "salon", size: "1000ml", price: 1400000 }],
      };

      const override: ProductOverrideSafe = {
        no: 2,
        image_url:
          "https://xhfqjupiidexvlltstal.supabase.co/storage/v1/object/public/product-images/2.jpg",
      };

      const publicProd = buildPublicProductData(rawProd, override);

      expect(publicProd.name).toBe("DESEMBRE DERMA SCIENCE WATER CLEANSER");
      expect(publicProd.imageUrl).toBe(
        "https://xhfqjupiidexvlltstal.supabase.co/storage/v1/object/public/product-images/2.jpg",
      );
      expect(publicProd.publicSizes).toEqual(["1000ml"]);
      expect(publicProd.retailPrice).toBeUndefined();
      expect(publicProd.publicPriceItems).toHaveLength(1);
      expect(publicProd.publicPriceItems[0].sizeLabel).toBe("1000ml");
      expect(publicProd.publicPriceItems[0].retailPrice).toBeUndefined();
      expect(publicProd.publicPriceItems[0].requiresContact).toBe(true);

      // Security check: no salon price in public mapped state
      expect(JSON.stringify(publicProd)).not.toContain("1400000");
    });

    it("Product 3 (REPAIR MOUSSE CLEANSER) and Product 4 (ENZYME POWDER CLEANSER) map correctly", () => {
      const p3 = buildPublicProductData({
        id: 3,
        name: "DESEMBRE REPAIR MOUSSE CLEANSER",
        categoryId: "CLEANSER",
        variants: [{ type: "retail", size: "150ml", price: 850000 }],
      });
      expect(p3.retailPrice).toBe(850000);
      expect(p3.publicPriceItems[0]).toEqual({
        sizeLabel: "150ml",
        retailPrice: 850000,
        requiresContact: false,
      });

      const p4 = buildPublicProductData({
        id: 4,
        name: "DESEMBRE ENZYME POWDER CLEANSER",
        categoryId: "CLEANSER",
        variants: [{ type: "retail", size: "80g", price: 700000 }],
      });
      expect(p4.retailPrice).toBe(700000);
      expect(p4.publicPriceItems[0]).toEqual({
        sizeLabel: "80g",
        retailPrice: 700000,
        requiresContact: false,
      });
    });

    it("Structural check: no salon_price, wholesale_price, or cost in mapped output", () => {
      const prod = buildPublicProductData(
        {
          id: 1,
          name: "Test",
          variants: [
            { type: "retail", size: "150ml", price: 500000 },
            { type: "salon", size: "1000ml", price: 1200000 },
          ],
        },
        {
          no: 1,
          retail_price: 500000,
        },
      );

      const json = JSON.stringify(prod);
      expect(json).not.toContain("salon_price");
      expect(json).not.toContain("wholesale_price");
      expect(json).not.toContain("cost");
      expect(json).not.toContain("1200000");
    });
  });

  describe("VAT display immutability", () => {
    it("VAT calculation does not mutate base retailPrice in PublicProduct", () => {
      const prod = buildPublicProductData({
        id: 1,
        name: "Test",
        variants: [{ type: "retail", size: "150ml", price: 650000 }],
      });

      const basePrice = prod.retailPrice!;
      expect(basePrice).toBe(650000);

      const formattedWithout = formatCatalogPrice(basePrice, "without_vat");
      expect(formattedWithout).toBe("650.000đ");

      const formattedWith = formatCatalogPrice(basePrice, "with_vat");
      expect(formattedWith).toBe("702.000đ");

      // base retailPrice in product object remains 650000
      expect(prod.retailPrice).toBe(650000);
      expect(prod.publicPriceItems[0].retailPrice).toBe(650000);
    });
  });
});
