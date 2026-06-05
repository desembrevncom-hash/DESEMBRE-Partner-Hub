import { describe, expect, it } from "vitest";
import {
  mapDbCatalogToProduct,
  checkLegacyOrderability,
  DbCatalogProduct,
} from "../src/lib/catalogDb";

describe("catalogDbRead.test.ts - Legacy Order Guard Offline Unit Tests", () => {
  it("should map DbCatalogProduct to legacy Product shape correctly", () => {
    const dbProduct: DbCatalogProduct = {
      id: "db-uuid-123",
      catalog_product_id: "db-uuid-123",
      product_code: "1",
      brand_id: "brand-1",
      brand_name: "Desembre",
      brand_code: "DESEMBRE",
      category_name: "Làm sạch",
      category_slug: "cleanser",
      name: "Test Product",
      description: "Test Description",
      image_url: "https://example.com/img.jpg",
      catalog_url: "https://example.com/pdf.pdf",
      variants: [
        {
          variant_id: "var-1",
          sku: "SKU-RETAIL",
          channel: "retail",
          size_label: "150ml",
          price: 650000,
          currency: "VND",
          inventory_tracking_enabled: false,
          stock_policy: "untracked",
        },
        {
          variant_id: "var-2",
          sku: "SKU-SALON",
          channel: "salon",
          size_label: "1000ml",
          price: 1650000,
          currency: "VND",
          inventory_tracking_enabled: false,
          stock_policy: "untracked",
        },
      ],
    };

    const mapped = mapDbCatalogToProduct(dbProduct);

    expect(mapped.id).toBe(1);
    expect(mapped.dbId).toBe("db-uuid-123");
    expect(mapped.product_code).toBe("1");
    expect(mapped.brand_name).toBe("Desembre");
    expect(mapped.brand_code).toBe("DESEMBRE");
    expect(mapped.name).toBe("Test Product");
    expect(mapped.description).toBe("Test Description");
    expect(mapped.categoryId).toBe("cleanser");
    expect(mapped.imageUrl).toBe("https://example.com/img.jpg");
    expect(mapped.pdfUrl).toBe("https://example.com/pdf.pdf");
    expect(mapped.isDbProduct).toBe(true);

    expect(mapped.variants).toHaveLength(2);
    expect(mapped.variants[0].id).toBe("var-1");
    expect(mapped.variants[0].type).toBe("retail");
    expect(mapped.variants[0].size).toBe("150ml");
    expect(mapped.variants[0].price).toBe(650000);
  });

  it("should pass Legacy Order Guard when product_code, channel, price, and size match static configuration", () => {
    const dbProduct: DbCatalogProduct = {
      id: "db-uuid-1",
      catalog_product_id: "db-uuid-1",
      product_code: "1",
      brand_id: "brand-1",
      brand_name: "Desembre",
      brand_code: "DESEMBRE",
      category_name: "Làm sạch",
      category_slug: "cleanser",
      name: "DESEMBRE MILK ESSENTIAL CLEANSER",
      description: "Desc",
      image_url: null,
      catalog_url: null,
      variants: [
        {
          variant_id: "v-retail-1",
          sku: "SKU-1",
          channel: "retail",
          size_label: "150ml",
          price: 650000,
          currency: "VND",
          inventory_tracking_enabled: false,
          stock_policy: "untracked",
        },
        {
          variant_id: "v-salon-1",
          sku: "SKU-2",
          channel: "salon",
          size_label: "1000ml",
          price: 1650000,
          currency: "VND",
          inventory_tracking_enabled: false,
          stock_policy: "untracked",
        },
      ],
    };

    const mapped = mapDbCatalogToProduct(dbProduct);
    const guard = checkLegacyOrderability(mapped);

    expect(guard.retailOrderable).toBe(true);
    expect(guard.salonOrderable).toBe(true);
  });

  it("should block DB-only product with no static product equivalent", () => {
    const dbProduct: DbCatalogProduct = {
      id: "db-uuid-new",
      catalog_product_id: "db-uuid-new",
      product_code: "999",
      brand_id: "brand-1",
      brand_name: "Desembre",
      brand_code: "DESEMBRE",
      category_name: "Làm sạch",
      category_slug: "cleanser",
      name: "New DB Only Product",
      description: "Desc",
      image_url: null,
      catalog_url: null,
      variants: [
        {
          variant_id: "v-retail-new",
          sku: "SKU-NEW",
          channel: "retail",
          size_label: "150ml",
          price: 650000,
          currency: "VND",
          inventory_tracking_enabled: false,
          stock_policy: "untracked",
        },
      ],
    };

    const mapped = mapDbCatalogToProduct(dbProduct);
    const guard = checkLegacyOrderability(mapped);

    expect(guard.retailOrderable).toBe(false);
    expect(guard.retailMismatchReason).toBe("Chưa hỗ trợ lên đơn");
  });

  it("should block products when product_code does not strictly match static id", () => {
    const dbProduct: DbCatalogProduct = {
      id: "db-uuid-1",
      catalog_product_id: "db-uuid-1",
      product_code: "01",
      brand_id: "brand-1",
      brand_name: "Desembre",
      brand_code: "DESEMBRE",
      category_name: "Làm sạch",
      category_slug: "cleanser",
      name: "DESEMBRE MILK ESSENTIAL CLEANSER",
      description: "Desc",
      image_url: null,
      catalog_url: null,
      variants: [
        {
          variant_id: "v-retail-1",
          sku: "SKU-1",
          channel: "retail",
          size_label: "150ml",
          price: 650000,
          currency: "VND",
          inventory_tracking_enabled: false,
          stock_policy: "untracked",
        },
      ],
    };

    const mapped = mapDbCatalogToProduct(dbProduct);
    const guard = checkLegacyOrderability(mapped);

    expect(guard.retailOrderable).toBe(false);
    expect(guard.retailMismatchReason).toBe("Chưa hỗ trợ lên đơn");
  });

  it("should block orderability when price mismatches static config", () => {
    const dbProduct: DbCatalogProduct = {
      id: "db-uuid-1",
      catalog_product_id: "db-uuid-1",
      product_code: "1",
      brand_id: "brand-1",
      brand_name: "Desembre",
      brand_code: "DESEMBRE",
      category_name: "Làm sạch",
      category_slug: "cleanser",
      name: "DESEMBRE MILK ESSENTIAL CLEANSER",
      description: "Desc",
      image_url: null,
      catalog_url: null,
      variants: [
        {
          variant_id: "v-retail-1",
          sku: "SKU-1",
          channel: "retail",
          size_label: "150ml",
          price: 99999999,
          currency: "VND",
          inventory_tracking_enabled: false,
          stock_policy: "untracked",
        },
      ],
    };

    const mapped = mapDbCatalogToProduct(dbProduct);
    const guard = checkLegacyOrderability(mapped);

    expect(guard.retailOrderable).toBe(false);
    expect(guard.retailMismatchReason).toBe(
      "Giá/size DB khác catalog legacy — chưa hỗ trợ lên đơn",
    );
  });

  it("should block orderability when size mismatches static config", () => {
    const dbProduct: DbCatalogProduct = {
      id: "db-uuid-1",
      catalog_product_id: "db-uuid-1",
      product_code: "1",
      brand_id: "brand-1",
      brand_name: "Desembre",
      brand_code: "DESEMBRE",
      category_name: "Làm sạch",
      category_slug: "cleanser",
      name: "DESEMBRE MILK ESSENTIAL CLEANSER",
      description: "Desc",
      image_url: null,
      catalog_url: null,
      variants: [
        {
          variant_id: "v-retail-1",
          sku: "SKU-1",
          channel: "retail",
          size_label: "999ml",
          price: 650000,
          currency: "VND",
          inventory_tracking_enabled: false,
          stock_policy: "untracked",
        },
      ],
    };

    const mapped = mapDbCatalogToProduct(dbProduct);
    const guard = checkLegacyOrderability(mapped);

    expect(guard.retailOrderable).toBe(false);
    expect(guard.retailMismatchReason).toBe(
      "Giá/size DB khác catalog legacy — chưa hỗ trợ lên đơn",
    );
  });

  it("should handle Product ID 56 with no variants correctly", () => {
    const dbProduct: DbCatalogProduct = {
      id: "db-uuid-56",
      catalog_product_id: "db-uuid-56",
      product_code: "56",
      brand_id: "brand-1",
      brand_name: "Desembre",
      brand_code: "DESEMBRE",
      category_name: "Toner",
      category_slug: "toner",
      name: "DESEMBRE HYDRO TONER",
      description: "Desc",
      image_url: null,
      catalog_url: null,
      variants: [],
    };

    const mapped = mapDbCatalogToProduct(dbProduct);
    const guard = checkLegacyOrderability(mapped);

    expect(mapped.variants).toHaveLength(0);
    expect(guard.retailOrderable).toBe(false);
    expect(guard.salonOrderable).toBe(false);
  });
});
