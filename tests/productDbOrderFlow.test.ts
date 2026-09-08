import { describe, it, expect } from "vitest";
import {
  validateDbCartItem,
  normalizeDbCartItem,
  groupCartItems,
  mapItemToOrderInsert,
} from "../src/lib/orders";
import { getCartEntryLabel, getCartEntryPrice } from "../src/features/products/types";
import { transformDbProduct, mapDbCatalogToProduct } from "../src/lib/catalogDb";

describe("Product Catalog DB Order Flow (Chon len don)", () => {
  const sampleRawProduct = {
    id: "342834a7-2c7f-40da-8c4b-0b3c322fe648",
    brand_id: "5e99bbca-06c8-41f1-9ac7-60c75b6364c7",
    category_id: "0b3a27ca-625e-42e5-9f10-2e3d0bdb44ea",
    product_code: "1",
    name: "DESEMBRE MILK ESSENTIAL CLEANSER",
    description: "Sữa rửa mặt không bọt cho mọi loại da",
    image_url: "https://example.com/1.jpg",
    catalog_url: "https://example.com/1.pdf",
    status: "active",
    sort_order: 0,
  };

  const sampleRawVariants = [
    {
      id: "f57a6659-b97c-4890-b7b4-c87863ff86fb",
      product_id: "342834a7-2c7f-40da-8c4b-0b3c322fe648",
      sku: "DESEMBRE-1-SALON",
      channel: "salon",
      size_label: "1000ml",
      price: 1650000,
      currency: "VND",
      inventory_tracking_enabled: false,
      stock_policy: "untracked",
      is_active: true,
    },
    {
      id: "b451eb41-d5b4-4e93-9664-34a6980e82d5",
      product_id: "342834a7-2c7f-40da-8c4b-0b3c322fe648",
      sku: "DESEMBRE-1-RETAIL",
      channel: "retail",
      size_label: "150ml",
      price: 650000,
      currency: "VND",
      inventory_tracking_enabled: false,
      stock_policy: "untracked",
      is_active: true,
    },
  ];

  const brandMap = new Map([
    ["5e99bbca-06c8-41f1-9ac7-60c75b6364c7", { name: "Desembre", code: "DESEMBRE" }],
  ]);

  const categoryMap = new Map([
    ["0b3a27ca-625e-42e5-9f10-2e3d0bdb44ea", { name: "Sữa rửa mặt", slug: "sua-rua-mat" }],
  ]);

  it("transforms DB product and maps to legacy Product format with variants", () => {
    const transformed = transformDbProduct(sampleRawProduct, sampleRawVariants, brandMap, categoryMap);
    const product = mapDbCatalogToProduct(transformed);

    expect(product.id).toBe(1);
    expect(product.dbId).toBe(sampleRawProduct.id);
    expect(product.name).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
    expect(product.brand_name).toBe("Desembre");
    expect(product.variants).toHaveLength(2);

    const retailVar = product.variants.find((v) => v.type === "retail");
    const salonVar = product.variants.find((v) => v.type === "salon");

    expect(retailVar).toBeDefined();
    expect(retailVar?.price).toBe(650000);
    expect(retailVar?.sku).toBe("DESEMBRE-1-RETAIL");

    expect(salonVar).toBeDefined();
    expect(salonVar?.price).toBe(1650000);
    expect(salonVar?.sku).toBe("DESEMBRE-1-SALON");
  });

  it("validates dbItem created during handlePick for Salon channel", () => {
    const transformed = transformDbProduct(sampleRawProduct, sampleRawVariants, brandMap, categoryMap);
    const p = mapDbCatalogToProduct(transformed);
    const variant = p.variants.find((v) => v.type === "salon")!;

    const dbItem = {
      source: "db_catalog" as const,
      catalog_product_id: p.dbId!,
      variant_id: variant.id,
      brand_id: p.brand_id!,
      brand_name: p.brand_name!,
      brand_code: p.brand_code!,
      product_code: p.product_code || null,
      sku: variant.sku!,
      product_name: p.name,
      category_name: p.categoryName || null,
      channel: "salon" as const,
      size_label: variant.size || null,
      unit_price: variant.price,
      currency: "VND" as const,
      image_url: p.imageUrl || null,
      catalog_url: p.pdfUrl || null,
      inventory_tracking_enabled: false as const,
      stock_policy: "untracked" as const,
      added_at: new Date().toISOString(),
    };

    const check = validateDbCartItem(dbItem);
    expect(check.ok).toBe(true);

    if (check.ok) {
      expect(getCartEntryLabel(check.value)).toBe("DESEMBRE MILK ESSENTIAL CLEANSER (Salon – 1000ml)");
      expect(getCartEntryPrice(check.value)).toBe(1650000);
    }
  });

  it("validates dbItem created during handlePick for Retail channel", () => {
    const transformed = transformDbProduct(sampleRawProduct, sampleRawVariants, brandMap, categoryMap);
    const p = mapDbCatalogToProduct(transformed);
    const variant = p.variants.find((v) => v.type === "retail")!;

    const dbItem = {
      source: "db_catalog" as const,
      catalog_product_id: p.dbId!,
      variant_id: variant.id,
      brand_id: p.brand_id!,
      brand_name: p.brand_name!,
      brand_code: p.brand_code!,
      product_code: p.product_code || null,
      sku: variant.sku!,
      product_name: p.name,
      category_name: p.categoryName || null,
      channel: "retail" as const,
      size_label: variant.size || null,
      unit_price: variant.price,
      currency: "VND" as const,
      image_url: p.imageUrl || null,
      catalog_url: p.pdfUrl || null,
      inventory_tracking_enabled: false as const,
      stock_policy: "untracked" as const,
      added_at: new Date().toISOString(),
    };

    const check = validateDbCartItem(dbItem);
    expect(check.ok).toBe(true);

    if (check.ok) {
      expect(getCartEntryLabel(check.value)).toBe("DESEMBRE MILK ESSENTIAL CLEANSER (Retail – 150ml)");
      expect(getCartEntryPrice(check.value)).toBe(650000);
    }
  });

  it("normalizes and groups DB cart items in /orders/new", () => {
    const transformed = transformDbProduct(sampleRawProduct, sampleRawVariants, brandMap, categoryMap);
    const p = mapDbCatalogToProduct(transformed);
    const variant = p.variants.find((v) => v.type === "salon")!;

    const dbItem = {
      source: "db_catalog" as const,
      catalog_product_id: p.dbId!,
      variant_id: variant.id,
      brand_id: p.brand_id!,
      brand_name: p.brand_name!,
      brand_code: p.brand_code!,
      product_code: p.product_code || null,
      sku: variant.sku!,
      product_name: p.name,
      category_name: p.categoryName || null,
      channel: "salon" as const,
      size_label: variant.size || null,
      unit_price: variant.price,
      currency: "VND" as const,
      image_url: p.imageUrl || null,
      catalog_url: p.pdfUrl || null,
      inventory_tracking_enabled: false as const,
      stock_policy: "untracked" as const,
      added_at: new Date().toISOString(),
    };

    const item1 = normalizeDbCartItem(dbItem, false, 0);
    const item2 = normalizeDbCartItem(dbItem, false, 0);

    expect(item1).not.toBeNull();
    expect(item2).not.toBeNull();

    const grouped = groupCartItems([item1!, item2!]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].quantity).toBe(2);
    expect(grouped[0].unit_price).toBe(1650000);
    expect(grouped[0].line_total).toBe(3300000);
    expect(grouped[0].product_name_snapshot).toBe("DESEMBRE MILK ESSENTIAL CLEANSER");
    expect(grouped[0].source).toBe("db_catalog");

    const insertPayload = mapItemToOrderInsert(grouped[0], "order-uuid-123");
    expect(insertPayload.order_id).toBe("order-uuid-123");
    expect(insertPayload.product_no).toBe(1);
    expect(insertPayload.sku_snapshot).toBe("DESEMBRE-1-SALON");
    expect(insertPayload.channel_snapshot).toBe("salon");
    expect(insertPayload.source).toBe("db_catalog");
  });
});
