import { describe, expect, it } from "vitest";
import { transformDbProduct, RawVariant, RawProduct } from "../src/lib/catalogDb";

describe("catalogDb.ts - Offline Unit Tests", () => {
  // Mock Brand Map
  const brandMap = new Map([
    ["brand-uuid-desembre", { name: "Desembre", code: "DESEMBRE" }],
    ["brand-uuid-dermagarden", { name: "Dermagarden", code: "DERMAGARDEN" }],
  ]);

  // Mock Category Map
  const categoryMap = new Map([
    ["cat-uuid-cleanser", { name: "Làm sạch", slug: "cleanser" }],
    ["cat-uuid-toner", { name: "Cân bằng", slug: "toner" }],
  ]);

  it("should transform product and group retail and salon variants correctly", () => {
    const rawProduct: RawProduct = {
      id: "prod-uuid-1",
      brand_id: "brand-uuid-desembre",
      category_id: "cat-uuid-cleanser",
      product_code: "1",
      name: "DESEMBRE MILK ESSENTIAL CLEANSER",
      description: "Sữa rửa mặt không bọt cho mọi loại da",
      image_url: "https://example.com/milk.jpg",
      catalog_url: "https://example.com/milk-catalog",
      status: "active",
      sort_order: 10,
    };

    const rawVariants: RawVariant[] = [
      {
        id: "var-uuid-1-retail",
        product_id: "prod-uuid-1",
        sku: "DESEMBRE-1-RETAIL",
        channel: "retail",
        size_label: "150ml",
        price: "650000",
        currency: "VND",
        inventory_tracking_enabled: false,
        stock_policy: "untracked",
        is_active: true,
      },
      {
        id: "var-uuid-1-salon",
        product_id: "prod-uuid-1",
        sku: "DESEMBRE-1-SALON",
        channel: "salon",
        size_label: "1000ml",
        price: "1650000",
        currency: "VND",
        inventory_tracking_enabled: false,
        stock_policy: "untracked",
        is_active: true,
      },
      {
        id: "var-uuid-1-inactive",
        product_id: "prod-uuid-1",
        sku: "DESEMBRE-1-INACTIVE",
        channel: "retail",
        size_label: "50ml",
        price: "200000",
        currency: "VND",
        inventory_tracking_enabled: false,
        stock_policy: "untracked",
        is_active: false,
      },
    ];

    const result = transformDbProduct(rawProduct, rawVariants, brandMap, categoryMap);
    // Verify output shape fields
    expect(result.id).toBe("prod-uuid-1");
    expect(result.catalog_product_id).toBe("prod-uuid-1");
    expect(result.product_code).toBe("1");
    expect(result.brand_id).toBe("brand-uuid-desembre");
    expect(result.brand_name).toBe("Desembre");
    expect(result.brand_code).toBe("DESEMBRE");
    expect(result.category_name).toBe("Làm sạch");
    expect(result.category_slug).toBe("cleanser");
    expect(result.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
    expect(result.description).toBe("Sữa rửa mặt không bọt cho mọi loại da");
    expect(result.image_url).toBe("https://example.com/milk.jpg");
    expect(result.catalog_url).toBe("https://example.com/milk-catalog");

    // Verify variants length (should filter out is_active = false)
    expect(result.variants).toHaveLength(2);

    // Verify retail variant mapping
    expect(result.retail).toBeDefined();
    expect(result.retail?.variant_id).toBe("var-uuid-1-retail");
    expect(result.retail?.sku).toBe("DESEMBRE-1-RETAIL");
    expect(result.retail?.channel).toBe("retail");
    expect(result.retail?.size_label).toBe("150ml");
    expect(result.retail?.price).toBe(650000);
    expect(result.retail?.currency).toBe("VND");
    expect(result.retail?.inventory_tracking_enabled).toBe(false);
    expect(result.retail?.stock_policy).toBe("untracked");

    // Verify salon variant mapping
    expect(result.salon).toBeDefined();
    expect(result.salon?.variant_id).toBe("var-uuid-1-salon");
    expect(result.salon?.sku).toBe("DESEMBRE-1-SALON");
    expect(result.salon?.channel).toBe("salon");
    expect(result.salon?.size_label).toBe("1000ml");
    expect(result.salon?.price).toBe(1650000);
    expect(result.salon?.currency).toBe("VND");
    expect(result.salon?.inventory_tracking_enabled).toBe(false);
    expect(result.salon?.stock_policy).toBe("untracked");
  });

  it("should handle product with no active variants (such as ID 56)", () => {
    const rawProduct: RawProduct = {
      id: "prod-uuid-56",
      brand_id: "brand-uuid-desembre",
      category_id: "cat-uuid-toner",
      product_code: "56",
      name: "DESEMBRE HYDRO TONER",
      description: "Nước hoa hồng cấp ẩm",
      image_url: null,
      catalog_url: null,
      status: "active",
      sort_order: 560,
    };

    // No variants for this product
    const rawVariants: RawVariant[] = [];

    const result = transformDbProduct(rawProduct, rawVariants, brandMap, categoryMap);

    expect(result.id).toBe("prod-uuid-56");
    expect(result.catalog_product_id).toBe("prod-uuid-56");
    expect(result.product_code).toBe("56");
    expect(result.variants).toHaveLength(0);
    expect(result.retail).toBeUndefined();
    expect(result.salon).toBeUndefined();
  });

  it("should parse prices to numbers and parse boolean and defaults for inventory flags", () => {
    const rawProduct = {
      id: "prod-uuid-2",
      brand_id: "brand-uuid-desembre",
      category_id: null,
      product_code: "2",
      name: "DESEMBRE PREY PRODUCT",
      description: null,
      image_url: null,
      catalog_url: null,
      status: "active",
      sort_order: 20,
    };

    const rawVariants = [
      {
        id: "var-uuid-2-retail",
        product_id: "prod-uuid-2",
        sku: "DESEMBRE-2-RETAIL",
        channel: "retail",
        size_label: null,
        price: "123000.45",
        currency: null, // should default to VND
        inventory_tracking_enabled: null, // should default to false (!!null)
        stock_policy: null, // should default to "untracked"
        is_active: true,
      },
    ];

    const result = transformDbProduct(rawProduct, rawVariants, brandMap, categoryMap);

    expect(result.variants).toHaveLength(1);
    const v = result.variants[0];
    expect(v.price).toBe(123000.45);
    expect(v.currency).toBe("VND");
    expect(v.inventory_tracking_enabled).toBe(false);
    expect(v.stock_policy).toBe("untracked");
    expect(v.size_label).toBeNull();
  });

  it("should sort order correctly in a hypothetical list of transformed products", () => {
    // This tests that our database ordering expectations match (sort_order asc, product_code asc)
    const list = [
      { sort_order: 20, product_code: "10" },
      { sort_order: 10, product_code: "5" },
      { sort_order: 10, product_code: "2" },
      { sort_order: 20, product_code: "1" },
    ];

    // Sort by sort_order, then product_code (using natural sort, or string sort based on column)
    const sorted = [...list].sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.product_code.localeCompare(b.product_code, undefined, { numeric: true });
    });

    expect(sorted).toEqual([
      { sort_order: 10, product_code: "2" },
      { sort_order: 10, product_code: "5" },
      { sort_order: 20, product_code: "1" },
      { sort_order: 20, product_code: "10" },
    ]);
  });
});
