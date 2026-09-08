import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  mapDbProductToPublic,
  resolveCatalogProductImage,
  buildOverrideMapByNo,
} from "../src/features/catalog/catalogParityUtils";
import { fetchPublicCatalogSafe, type PublicCatalogProductDb } from "../src/lib/publicCatalogDb";
import { supabase } from "../src/integrations/supabase/client";

// Mock supabase
vi.mock("../src/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe("Public Catalog Image Sync & DB Flow - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Image Priority & Admin Upload Sync", () => {
    const uploadedAdminUrl =
      "https://xyz.supabase.co/storage/v1/object/public/product-images/catalog-products/prod-cleanser/172567890-enzymepowder.png";
    const oldOverrideUrl = "https://example.com/old-override-image.png";

    it("public mapper prefers catalog_products.image_url over override image", () => {
      const dbProd: PublicCatalogProductDb = {
        id: "prod-cleanser",
        brand_id: "b-desembre",
        brand_name: "Desembre",
        product_code: "1",
        name: "DESEMBRE ENZYME POWDER CLEANSER",
        description: "Bột rửa mặt Enzyme làm sạch sâu",
        image_url: uploadedAdminUrl,
        status: "active",
        retailVariants: [
          {
            id: "v-retail-1",
            product_id: "prod-cleanser",
            channel: "retail",
            size_label: "80g",
            price: 650000,
            is_active: true,
          },
        ],
        salonVariants: [
          {
            id: "v-salon-1",
            product_id: "prod-cleanser",
            channel: "salon",
            size_label: "250g",
            price: 1500000,
            is_active: true,
          },
        ],
      };

      const overrideByNo = buildOverrideMapByNo([
        {
          no: 1,
          name: "DESEMBRE ENZYME POWDER CLEANSER",
          image_url: oldOverrideUrl,
          retail_size: "80g",
          retail_price: 650000,
        },
      ]);

      const { product, diag } = mapDbProductToPublic(dbProd, overrideByNo);

      // Product image MUST be the uploaded image from catalog_products.image_url
      expect(product.imageUrl).toBe(uploadedAdminUrl);
      expect(diag.finalImageUrl).toBe(uploadedAdminUrl);
      expect(diag.imageLoadStatus).toBe("resolved");
    });

    it("product uploaded image from catalog_products.image_url appears in PublicProduct.imageUrl even without overrides", () => {
      const dbProd: PublicCatalogProductDb = {
        id: "prod-new-item",
        brand_id: "b-desembre",
        product_code: "99",
        name: "DESEMBRE NEW INNOVATION CREAM",
        image_url: uploadedAdminUrl,
        status: "active",
        retailVariants: [],
        salonVariants: [],
      };

      const emptyOverrides = buildOverrideMapByNo([]);
      const { product } = mapDbProductToPublic(dbProd, emptyOverrides);

      expect(product.imageUrl).toBe(uploadedAdminUrl);
    });

    it("falls back to override image when catalog_products.image_url is null or whitespace", () => {
      const dbProdNullImage: PublicCatalogProductDb = {
        id: "prod-2",
        brand_id: "b-desembre",
        product_code: "2",
        name: "DESEMBRE 24K GOLD MASK",
        image_url: null,
        status: "active",
        retailVariants: [],
        salonVariants: [],
      };

      const overrideByNo = buildOverrideMapByNo([
        {
          no: 2,
          name: "DESEMBRE 24K GOLD MASK",
          image_url: oldOverrideUrl,
        },
      ]);

      const { product } = mapDbProductToPublic(dbProdNullImage, overrideByNo);
      expect(product.imageUrl).toBe(oldOverrideUrl);
    });

    it("resolveCatalogProductImage chain strictly adheres to priority order", () => {
      // 1. product.image_url wins against all
      expect(
        resolveCatalogProductImage(
          { image_url: "url-1" },
          { image_url: "url-2", image_data_url: "url-3" },
        ),
      ).toBe("url-1");

      // 2. override.image_url wins if product image is empty
      expect(
        resolveCatalogProductImage(
          { image_url: "" },
          { image_url: "url-2", image_data_url: "url-3" },
        ),
      ).toBe("url-2");

      // 3. override.image_data_url wins if product and override url are empty
      expect(
        resolveCatalogProductImage(
          { image_url: null },
          { image_url: " ", image_data_url: "url-3" },
        ),
      ).toBe("url-3");

      // 4. Returns undefined if nothing available
      expect(resolveCatalogProductImage(null, null)).toBeUndefined();
    });
  });

  describe("2. fetchPublicCatalogSafe & Fallback Logic", () => {
    it("uses public views when available", async () => {
      const mockBrands = [{ id: "b1", name: "Desembre", code: "DES", slug: "desembre" }];
      const mockCategories = [{ id: "c1", name: "Làm sạch", slug: "lam-sach", brand_id: "b1" }];
      const mockProducts = [
        {
          id: "p1",
          brand_id: "b1",
          category_id: "c1",
          product_code: "1",
          name: "DESEMBRE ENZYME POWDER CLEANSER",
          description: "Mô tả",
          image_url: "https://example.com/cleanser.png",
          status: "active",
          sort_order: 10,
        },
      ];
      const mockRetailVariants = [
        {
          id: "v1",
          product_id: "p1",
          sku: "DES-01-RET",
          channel: "retail",
          size_label: "80g",
          price: 650000,
          is_active: true,
        },
      ];
      const mockSalonVariants = [
        {
          id: "v2",
          product_id: "p1",
          sku: "DES-01-SAL",
          channel: "salon",
          size_label: "250g",
          price: 1500000,
          is_active: true,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((tableOrView: string) => {
        if (tableOrView === "public_product_brands" || tableOrView === "product_brands") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockBrands, error: null }),
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockBrands, error: null }),
              }),
            }),
          };
        }
        if (tableOrView === "public_product_categories" || tableOrView === "product_categories") {
          const categoryResult = { data: mockCategories, error: null };
          const mockQuery: unknown = {
            in: vi.fn().mockResolvedValue(categoryResult),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(categoryResult).then(resolve),
          };
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue(mockQuery),
              }),
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue(mockQuery),
                }),
              }),
            }),
          };
        }
        if (tableOrView === "public_catalog_products" || tableOrView === "catalog_products") {
          const productResult = { data: mockProducts, error: null };
          const mockQuery: unknown = {
            in: vi.fn().mockResolvedValue(productResult),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(productResult).then(resolve),
          };
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue(mockQuery),
              }),
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue(mockQuery),
                }),
              }),
            }),
          };
        }
        if (tableOrView === "public_catalog_variants" || tableOrView === "catalog_product_variants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                const data = val === "retail" ? mockRetailVariants : mockSalonVariants;
                return {
                  in: vi.fn().mockResolvedValue({ data, error: null }),
                  eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({ data, error: null }),
                  }),
                };
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const res = await fetchPublicCatalogSafe();

      expect(res.products.length).toBe(1);
      expect(res.products[0].name).toBe("DESEMBRE ENZYME POWDER CLEANSER");
      expect(res.products[0].image_url).toBe("https://example.com/cleanser.png");
      expect(res.products[0].retailVariants.length).toBe(1);
      expect(res.products[0].salonVariants.length).toBe(1);
    });

    it("falls back to base tables if views return error or are missing", async () => {
      const mockProducts = [
        {
          id: "p1",
          brand_id: "b1",
          category_id: null,
          product_code: "1",
          name: "Table Fallback Product",
          description: null,
          image_url: "https://example.com/from-base-table.jpg",
          status: "active",
          sort_order: 1,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((tableOrView: string) => {
        // Views fail
        if (tableOrView.startsWith("public_")) {
          return {
            select: vi.fn().mockReturnValue({
              order: vi
                .fn()
                .mockResolvedValue({ data: null, error: { message: "Relation does not exist" } }),
              eq: vi.fn().mockReturnValue({
                in: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: { message: "Relation does not exist" } }),
              }),
            }),
          };
        }
        // Base tables succeed
        if (tableOrView === "product_brands") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (tableOrView === "product_categories") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (tableOrView === "catalog_products") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
                }),
              }),
            }),
          };
        }
        if (tableOrView === "catalog_product_variants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const res = await fetchPublicCatalogSafe();

      expect(res.products.length).toBe(1);
      expect(res.products[0].name).toBe("Table Fallback Product");
      expect(res.products[0].image_url).toBe("https://example.com/from-base-table.jpg");
    });

    it("returns empty products array when both views and tables return empty", async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const res = await fetchPublicCatalogSafe();
      expect(res.products).toEqual([]);
    });

    it("assigns product_code on PublicProduct from dbProd.product_code", () => {
      const dbProd: PublicCatalogProductDb = {
        id: "prod-cleanser-123",
        brand_id: "b-desembre",
        product_code: "1",
        name: "DESEMBRE ENZYME POWDER CLEANSER",
        description: "Bột rửa mặt Enzyme",
        image_url: "https://example.com/enzyme.jpg",
        status: "active",
        retailVariants: [],
        salonVariants: [],
      };
      const { product } = mapDbProductToPublic(dbProd, new Map());
      expect(product.product_code).toBe("1");
      expect(product.imageUrl).toBe("https://example.com/enzyme.jpg");
    });
  });
});

