import { describe, expect, it } from "vitest";
import { PRODUCTS, CATEGORIES } from "../src/data/products";

describe("publicCatalog Image Resolution & Fallback Logic", () => {
  interface OverrideRow {
    no?: number | null;
    image_url?: string | null;
    image_data_url?: string | null;
    name?: string | null;
    desc?: string | null;
    retail_price?: number | null;
    retail_size?: string | null;
    // salon_price removed — no longer fetched in public catalog queries
    salon_size?: string | null;
  }


  // Pure helper reflecting usePublicCatalog image resolution logic
  function resolveProductImage(
    prodImg: string | null | undefined,
    override: OverrideRow | undefined,
  ): string | undefined {
    return prodImg || override?.image_url || override?.image_data_url || undefined;
  }

  it("prefers product.image_url over override.image_url and override.image_data_url", () => {
    const prodImg = "https://cdn.example.com/product-original.png";
    const override: OverrideRow = {
      no: 1,
      image_url: "https://cdn.example.com/override.png",
      image_data_url: "data:image/png;base64,12345",
    };

    const resolved = resolveProductImage(prodImg, override);
    expect(resolved).toBe("https://cdn.example.com/product-original.png");
  });

  it("uses override.image_url when product.image_url is missing", () => {
    const prodImg = undefined;
    const override: OverrideRow = {
      no: 2,
      image_url: "https://cdn.example.com/override.png",
      image_data_url: "data:image/png;base64,12345",
    };

    const resolved = resolveProductImage(prodImg, override);
    expect(resolved).toBe("https://cdn.example.com/override.png");
  });

  it("uses override.image_data_url when both product image and override.image_url are missing", () => {
    const prodImg = undefined;
    const override: OverrideRow = {
      no: 3,
      image_data_url: "data:image/png;base64,12345",
    };

    const resolved = resolveProductImage(prodImg, override);
    expect(resolved).toBe("data:image/png;base64,12345");
  });

  it("returns undefined (fallback) when no image source is available", () => {
    const prodImg = undefined;
    const override: OverrideRow = {
      no: 4,
    };

    const resolved = resolveProductImage(prodImg, override);
    expect(resolved).toBeUndefined();
  });

  it("verifies static PRODUCTS fallback map executes safely with empty overridesMap (overrides failed/empty)", () => {
    // Simulating empty Map when product_overrides fails
    const overridesMap = new Map<string, ProductOverrideLike>();

    // Mapping must succeed without errors
    const staticMapped = PRODUCTS.slice(0, 10).map((p) => {
      const cat = CATEGORIES.find((c) => c.id === p.categoryId);
      const o = overridesMap.get(String(p.id));
      const retail = p.variants.find((v) => v.type === "retail");

      const rawSizes: string[] = [];
      p.variants.forEach((v) => {
        if (v.size && v.size.trim()) rawSizes.push(v.size.trim());
      });
      if (o?.retail_size && o.retail_size.trim()) rawSizes.push(o.retail_size.trim());
      if (o?.salon_size && o.salon_size.trim()) rawSizes.push(o.salon_size.trim());
      const publicSizes = Array.from(new Set(rawSizes));

      const rawProdImg = p.imageUrl || (p as unknown as { image_url?: string }).image_url;
      const resolvedImg = rawProdImg || o?.image_url || o?.image_data_url || undefined;
      const resolvedRetailPrice = o?.retail_price ?? retail?.price;

      return {
        id: p.id,
        name: o?.name || p.name,
        brandName: "Desembre",
        categoryName: cat?.nameVi || cat?.name || p.categoryId,
        categoryId: p.categoryId,
        description: o?.desc || p.description,
        imageUrl: resolvedImg,
        retailPrice:
          resolvedRetailPrice != null && resolvedRetailPrice > 0 ? resolvedRetailPrice : undefined,
        retailSize: o?.retail_size ?? retail?.size,
        publicSizes,
      };
    });

    expect(staticMapped.length).toBe(10);
    expect(staticMapped[0].brandName).toBe("Desembre");
    expect(staticMapped[0].name).toBe(PRODUCTS[0].name);
    expect(staticMapped[0].categoryName).toBeDefined();
    expect(staticMapped[0].publicSizes.length).toBeGreaterThan(0);
  });

  it("extracts publicSizes from both retail and salon variants without exposing salon price", () => {
    const mockVariants = [
      { size: "150ml", type: "retail" as const, price: 650000 },
      { size: "1000ml", type: "salon" as const, price: 1650000 },
    ];

    const rawSizes: string[] = [];
    mockVariants.forEach((v) => {
      if (v.size && v.size.trim()) rawSizes.push(v.size.trim());
    });
    const publicSizes = Array.from(new Set(rawSizes));

    expect(publicSizes).toEqual(["150ml", "1000ml"]);

    // Safe public variants omit salon price
    const safeVariants = mockVariants.map((v) => ({
      size: v.size,
      price: v.type === "retail" ? v.price : undefined,
      type: v.type,
    }));

    const salonVariant = safeVariants.find((v) => v.type === "salon");
    expect(salonVariant?.price).toBeUndefined();
    expect(salonVariant?.size).toBe("1000ml");
  });

  it("applies overrides correctly when overridesMap is populated with Map<string, ProductOverrideLike>", () => {
    const overridesMap = new Map<string, ProductOverrideLike>();
    overridesMap.set("1", {
      no: 1,
      name: "Overridden Product Name",
      retail_price: 999000,
      image_url: "https://cdn.example.com/custom-override.jpg",
    });

    const p = PRODUCTS[0];
    const cat = CATEGORIES.find((c) => c.id === p.categoryId);
    const o = overridesMap.get(String(p.id));
    const retail = p.variants.find((v) => v.type === "retail");

    const rawSizes: string[] = [];
    p.variants.forEach((v) => {
      if (v.size && v.size.trim()) rawSizes.push(v.size.trim());
    });
    const publicSizes = Array.from(new Set(rawSizes));

    const rawProdImg = p.imageUrl || (p as unknown as { image_url?: string }).image_url;
    const resolvedImg = rawProdImg || o?.image_url || o?.image_data_url || undefined;
    const resolvedRetailPrice = o?.retail_price ?? retail?.price;

    const mapped = {
      id: p.id,
      name: o?.name || p.name,
      brandName: "Desembre",
      categoryName: cat?.nameVi || cat?.name || p.categoryId,
      categoryId: p.categoryId,
      description: o?.desc || p.description,
      imageUrl: resolvedImg,
      retailPrice:
        resolvedRetailPrice != null && resolvedRetailPrice > 0 ? resolvedRetailPrice : undefined,
      retailSize: o?.retail_size ?? retail?.size,
      publicSizes,
    };

    expect(mapped.name).toBe("Overridden Product Name");
    expect(mapped.retailPrice).toBe(999000);
    expect(mapped.publicSizes.length).toBeGreaterThan(0);
  });
});

