import { describe, expect, it } from "vitest";
import { formatCatalogPrice, VAT_RATE, type CatalogVatMode } from "../src/lib/pricing";
import type { PublicPriceItem } from "../src/features/catalog/types";

// ---------------------------------------------------------------------------
// Pure helpers mirroring usePublicCatalog logic — tested in isolation
// ---------------------------------------------------------------------------

interface MockVariant {
  size: string;
  type: "retail" | "salon";
  price?: number;
}

interface MockOverride {
  no?: number | null;
  retail_size?: string | null;
  retail_price?: number | null;
  salon_size?: string | null;
  // salon_price intentionally absent — never fetched or mapped
}

function buildPriceItemsFromStaticVariants(
  variants: MockVariant[],
  override?: MockOverride,
): PublicPriceItem[] {
  const items: PublicPriceItem[] = [];

  for (const v of variants) {
    const sizeLabel = v.size?.trim();
    if (!sizeLabel) continue;

    if (v.type === "retail") {
      const basePrice = override?.retail_price ?? v.price;
      const price = basePrice != null && basePrice > 0 ? basePrice : undefined;
      items.push({ sizeLabel, retailPrice: price, requiresContact: price == null });
    } else {
      // salon/professional — size label is public-safe, price is NOT
      items.push({ sizeLabel, requiresContact: true });
    }
  }

  if (override?.retail_size?.trim()) {
    const sz = override.retail_size.trim();
    const price =
      override.retail_price != null && override.retail_price > 0
        ? override.retail_price
        : undefined;
    items.push({ sizeLabel: sz, retailPrice: price, requiresContact: price == null });
  }

  if (override?.salon_size?.trim()) {
    items.push({ sizeLabel: override.salon_size.trim(), requiresContact: true });
  }

  // De-duplicate by sizeLabel (first-seen wins)
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.sizeLabel)) return false;
    seen.add(item.sizeLabel);
    return true;
  });
}

// ---------------------------------------------------------------------------
// formatCatalogPrice tests
// ---------------------------------------------------------------------------

describe("formatCatalogPrice", () => {
  it("formats base price without VAT (without_vat mode)", () => {
    const result = formatCatalogPrice(650000, "without_vat");
    expect(result).toBe("650.000đ");
  });

  it("adds 8% VAT in with_vat mode", () => {
    const base = 650000;
    const expected = Math.round(base * (1 + VAT_RATE));
    const result = formatCatalogPrice(base, "with_vat");
    expect(result).toBe(new Intl.NumberFormat("vi-VN").format(expected) + "đ");
  });

  it("VAT mode does not mutate the base price value", () => {
    const base = 500000;
    const withoutVat = formatCatalogPrice(base, "without_vat");
    const withVat = formatCatalogPrice(base, "with_vat");
    // After both calls, base is still the original number
    expect(base).toBe(500000);
    expect(withoutVat).not.toBe(withVat);
  });

  it("applies correct VAT rate (8%) matching VAT_RATE constant", () => {
    const base = 100000;
    const result = formatCatalogPrice(base, "with_vat");
    const expectedAmount = Math.round(base * (1 + VAT_RATE));
    expect(result).toContain(String(expectedAmount / 1000).replace(".", ","));
    // VAT_RATE should be 0.08
    expect(VAT_RATE).toBe(0.08);
  });

  it("rounds to nearest integer before formatting", () => {
    // 650000 * 1.08 = 702000 exactly — no fraction
    const result = formatCatalogPrice(650000, "with_vat");
    expect(result).toBe("702.000đ");
  });
});

// ---------------------------------------------------------------------------
// publicPriceItems builder tests
// ---------------------------------------------------------------------------

describe("buildPriceItemsFromStaticVariants", () => {
  it("150ml retail with price + 1000ml salon → correct publicPriceItems", () => {
    const variants: MockVariant[] = [
      { size: "150ml", type: "retail", price: 650000 },
      { size: "1000ml", type: "salon", price: 1650000 }, // salon price must NOT appear
    ];

    const items = buildPriceItemsFromStaticVariants(variants);

    expect(items).toHaveLength(2);

    const retailItem = items.find((i) => i.sizeLabel === "150ml");
    expect(retailItem).toBeDefined();
    expect(retailItem!.retailPrice).toBe(650000);
    expect(retailItem!.requiresContact).toBe(false);

    const salonItem = items.find((i) => i.sizeLabel === "1000ml");
    expect(salonItem).toBeDefined();
    // Salon price must NEVER appear in public mapped state
    expect(salonItem!.retailPrice).toBeUndefined();
    expect(salonItem!.requiresContact).toBe(true);
  });

  it("retail variant with no price → requiresContact = true", () => {
    const variants: MockVariant[] = [{ size: "250ml", type: "retail", price: 0 }];
    const items = buildPriceItemsFromStaticVariants(variants);
    expect(items[0].requiresContact).toBe(true);
    expect(items[0].retailPrice).toBeUndefined();
  });

  it("override retail_price replaces variant price", () => {
    const variants: MockVariant[] = [{ size: "150ml", type: "retail", price: 500000 }];
    const override: MockOverride = { retail_price: 650000 };
    const items = buildPriceItemsFromStaticVariants(variants, override);
    expect(items[0].retailPrice).toBe(650000);
  });

  it("override salon_size adds a contact-only item without price", () => {
    const variants: MockVariant[] = [{ size: "150ml", type: "retail", price: 650000 }];
    const override: MockOverride = { salon_size: "1000ml" };
    const items = buildPriceItemsFromStaticVariants(variants, override);

    const overrideItem = items.find((i) => i.sizeLabel === "1000ml");
    expect(overrideItem).toBeDefined();
    expect(overrideItem!.requiresContact).toBe(true);
    // No salon price
    expect(overrideItem!.retailPrice).toBeUndefined();
  });

  it("de-duplicates by sizeLabel — first-seen wins", () => {
    const variants: MockVariant[] = [
      { size: "150ml", type: "retail", price: 650000 },
      { size: "150ml", type: "retail", price: 700000 }, // duplicate — should be ignored
    ];
    const items = buildPriceItemsFromStaticVariants(variants);
    expect(items).toHaveLength(1);
    expect(items[0].retailPrice).toBe(650000); // first-seen price
  });

  it("empty variants with no override → empty publicPriceItems", () => {
    const items = buildPriceItemsFromStaticVariants([]);
    expect(items).toHaveLength(0);
  });

  it("no salon_price field appears in any publicPriceItem — structural check", () => {
    const variants: MockVariant[] = [
      { size: "150ml", type: "retail", price: 650000 },
      { size: "1000ml", type: "salon", price: 1650000 },
    ];
    const items = buildPriceItemsFromStaticVariants(variants);

    // None of the mapped items should contain a salon_price or wholesale_price key
    items.forEach((item) => {
      expect(Object.keys(item)).not.toContain("salon_price");
      expect(Object.keys(item)).not.toContain("wholesale_price");
      expect(Object.keys(item)).not.toContain("cost");
    });
  });
});

// ---------------------------------------------------------------------------
// CatalogVatMode type verification
// ---------------------------------------------------------------------------

describe("CatalogVatMode", () => {
  it("vatMode without_vat → price unchanged", () => {
    const vatMode: CatalogVatMode = "without_vat";
    const base = 650000;
    const formatted = formatCatalogPrice(base, vatMode);
    // Should be the base amount formatted
    expect(formatted).toBe("650.000đ");
  });

  it("vatMode with_vat → price increases", () => {
    const vatMode: CatalogVatMode = "with_vat";
    const base = 650000;
    const formattedWithVat = formatCatalogPrice(base, vatMode);
    const formattedWithout = formatCatalogPrice(base, "without_vat");
    // With VAT version should be higher
    expect(formattedWithVat).not.toBe(formattedWithout);
    // 650000 * 1.08 = 702000
    expect(formattedWithVat).toBe("702.000đ");
  });

  it("produces correct dynamic table header label based on vatMode", () => {
    const getTableHeader = (vatMode: CatalogVatMode) =>
      vatMode === "with_vat" ? "Quy cách & Giá đã gồm VAT" : "Quy cách & Giá chưa VAT";

    expect(getTableHeader("without_vat")).toBe("Quy cách & Giá chưa VAT");
    expect(getTableHeader("with_vat")).toBe("Quy cách & Giá đã gồm VAT");
  });

  it("produces correct modal VAT note label based on vatMode", () => {
    const getModalVatNote = (vatMode: CatalogVatMode) =>
      vatMode === "with_vat" ? "Giá đang hiển thị: Đã gồm VAT 8%" : "Giá đang hiển thị: Chưa VAT";

    expect(getModalVatNote("without_vat")).toBe("Giá đang hiển thị: Chưa VAT");
    expect(getModalVatNote("with_vat")).toBe("Giá đang hiển thị: Đã gồm VAT 8%");
  });

  it("action determination: product with both retail price and professional contact-only size qualifies for Chi tiết", () => {
    const mixedItems: PublicPriceItem[] = [
      { sizeLabel: "150ml", retailPrice: 650000, requiresContact: false },
      { sizeLabel: "1000ml", requiresContact: true },
    ];
    const hasPricedItem = mixedItems.some((it) => !it.requiresContact);
    expect(hasPricedItem).toBe(true);

    const contactOnlyItems: PublicPriceItem[] = [{ sizeLabel: "1000ml", requiresContact: true }];
    const hasPricedContactOnly = contactOnlyItems.some((it) => !it.requiresContact);
    expect(hasPricedContactOnly).toBe(false);
  });
});
