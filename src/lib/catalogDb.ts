import { supabase } from "@/integrations/supabase/client";
import type { Product, Category, ProductVariant } from "@/types/product";
import { CATEGORIES as INITIAL_CATEGORIES, PRODUCTS as INITIAL_PRODUCTS } from "@/data/products";

export async function getDbCatalog(): Promise<{ categories: Category[]; products: Product[] }> {
  // Query DB categories
  const { data: catData, error: catErr } = await supabase
    .from("categories")
    .select("*")
    .order("created_at", { ascending: true });

  // Query DB products with variants
  const { data: prodData, error: prodErr } = await supabase
    .from("products")
    .select(`
      *,
      variants:product_variants(*)
    `)
    .order("id", { ascending: true });

  // If DB query fails or returns empty (not seeded yet), fallback to initial seed catalog seamlessly
  const isDevMock = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_AUTH === "true";
  const useMock = isDevMock && localStorage.getItem("mock_session");

  if (useMock || !prodData || prodData.length === 0) {
    return {
      categories: INITIAL_CATEGORIES,
      products: INITIAL_PRODUCTS,
    };
  }

  // Map DB categories
  const categories: Category[] = (catData || []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description || undefined,
    nameVi: c.name_vi || undefined,
  }));

  // Map DB products
  const products: Product[] = prodData.map((p) => {
    const variants: ProductVariant[] = (p.variants || []).map((v: any) => ({
      id: v.id,
      type: v.type as "retail" | "salon",
      size: v.size,
      price: Number(v.price),
    }));

    return {
      id: p.id,
      name: p.name,
      description: p.description || "",
      categoryId: p.category_id,
      imageUrl: p.image_url || undefined,
      linkUrl: p.link_url || undefined,
      isCustom: p.is_custom,
      isDeleted: p.is_deleted,
      variants,
    };
  });

  return { categories, products };
}

export async function saveDbProduct(p: Partial<Product> & { id: number; variants?: ProductVariant[] }) {
  const isDevMock = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_AUTH === "true";
  if (isDevMock && localStorage.getItem("mock_session")) {
    return { ok: true };
  }

  // Ensure category exists if customizing
  if (p.categoryId) {
    await supabase.from("categories").upsert({
      id: p.categoryId,
      name: p.categoryId,
    }).select().maybeSingle();
  }

  // 1. Upsert product record
  const { error: pErr } = await supabase.from("products").upsert({
    id: p.id,
    name: p.name || "",
    description: p.description || "",
    category_id: p.categoryId,
    image_url: p.imageUrl || null,
    link_url: p.linkUrl || null,
    is_custom: p.isCustom || false,
    is_deleted: p.isDeleted || false,
    updated_at: new Date().toISOString(),
  });

  if (pErr) return { ok: false, error: pErr.message };

  // 2. Upsert variants
  if (p.variants) {
    for (const v of p.variants) {
      await supabase.from("product_variants").upsert({
        id: v.id,
        product_id: p.id,
        type: v.type,
        size: v.size,
        price: v.price,
      });
    }
  }

  return { ok: true };
}

export async function deleteDbProduct(id: number) {
  const { error } = await supabase.from("products").update({ is_deleted: true }).eq("id", id);
  return { ok: !error, error: error?.message };
}
