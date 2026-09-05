import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS, CATEGORIES } from "@/data/products";
import { fetchActiveDBCatalog } from "@/lib/catalogDb";
import type { PublicProduct, CatalogBrand, CatalogCategory, CatalogViewMode } from "./types";

interface PkRow {
  product_id?: number | null;
  usage_instructions?: string | null;
  benefits?: string | null;
  skin_concerns?: string[] | null;
  warnings?: string | null;
  product?: { name?: string | null } | null;
}

const getInitialViewMode = (): CatalogViewMode => {
  if (typeof window === "undefined") return "grid";
  try {
    const saved = localStorage.getItem("catalogViewMode");
    if (saved === "grid" || saved === "table") return saved;
  } catch (e) {
    void e;
  }
  return window.innerWidth >= 1024 ? "table" : "grid";
};

export interface ProductOverrideLike {
  no?: number | null;
  image_url?: string | null;
  image_data_url?: string | null;
  name?: string | null;
  desc?: string | null;
  retail_price?: number | null;
  retail_size?: string | null;
  // salon_price intentionally excluded — never fetched or mapped into public state
  salon_size?: string | null;
}

export function usePublicCatalog() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);

  // View Mode: grid | table
  const [viewMode, setViewModeState] = useState<CatalogViewMode>(getInitialViewMode);

  const setViewMode = useCallback((mode: CatalogViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem("catalogViewMode", mode);
    } catch (e) {
      void e;
    }
  }, []);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modals & Drawers
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Pagination: 24 items initial, 24 per "Xem thêm"
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const loadData = useCallback(async () => {
    setLoading(true);

    // 1. Declare overridesMap before any try/catch and before any product mapping
    const overridesMap = new Map<string, ProductOverrideLike>();

    // Fetch product_overrides safely (no status filter)
    try {
      const { data: overridesData, error: overridesError } = await supabase
        .from("product_overrides")
        // Only fetch public-safe fields — salon_price, deleted, is_custom, link_url, section
        // and updated_at are intentionally excluded from the network payload
        .select("no, image_url, image_data_url, name, desc, retail_price, retail_size, salon_size");
      if (overridesError) {
        console.warn("[usePublicCatalog] product_overrides query warning:", overridesError);
      } else if (overridesData) {
        (overridesData as ProductOverrideLike[]).forEach((row) => {
          if (row.no != null) {
            overridesMap.set(String(row.no), row);
          }
        });
      }
    } catch (err) {
      console.warn("[usePublicCatalog] product_overrides fetch error:", err);
    }

    if (overridesMap.size === 0 && typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("mock_overrides");
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            (parsed as ProductOverrideLike[]).forEach((r) => {
              if (r.no != null) {
                overridesMap.set(String(r.no), r);
              }
            });
          }
        }
      } catch (e) {
        void e;
      }
    }

    // Fetch product_knowledge safely (no status filter)
    const knowledgeMap = new Map<
      string,
      {
        usageInstructions?: string;
        benefits?: string;
        skinConcerns?: string[];
        warnings?: string;
      }
    >();

    try {
      const { data: pkData, error: pkError } = await supabase
        .from("product_knowledge")
        .select("product_id, usage_instructions, benefits, skin_concerns, warnings")
        .eq("is_active", true);

      if (pkError) {
        console.warn("[usePublicCatalog] product_knowledge fetch warning:", pkError);
      } else if (pkData) {
        (pkData as unknown as PkRow[]).forEach((row) => {
          if (row.product_id != null) {
            knowledgeMap.set(String(row.product_id), {
              usageInstructions: row.usage_instructions || undefined,
              benefits: row.benefits || undefined,
              skinConcerns: row.skin_concerns || undefined,
              warnings: row.warnings || undefined,
            });
          }
        });
      }
    } catch (err) {
      console.warn("[usePublicCatalog] product_knowledge query error:", err);
    }

    // 2. Fetch active catalog products from DB or fallback to static
    try {
      const dbCatalog = await fetchActiveDBCatalog();

      if (dbCatalog && dbCatalog.length > 0) {
        const mappedProducts: PublicProduct[] = dbCatalog.map((p) => {
          const retail = p.variants.find((v) => v.channel === "retail");
          const codeKey = p.product_code ? String(p.product_code) : "";
          const idKey = String(p.id);
          const o = (codeKey && overridesMap.get(codeKey)) || overridesMap.get(idKey);
          const kn = (codeKey && knowledgeMap.get(codeKey)) || knowledgeMap.get(idKey);

          // Extract all unique size labels from variants and overrides (retail & salon sizes safe to display)
          const rawSizes: string[] = [];
          if (Array.isArray(p.variants)) {
            p.variants.forEach((v) => {
              if (v.size_label && typeof v.size_label === "string" && v.size_label.trim()) {
                rawSizes.push(v.size_label.trim());
              }
            });
          }
          if (o?.retail_size && typeof o.retail_size === "string" && o.retail_size.trim()) {
            rawSizes.push(o.retail_size.trim());
          }
          if (o?.salon_size && typeof o.salon_size === "string" && o.salon_size.trim()) {
            rawSizes.push(o.salon_size.trim());
          }
          const publicSizes = Array.from(new Set(rawSizes));

          // Image resolution priority: product.image_url -> override.image_url -> override.image_data_url -> fallback
          const resolvedImg = p.image_url || o?.image_url || o?.image_data_url || undefined;
          const resolvedRetailPrice = o?.retail_price ?? retail?.price;
          const resolvedRetailSize = o?.retail_size ?? retail?.size_label ?? undefined;

          return {
            id: p.catalog_product_id || p.id,
            dbId: p.catalog_product_id || p.id,
            name: p.name,
            brandName: p.brand_name || "Desembre",
            brandCode: p.brand_code,
            brandId: p.brand_id,
            categoryName: p.category_name || "Mỹ phẩm",
            categoryId: p.category_slug || undefined,
            description: p.description || undefined,
            imageUrl: resolvedImg,
            retailPrice:
              resolvedRetailPrice != null && resolvedRetailPrice > 0
                ? resolvedRetailPrice
                : undefined,
            retailSize: resolvedRetailSize,
            publicSizes,
            variants: p.variants.map((v) => ({
              size: v.size_label || "Tiêu chuẩn",
              price: v.channel === "retail" ? v.price : undefined,
              type: v.channel,
            })),
            usageInstructions: kn?.usageInstructions,
            benefits: kn?.benefits,
            skinConcerns: kn?.skinConcerns,
            warnings: kn?.warnings,
          };
        });

        // Brands
        const { data: bData } = await supabase
          .from("product_brands")
          .select("id, name, code")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        // Categories
        const { data: cData } = await supabase
          .from("product_categories")
          .select("id, name, brand_id")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });

        setProducts(mappedProducts);
        if (bData && bData.length > 0) setBrands(bData);
        if (cData && cData.length > 0) {
          setCategories(
            cData.map((c) => ({
              id: c.id,
              name: c.name,
              brandId: c.brand_id,
            })),
          );
        }
      } else {
        throw new Error("No DB products returned");
      }
    } catch {
      // Fallback to static PRODUCTS + overrides
      const staticMapped: PublicProduct[] = PRODUCTS.map((p) => {
        const cat = CATEGORIES.find((c) => c.id === p.categoryId);
        const o = overridesMap.get(String(p.id));
        const retail = p.variants.find((v) => v.type === "retail");

        // Extract all unique size labels from variants and overrides
        const rawSizes: string[] = [];
        if (Array.isArray(p.variants)) {
          p.variants.forEach((v) => {
            if (v.size && typeof v.size === "string" && v.size.trim()) {
              rawSizes.push(v.size.trim());
            }
          });
        }
        if (o?.retail_size && typeof o.retail_size === "string" && o.retail_size.trim()) {
          rawSizes.push(o.retail_size.trim());
        }
        if (o?.salon_size && typeof o.salon_size === "string" && o.salon_size.trim()) {
          rawSizes.push(o.salon_size.trim());
        }
        const publicSizes = Array.from(new Set(rawSizes));

        // Image resolution priority: product.imageUrl -> override.image_url -> override.image_data_url -> fallback
        const rawProdImg = p.imageUrl || (p as unknown as { image_url?: string }).image_url;
        const resolvedImg = rawProdImg || o?.image_url || o?.image_data_url || undefined;
        const resolvedRetailPrice = o?.retail_price ?? retail?.price;
        const resolvedRetailSize = o?.retail_size ?? retail?.size;

        return {
          id: p.id,
          name: o?.name || p.name,
          brandName: "Desembre",
          categoryName: cat?.nameVi || cat?.name || p.categoryId,
          categoryId: p.categoryId,
          description: o?.desc || p.description,
          imageUrl: resolvedImg,
          retailPrice:
            resolvedRetailPrice != null && resolvedRetailPrice > 0
              ? resolvedRetailPrice
              : undefined,
          retailSize: resolvedRetailSize,
          publicSizes,
          variants: p.variants.map((v) => ({
            size: v.size,
            price: v.type === "retail" ? (o?.retail_price ?? v.price) : undefined,
            type: v.type,
          })),
        };
      });

      setProducts(staticMapped);
      setBrands([{ id: "desembre", name: "Desembre" }]);
      setCategories(
        CATEGORIES.map((c) => ({
          id: c.id,
          name: c.nameVi || c.name,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset pagination visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedBrand, selectedCategory]);

  // Normalized search query
  const queryNorm = useMemo(() => searchQuery.toLowerCase().trim(), [searchQuery]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !queryNorm ||
        p.name.toLowerCase().includes(queryNorm) ||
        (p.description && p.description.toLowerCase().includes(queryNorm)) ||
        p.categoryName.toLowerCase().includes(queryNorm);

      const matchesBrand =
        selectedBrand === "all" || p.brandId === selectedBrand || p.brandName === selectedBrand;

      const matchesCategory =
        selectedCategory === "all" ||
        p.categoryName === selectedCategory ||
        p.categoryId === selectedCategory;

      return matchesSearch && matchesBrand && matchesCategory;
    });
  }, [products, queryNorm, selectedBrand, selectedCategory]);

  // Paginated visible products
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const hasMore = visibleCount < filteredProducts.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  const openProductDetail = useCallback((prod: PublicProduct) => {
    setSelectedProduct(prod);
    setIsDetailOpen(true);
  }, []);

  const closeProductDetail = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const openContact = useCallback(() => {
    setIsContactOpen(true);
  }, []);

  const closeContact = useCallback(() => {
    setIsContactOpen(false);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedBrand("all");
    setSelectedCategory("all");
  }, []);

  const hasActiveFilters =
    searchQuery !== "" || selectedBrand !== "all" || selectedCategory !== "all";

  return {
    loading,
    products,
    filteredProducts,
    brands,
    categories,
    // View Mode
    viewMode,
    setViewMode,
    // Filters
    searchQuery,
    setSearchQuery,
    selectedBrand,
    setSelectedBrand,
    selectedCategory,
    setSelectedCategory,
    clearFilters,
    hasActiveFilters,
    // Detail Modal
    selectedProduct,
    isDetailOpen,
    openProductDetail,
    closeProductDetail,
    // Contact Modal
    isContactOpen,
    openContact,
    closeContact,
    // Mobile Drawer
    isFilterDrawerOpen,
    setIsFilterDrawerOpen,
    // Pagination
    displayedProducts,
    hasMore,
    loadMore,
    visibleCount,
    totalFiltered: filteredProducts.length,
  };
}
