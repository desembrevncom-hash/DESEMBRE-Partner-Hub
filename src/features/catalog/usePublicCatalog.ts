import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOptionalAuth } from "@/hooks/useAuth";
import { PRODUCTS, CATEGORIES } from "@/data/products";
import { fetchPublicCatalogSafe } from "@/lib/publicCatalogDb";
import type { CatalogVatMode } from "@/lib/pricing";
import type { PublicProduct, CatalogBrand, CatalogCategory, CatalogViewMode } from "./types";
import {
  type ProductOverrideSafe,
  type DiagItem,
  buildOverrideMapByNo,
  mapDbProductToPublic,
  mapStaticProductToPublic,
  logCatalogParityDiagnostics,
} from "./catalogParityUtils";

interface PkRow {
  product_id?: number | null;
  usage_instructions?: string | null;
  benefits?: string | null;
  skinConcerns?: string[];
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

export interface UsePublicCatalogOptions {
  canViewPartnerPrices?: boolean;
}

export function usePublicCatalog(options?: UsePublicCatalogOptions) {
  // Public catalog displays full prices (retail & salon/professional) for all visitors
  const canViewPartnerPrices = options?.canViewPartnerPrices ?? true;

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

    // 1. Fetch product_overrides safely (explicit public-safe columns only, including salon_price)
    const rawOverridesList: ProductOverrideSafe[] = [];

    try {
      const overrideColumns =
        "no, image_url, name, desc, retail_price, retail_size, salon_price, salon_size";

      const { data: overridesData, error: overridesError } = await supabase
        .from("product_overrides")
        .select(overrideColumns);

      if (overridesError) {
        console.warn("[usePublicCatalog] product_overrides query warning:", overridesError);
      } else if (overridesData) {
        rawOverridesList.push(...(overridesData as ProductOverrideSafe[]));
      }
    } catch (err) {
      console.warn("[usePublicCatalog] product_overrides fetch error:", err);
    }

    // Include localStorage mock_overrides in dev/client fallback
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

    // Index overrides by numeric no
    const overrideByNo = buildOverrideMapByNo(rawOverridesList);

    // 2. Fetch product_knowledge safely
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

    // 3. Dedicated public-safe catalog DB query
    try {
      const dbResult = await fetchPublicCatalogSafe({ canViewPartnerPrices });

      if (dbResult.products && dbResult.products.length > 0) {
        const mappedProducts: PublicProduct[] = [];
        const diagList: DiagItem[] = [];

        dbResult.products.forEach((p) => {
          const codeKey = p.product_code ? String(p.product_code).trim() : "";
          const idKey = String(p.id).trim();
          const kn = (codeKey && knowledgeMap.get(codeKey)) || knowledgeMap.get(idKey);

          const { product, diag } = mapDbProductToPublic(p, overrideByNo, kn, canViewPartnerPrices);
          mappedProducts.push(product);
          diagList.push(diag);
        });

        setProducts(mappedProducts);
        logCatalogParityDiagnostics(diagList);

        if (dbResult.brands.length > 0) setBrands(dbResult.brands);
        if (dbResult.categories.length > 0) {
          setCategories(
            dbResult.categories.map((c) => ({
              id: c.id,
              name: c.name,
              brandId: c.brand_id,
            })),
          );
        }
      } else {
        throw new Error("No DB products returned from public catalog DB");
      }
    } catch {
      // Fallback to static PRODUCTS + overrideByNo (matching Admin mergedProducts)
      const mappedProducts: PublicProduct[] = [];
      const diagList: DiagItem[] = [];

      PRODUCTS.forEach((p) => {
        const kn = knowledgeMap.get(String(p.id));
        const { product, diag } = mapStaticProductToPublic(
          p,
          overrideByNo,
          CATEGORIES,
          kn,
          canViewPartnerPrices,
        );
        mappedProducts.push(product);
        diagList.push(diag);
      });

      setProducts(mappedProducts);
      logCatalogParityDiagnostics(diagList);

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
  }, [canViewPartnerPrices]);

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
    canViewPartnerPrices,
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
