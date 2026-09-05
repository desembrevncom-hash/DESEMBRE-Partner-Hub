import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS, CATEGORIES } from "@/data/products";
import { fetchActiveDBCatalog } from "@/lib/catalogDb";
import type { CatalogVatMode } from "@/lib/pricing";
import type { PublicProduct, CatalogBrand, CatalogCategory, CatalogViewMode } from "./types";
import {
  type ProductOverrideSafe,
  buildOverrideIndex,
  findMatchingOverride,
  buildPublicProductData,
  logCatalogParityDiagnostics,
} from "./catalogParityUtils";

interface PkRow {
  product_id?: number | null;
  usage_instructions?: string | null;
  benefits?: string | null;
  skin_concerns?: string[] | null;
  warnings?: string | null;
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

const getInitialVatMode = (): CatalogVatMode => {
  if (typeof window === "undefined") return "without_vat";
  try {
    const saved = localStorage.getItem("catalogVatMode");
    if (saved === "without_vat" || saved === "with_vat") return saved;
  } catch (e) {
    void e;
  }
  return "without_vat";
};

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

  // VAT Mode: without_vat | with_vat
  const [vatMode, setVatModeState] = useState<CatalogVatMode>(getInitialVatMode);

  const setVatMode = useCallback((mode: CatalogVatMode) => {
    setVatModeState(mode);
    try {
      localStorage.setItem("catalogVatMode", mode);
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

    // 1. Fetch product overrides safely (explicit public-safe columns only)
    const rawOverridesList: ProductOverrideSafe[] = [];

    try {
      const { data: overridesData, error: overridesError } = await supabase
        .from("product_overrides")
        .select("no, image_url, image_data_url, name, desc, retail_price, retail_size, salon_size");

      if (overridesError) {
        console.warn("[usePublicCatalog] product_overrides query warning:", overridesError);
      } else if (overridesData) {
        rawOverridesList.push(...(overridesData as ProductOverrideSafe[]));
      }
    } catch (err) {
      console.warn("[usePublicCatalog] product_overrides fetch error:", err);
    }

    // Include localStorage mock_overrides if available in dev/browser
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("mock_overrides");
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            rawOverridesList.push(...(parsed as ProductOverrideSafe[]));
          }
        }
      } catch (e) {
        void e;
      }
    }

    // Build multi-key index for matching (by no, product_no, product_id, catalog_product_id, sku)
    const overrideIndex = buildOverrideIndex(rawOverridesList);

    // 2. Fetch product_knowledge safely (no status filter)
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

    // 3. Fetch active catalog products from DB, fallback to static PRODUCTS if DB catalog is empty/fails
    try {
      const dbCatalog = await fetchActiveDBCatalog();

      if (dbCatalog && dbCatalog.length > 0) {
        const mappedProducts: PublicProduct[] = dbCatalog.map((p) => {
          const matchedOverride = findMatchingOverride(p, overrideIndex);
          const codeKey = p.product_code ? String(p.product_code).trim() : "";
          const idKey = String(p.id).trim();
          const kn = (codeKey && knowledgeMap.get(codeKey)) || knowledgeMap.get(idKey);

          return buildPublicProductData(
            {
              id: p.catalog_product_id || p.id,
              dbId: p.catalog_product_id || p.id,
              product_code: p.product_code,
              catalog_product_id: p.catalog_product_id,
              name: p.name,
              brandName: p.brand_name || "Desembre",
              brandCode: p.brand_code,
              brandId: p.brand_id,
              categoryName: p.category_name || "Mỹ phẩm",
              categoryId: p.category_slug || undefined,
              description: p.description || undefined,
              image_url: p.image_url,
              variants: (p.variants || []).map((v) => ({
                id: v.variant_id,
                channel: v.channel,
                size_label: v.size_label,
                price: v.price,
                sku: v.sku,
              })),
            },
            matchedOverride,
            kn,
          );
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
        logCatalogParityDiagnostics(mappedProducts);

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
      // Fallback: Use static PRODUCTS + overrideIndex (exact parity with admin mergedProducts)
      const staticMapped: PublicProduct[] = PRODUCTS.map((p) => {
        const cat = CATEGORIES.find((c) => c.id === p.categoryId);
        const matchedOverride = findMatchingOverride(p, overrideIndex);
        const kn = knowledgeMap.get(String(p.id));

        return buildPublicProductData(
          {
            id: p.id,
            name: p.name,
            brandName: "Desembre",
            categoryName: cat?.nameVi || cat?.name || p.categoryId,
            categoryId: p.categoryId,
            description: p.description,
            imageUrl: p.imageUrl,
            variants: p.variants.map((v) => ({
              id: v.id,
              type: v.type,
              size: v.size,
              price: v.price,
            })),
          },
          matchedOverride,
          kn,
        );
      });

      setProducts(staticMapped);
      logCatalogParityDiagnostics(staticMapped);

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
    // VAT Mode
    vatMode,
    setVatMode,
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
