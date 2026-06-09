import { describe, expect, it } from "vitest";
import { calculateOrderTotal, validateAndPrepareOrder } from "./orders";

describe("calculateOrderTotal", () => {
  it("calculates total for one item", () => {
    const total = calculateOrderTotal([
      {
        productId: "p1",
        name: "Product A",
        unitPrice: 100000,
        quantity: 2,
      },
    ]);

    expect(total).toBe(200000);
  });

  it("calculates total for multiple items", () => {
    const total = calculateOrderTotal([
      {
        productId: "p1",
        name: "Product A",
        unitPrice: 100000,
        quantity: 2,
      },
      {
        productId: "p2",
        name: "Product B",
        unitPrice: 50000,
        quantity: 1,
      },
    ]);

    expect(total).toBe(250000);
  });

  it("returns 0 for empty cart", () => {
    const total = calculateOrderTotal([]);

    expect(total).toBe(0);
  });
});

describe("validateAndPrepareOrder", () => {
  it("fails if cart is empty", () => {
    const result = validateAndPrepareOrder({
      items: [],
      customerName: "Nguyễn Văn A",
      role: "sale",
      includeVat: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Giỏ hàng rỗng, không thể tạo đơn hàng.");
  });

  it("fails if customer name is empty", () => {
    const result = validateAndPrepareOrder({
      items: [
        {
          productId: "p1",
          name: "Product A",
          unitPrice: 100000,
          quantity: 1,
        },
      ],
      customerName: "   ",
      role: "sale",
      includeVat: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Vui lòng nhập tên khách hàng.");
  });

  it("successfully prepares valid order for sale role with VAT", () => {
    const result = validateAndPrepareOrder({
      items: [
        {
          productId: "p1",
          name: "Product A",
          unitPrice: 100000,
          quantity: 2, // subtotal = 200,000
        },
        {
          productId: "p2",
          name: "Product B",
          unitPrice: 50000,
          quantity: 1, // subtotal += 50,000 => 250,000
        },
      ],
      customerName: "Spa Thùy Dung",
      role: "sale",
      includeVat: true, // discount 40% => 150,000. VAT 8% => 12,000. total = 162,000
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.subtotal).toBe(250000);
      expect(result.data.discountRate).toBe(0.4);
      expect(result.data.vatAmount).toBe(12000);
      expect(result.data.total).toBe(162000);
      expect(result.data.itemCount).toBe(3);
    }
  });
});

import {
  validateDbCartItem,
  normalizeLegacyCartItem,
  normalizeDbCartItem,
  getGroupingKey,
  groupCartItems,
  isDbItemActive,
  isValidSource,
  mapItemToOrderInsert,
} from "./orders";

describe("Phase v1.4.1E.2 - DB Cart Payload & Hydration tests", () => {
  const sampleDbCartItem = {
    source: "db_catalog",
    catalog_product_id: "prod-uuid-1",
    variant_id: "variant-uuid-1",
    brand_id: "brand-uuid-1",
    brand_name: "Desembre",
    brand_code: "DES",
    product_code: "12",
    sku: "DES-12-R",
    product_name: "Oxy Bubble Mask",
    category_name: "Cleansing",
    channel: "retail",
    size_label: "150ml",
    unit_price: 250000,
    currency: "VND",
    image_url: "https://example.com/oxy.jpg",
    catalog_url: "https://example.com/oxy.pdf",
    inventory_tracking_enabled: false,
    stock_policy: "untracked",
    added_at: "2026-06-04T00:00:00Z",
  };

  const sampleStaticProducts = [
    {
      id: 12,
      name: "Oxy Bubble Mask Mapped",
      variants: [
        { type: "retail", size: "150ml", price: 240000 },
        { type: "salon", size: "1000ml", price: 900000 },
      ],
    },
  ];

  it("1. validate DB cart item pass", () => {
    const result = validateDbCartItem(sampleDbCartItem);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.variant_id).toBe("variant-uuid-1");
    }
  });

  it("2. reject DB cart item missing variant_id", () => {
    const invalidItem = { ...sampleDbCartItem, variant_id: "" };
    const result = validateDbCartItem(invalidItem);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("variant_id is required");
    }
  });

  it("3. reject DB cart item negative unit_price", () => {
    const invalidItem = { ...sampleDbCartItem, unit_price: -1000 };
    const result = validateDbCartItem(invalidItem);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("unit_price must be a number >= 0");
    }
  });

  it("4. normalize legacy cart item", () => {
    const legacyItem = { no: 12, sizeType: "retail" as const, quantity: 2 };
    const normalized = normalizeLegacyCartItem(
      legacyItem,
      sampleStaticProducts,
      {},
      false, // not sale role
      0.4,
    );
    expect(normalized).not.toBeNull();
    expect(normalized!.source).toBe("legacy_static");
    expect(normalized!.product_no).toBe(12);
    expect(normalized!.variant_id).toBeNull();
    expect(normalized!.quantity).toBe(2);
    expect(normalized!.unit_price).toBe(240000);
    expect(normalized!.line_total).toBe(480000);
  });

  it("5. normalize DB cart item", () => {
    const normalized = normalizeDbCartItem(
      sampleDbCartItem,
      true, // isSale
      0.4, // 40% discount
    );
    expect(normalized).not.toBeNull();
    expect(normalized!.source).toBe("db_catalog");
    expect(normalized!.product_no).toBe(12); // parsed from "12"
    expect(normalized!.variant_id).toBe("variant-uuid-1");
    expect(normalized!.unit_price).toBe(250000 * 0.6);
  });

  it("6. hydrate mixed cart", () => {
    const picks = [
      { no: 12, sizeType: "retail" as const }, // legacy
      { ...sampleDbCartItem, variant_id: "variant-uuid-1", quantity: 1 }, // DB
    ];

    const hydrated = picks
      .map((pk) => {
        if ("source" in pk && pk.source === "db_catalog") {
          return normalizeDbCartItem(pk, false, 0.4);
        }
        return normalizeLegacyCartItem(pk, sampleStaticProducts, {}, false, 0.4);
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    expect(hydrated.length).toBe(2);
    expect(hydrated[0].source).toBe("legacy_static");
    expect(hydrated[1].source).toBe("db_catalog");
  });

  it("7. group DB variant quantity", () => {
    const item1 = normalizeDbCartItem({ ...sampleDbCartItem, quantity: 1 }, false, 0.4)!;
    const item2 = normalizeDbCartItem({ ...sampleDbCartItem, quantity: 3 }, false, 0.4)!;

    const grouped = groupCartItems([item1, item2]);
    expect(grouped.length).toBe(1);
    expect(grouped[0].quantity).toBe(4);
    expect(grouped[0].line_total).toBe(grouped[0].unit_price * 4);
  });

  it("8. legacy grouping unchanged", () => {
    const item1 = normalizeLegacyCartItem(
      { no: 12, sizeType: "retail" },
      sampleStaticProducts,
      {},
      false,
      0.4,
    )!;
    const item2 = normalizeLegacyCartItem(
      { no: 12, sizeType: "retail" },
      sampleStaticProducts,
      {},
      false,
      0.4,
    )!;

    const grouped = groupCartItems([item1, item2]);
    expect(grouped.length).toBe(1);
    expect(grouped[0].quantity).toBe(2);
  });

  it("9. DB Retail/Salon same product separated", () => {
    const retailItem = normalizeDbCartItem(
      { ...sampleDbCartItem, channel: "retail", variant_id: "var-retail" },
      false,
      0.4,
    )!;
    const salonItem = normalizeDbCartItem(
      { ...sampleDbCartItem, channel: "salon", variant_id: "var-salon" },
      false,
      0.4,
    )!;

    const grouped = groupCartItems([retailItem, salonItem]);
    expect(grouped.length).toBe(2);
    expect(grouped[0].variant_id).toBe("var-retail");
    expect(grouped[1].variant_id).toBe("var-salon");
  });

  it("10. snapshot mapping for DB item", () => {
    const item = normalizeDbCartItem(sampleDbCartItem, false, 0.4)!;
    const insert = mapItemToOrderInsert(item, "order-id-999");

    expect(insert.order_id).toBe("order-id-999");
    expect(insert.product_no).toBe(12);
    expect(insert.source).toBe("db_catalog");
    expect(insert.catalog_product_id).toBe("prod-uuid-1");
    expect(insert.variant_id).toBe("variant-uuid-1");
    expect(insert.sku_snapshot).toBe("DES-12-R");
    expect(insert.brand_name_snapshot).toBe("Desembre");
    expect(insert.product_name_snapshot).toBe("Oxy Bubble Mask");
    expect(insert.channel_snapshot).toBe("retail");
    expect(insert.unit_price_snapshot).toBe(250000);
  });

  it("11. snapshot mapping for legacy item", () => {
    const item = normalizeLegacyCartItem(
      { no: 12, sizeType: "retail" },
      sampleStaticProducts,
      {},
      false,
      0.4,
    )!;
    const insert = mapItemToOrderInsert(item, "order-id-999");

    expect(insert.order_id).toBe("order-id-999");
    expect(insert.product_no).toBe(12);
    expect(insert.source).toBe("legacy_static");
    expect(insert.catalog_product_id).toBeNull();
    expect(insert.variant_id).toBeNull();
    expect(insert.brand_name_snapshot).toBe("Desembre");
    expect(insert.sku_snapshot).toBe("DESEMBRE-12-RETAIL");
  });

  it("12. VAT calculation with DB item", () => {
    const item = normalizeDbCartItem(
      { ...sampleDbCartItem, unit_price: 100000, quantity: 2 },
      false,
      0.4,
    )!;
    const items = [item];
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const vatRate = 0.08;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;

    expect(subtotal).toBe(200000);
    expect(vatAmount).toBe(16000);
    expect(total).toBe(216000);
  });

  it("13. VAT calculation with mixed cart", () => {
    const dbItem = normalizeDbCartItem(
      { ...sampleDbCartItem, unit_price: 100000, quantity: 2 },
      false,
      0.4,
    )!;
    const legacyItem = normalizeLegacyCartItem(
      { no: 12, sizeType: "retail" },
      sampleStaticProducts,
      {},
      false,
      0.4,
    )!; // 240,000 * 1 = 240,000

    const items = [dbItem, legacyItem];
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0); // 200,000 + 240,000 = 440,000
    const vatRate = 0.08;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;

    expect(subtotal).toBe(440000);
    expect(vatAmount).toBe(35200);
    expect(total).toBe(475200);
  });

  it("14. invalid source rejected", () => {
    const invalidSourceItem = { ...sampleDbCartItem, source: "external_api" };
    expect(isValidSource(invalidSourceItem.source)).toBe(false);
    expect(validateDbCartItem(invalidSourceItem).ok).toBe(false);
  });

  it("15. product_no nullability branch documented/tested where possible", () => {
    // If product is DB-only and product_code is not numeric (e.g. uuid or non-numeric/null), product_no must map to null.
    const dbOnlyItem = { ...sampleDbCartItem, product_code: "DB_ONLY_NO_NUMERIC" };
    const normalized = normalizeDbCartItem(dbOnlyItem, false, 0.4)!;
    expect(normalized.product_no).toBeNull();

    const insert = mapItemToOrderInsert(normalized, "order-id");
    expect(insert.product_no).toBeNull(); // validated nullable insertion path
  });
});
