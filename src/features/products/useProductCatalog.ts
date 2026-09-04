import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { CATEGORIES, PRODUCTS } from "@/data/products";
import type { Product } from "@/types/product";
import { getDisplayPrice, UserRole } from "@/lib/pricing";
import { toast } from "sonner";
import {
  fetchActiveDBCatalog,
  mapDbCatalogToProduct,
  checkLegacyOrderability,
} from "@/lib/catalogDb";
import { validateDbCartItem } from "@/lib/orders";
import type { CartItemAny, SalesSheetInfo } from "./types";

// ── Local interfaces ──────────────────────────────────────────────────────

interface DbBrand {
  id: string;
  name: string;
  code: string;
  slug: string;
}

interface DbCategory {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
}

interface ProductOverride {
  no: number;
  name?: string;
  image_url?: string;
  link_url?: string;
  retail_price?: number;
  retail_size?: string;
  salon_price?: number;
  salon_size?: string;
  is_custom?: boolean;
}

/** Catalog product passed to the Sales Sheet dialog. */
interface SalesSheetProduct {
  dbId?: string;
  name: string;
  brand_id?: string;
  categoryName?: string | null;
  imageUrl?: string;
  product_code?: string | null;
}

/** One row from product_sales_sheets. */
interface SalesSheetRow {
  id: string;
  catalog_product_id: string;
  status: "draft" | "approved" | "archived";
  is_current: boolean | null;
  version: number | null;
  created_at: string | null;
}

const PAGE_SIZE = 20;

const isProduction = window.location.hostname === "hub.desembre-vn.com";

function parseEnvFlag(val: unknown, defaultNonProd: boolean): boolean {
  if (val === undefined || val === null) {
    return !isProduction ? defaultNonProd : false;
  }
  const clean = String(val).trim().toLowerCase();
  if (clean === "true") return true;
  if (clean === "false") return false;
  if (clean.includes("vite_product_")) {
    return !isProduction ? defaultNonProd : false;
  }
  return !isProduction ? defaultNonProd : false;
}

export function useProductCatalog() {
  const { user, isAdmin, roles } = useAuth();
  const { vatRate } = useSystemSettings();
  const navigate = useNavigate();

  const userRole = roles[0] || "user";
  const isManager = isAdmin || roles.some((r) => ["admin", "sub_admin"].includes(r));

  // Feature flags (stable across renders — computed from env at module level)
  const isDbAdminEnabled = parseEnvFlag(import.meta.env.VITE_PRODUCT_DB_ADMIN_ENABLED, true);
  const isCatalogDbReadEnabled = parseEnvFlag(
    import.meta.env.VITE_PRODUCT_CATALOG_DB_READ_ENABLED,
    true,
  );
  const isProductDbOrderEnabled = parseEnvFlag(import.meta.env.VITE_PRODUCT_DB_ORDER_ENABLED, true);

  // ── Core state ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("catalog");

  // Legacy overrides
  const [overrides, setOverrides] = useState<Record<number, ProductOverride>>({});

  // DB catalog data
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbBrands, setDbBrands] = useState<DbBrand[]>([]);
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [dbError, setDbError] = useState(false);
  const [dbErrorMessage, setDbErrorMessage] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("all");
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);

  // UI state
  const [vatOn, setVatOn] = useState(false);
  const [saleViewMode, setSaleViewMode] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItemAny[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  // Knowledge dialog state
  const [selectedKnowledgeProductId, setSelectedKnowledgeProductId] = useState<number | null>(null);

  // Sales sheet state
  const [salesSheetsMap, setSalesSheetsMap] = useState<Record<string, SalesSheetInfo>>({});
  const [salesSheetDialogOpen, setSalesSheetDialogOpen] = useState(false);
  const [selectedSalesSheetProduct, setSelectedSalesSheetProduct] =
    useState<SalesSheetProduct | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isUsingDbCatalogData = isCatalogDbReadEnabled && !dbError;

  const primaryFieldRole = useMemo(() => {
    if (roles.includes("sale")) return "sale";
    if (roles.includes("telesale")) return "telesale";
    return null;
  }, [roles]);

  // ── Data loaders ─────────────────────────────────────────────────────────

  /** Task 10: select only required columns from product_sales_sheets */
  const loadSalesSheets = useCallback(async (shouldThrow = false) => {
    try {
      const { data, error } = await supabase
        .from("product_sales_sheets")
        .select("id, catalog_product_id, status, is_current, version, created_at");
      if (error) {
        if (shouldThrow) throw error;
        else console.error("Error loading sales sheets map:", error);
      }
      if (data) {
        const map: Record<string, SalesSheetInfo> = {};

        // Group by catalog_product_id
        const groups: Record<string, SalesSheetRow[]> = {};
        (data as SalesSheetRow[]).forEach((row) => {
          if (!groups[row.catalog_product_id]) {
            groups[row.catalog_product_id] = [];
          }
          groups[row.catalog_product_id].push(row);
        });

        // Resolve current/latest version for each product group client-side
        Object.keys(groups).forEach((prodId) => {
          const rows = groups[prodId];
          // 1. Try to find the row with is_current = true
          let selected = rows.find((r) => r.is_current === true);

          if (!selected) {
            // 2. Fallback: Sort by version desc, then created_at desc
            selected = [...rows].sort((a, b) => {
              const versionA = typeof a.version === "number" ? a.version : 1;
              const versionB = typeof b.version === "number" ? b.version : 1;
              if (versionA !== versionB) {
                return versionB - versionA;
              }
              const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return dateB - dateA;
            })[0];
          }

          if (selected) {
            map[prodId] = { id: selected.id, status: selected.status };
          }
        });

        setSalesSheetsMap(map);
      }
    } catch (err) {
      if (shouldThrow) throw err;
      console.error("Error loading sales sheets map:", err);
    }
  }, []);

  const loadDBCatalog = useCallback(async () => {
    setLoading(true);
    setDbError(false);
    setDbErrorMessage(null);
    try {
      const dbCatalog = await fetchActiveDBCatalog();
      if (!dbCatalog || dbCatalog.length === 0) {
        throw new Error("No active products returned from DB");
      }

      const mapped = dbCatalog.map(mapDbCatalogToProduct);
      setDbProducts(mapped);

      const { data: brandsData, error: brandsError } = await supabase
        .from("product_brands")
        .select("id, name, code, slug")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (brandsError) throw brandsError;

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("product_categories")
        .select("id, name, slug, brand_id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (categoriesError) throw categoriesError;

      setDbBrands(brandsData || []);
      setDbCategories(categoriesData || []);
      await loadSalesSheets();
    } catch (e) {
      console.error("[products] DB Catalog fetch error, falling back:", e);
      setDbError(true);
      setDbErrorMessage(e instanceof Error ? e.message : String(e));
      toast.error("Không thể kết nối Catalog DB, sử dụng dữ liệu mặc định");
      fetchOverrides();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSalesSheets]);

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("product_overrides").select("*");
      if (error) throw error;

      const map: Record<number, ProductOverride> = {};
      ((data || []) as ProductOverride[]).forEach((r) => {
        map[r.no] = r;
      });
      setOverrides(map);
    } catch (e) {
      console.warn("Using local overrides fallback", e);
      const local = localStorage.getItem("mock_overrides");
      if (local) {
        const data = JSON.parse(local) as ProductOverride[];
        const map: Record<number, ProductOverride> = {};
        data.forEach((r) => {
          map[r.no] = r;
        });
        setOverrides(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isCatalogDbReadEnabled) {
      loadDBCatalog();
    } else {
      fetchOverrides();
      loadSalesSheets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCatalogDbReadEnabled]);

  // ── Merged / filtered products ───────────────────────────────────────────
  const mergedProducts = useMemo(() => {
    const list: Product[] = [];
    PRODUCTS.forEach((p) => {
      const o = overrides[p.id];
      const variants = p.variants.map((v) => {
        let price = v.price;
        let size = v.size;
        if (o) {
          if (v.type === "retail") {
            if (o.retail_price != null) price = o.retail_price;
            if (o.retail_size != null) size = o.retail_size;
          } else {
            if (o.salon_price != null) price = o.salon_price;
            if (o.salon_size != null) size = o.salon_size;
          }
        }
        return { ...v, price, size };
      });
      list.push({
        ...p,
        name: o?.name || p.name,
        imageUrl: o?.image_url || p.imageUrl,
        pdfUrl: o?.link_url || p.pdfUrl,
        variants,
      });
    });
    return list;
  }, [overrides]);

  const productsToFilter = useMemo(() => {
    if (isUsingDbCatalogData) return dbProducts;
    return mergedProducts;
  }, [isUsingDbCatalogData, dbProducts, mergedProducts]);

  /** Task 4: normalize search query once */
  const searchQueryNorm = useMemo(() => searchQuery.toLowerCase().trim(), [searchQuery]);

  const filteredProducts = useMemo(() => {
    return productsToFilter.filter((p) => {
      const matchSearch =
        !searchQueryNorm ||
        p.name.toLowerCase().includes(searchQueryNorm) ||
        (p.description && p.description.toLowerCase().includes(searchQueryNorm));
      const matchBrand =
        !isUsingDbCatalogData ||
        selectedBrandFilter === "all" ||
        p.brand_id === selectedBrandFilter;
      const matchCategory = categoryFilter === "all" || p.categoryId === categoryFilter;
      return matchSearch && matchBrand && matchCategory;
    });
  }, [
    productsToFilter,
    searchQueryNorm,
    selectedBrandFilter,
    categoryFilter,
    isUsingDbCatalogData,
  ]);

  /** Task 6: when brand = all show all dbCategories; when brand selected, filter by brand */
  const activeCategoriesToDisplay = useMemo(() => {
    if (isUsingDbCatalogData) {
      if (selectedBrandFilter === "all") {
        return dbCategories; // show all, not empty
      }
      return dbCategories.filter((c) => c.brand_id === selectedBrandFilter);
    }
    return CATEGORIES;
  }, [isUsingDbCatalogData, dbCategories, selectedBrandFilter]);

  // ── Pagination ───────────────────────────────────────────────────────────
  /** Reset to page 1 when any filter changes (Task 3) */
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBrandFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  const goToPrev = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);
  const goToNext = useCallback(
    () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
    [totalPages],
  );
  const goToPage = useCallback(
    (p: number) => setCurrentPage(Math.max(1, Math.min(totalPages, p))),
    [totalPages],
  );

  // ── Price formatter ───────────────────────────────────────────────────────
  const fmt = useCallback(
    (n: number) => {
      const effectiveRole = isAdmin && saleViewMode ? "sale" : primaryFieldRole || userRole;
      const price = getDisplayPrice(n, vatOn ? "with" : "without", effectiveRole as UserRole);
      return new Intl.NumberFormat("vi-VN").format(Math.round(price || 0)) + "đ";
    },
    [isAdmin, saleViewMode, primaryFieldRole, userRole, vatOn],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBrandChange = useCallback((val: string) => {
    setSelectedBrandFilter(val);
    setCategoryFilter("all");
    setIsCategoryExpanded(false);
  }, []);

  const handleUpdate = useCallback((id: number, field: string, value: unknown) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, no: id },
    }));
  }, []);

  const handlePick = useCallback(
    (p: Product, sizeType: "retail" | "salon") => {
      if (isUsingDbCatalogData && isProductDbOrderEnabled) {
        const variant = p.variants.find((v) => v.type === sizeType);
        if (!variant) {
          toast.error("Không tìm thấy biến thể sản phẩm trong DB");
          return;
        }
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
          channel: sizeType,
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
        if (!check.ok) {
          toast.error(`Dữ liệu sản phẩm DB không hợp lệ: ${check.reason}`);
          return;
        }
        setCart((prev) => [...prev, dbItem]);
      } else {
        setCart((prev) => [...prev, { no: p.id, sizeType }]);
      }
      toast.success("Đã thêm vào giỏ nháp");
      setCartDrawerOpen(true);
    },
    [isUsingDbCatalogData, isProductDbOrderEnabled],
  );

  const removeCartItem = useCallback((idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const handleCreateOrder = useCallback(() => {
    sessionStorage.setItem("pickupCart", JSON.stringify(cart));
    navigate({ to: "/orders/new" });
  }, [cart, navigate]);

  // ── Computed guard for a product ──────────────────────────────────────────
  const getProductGuard = useCallback(
    (p: Product) => {
      const retail = p.variants.find((v) => v.type === "retail");
      const salon = p.variants.find((v) => v.type === "salon");

      if (isCatalogDbReadEnabled && !dbError) {
        if (isProductDbOrderEnabled) {
          return { retailOrderable: !!retail, salonOrderable: !!salon };
        }
        return checkLegacyOrderability(p);
      }
      return { retailOrderable: true, salonOrderable: true };
    },
    [isCatalogDbReadEnabled, dbError, isProductDbOrderEnabled],
  );

  return {
    // Auth / roles
    user,
    isAdmin,
    roles,
    isManager,
    vatRate,
    // Feature flags
    isDbAdminEnabled,
    isCatalogDbReadEnabled,
    isProductDbOrderEnabled,
    isUsingDbCatalogData,
    // Loading / error
    loading,
    dbError,
    dbErrorMessage,
    // Tab
    activeTab,
    setActiveTab,
    // Products
    productsToFilter,
    filteredProducts,
    paginatedProducts,
    dbBrands,
    dbCategories,
    activeCategoriesToDisplay,
    // Filters
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    selectedBrandFilter,
    isCategoryExpanded,
    setIsCategoryExpanded,
    handleBrandChange,
    // VAT / view
    vatOn,
    setVatOn,
    saleViewMode,
    setSaleViewMode,
    fmt,
    // Cart
    cart,
    cartDrawerOpen,
    setCartDrawerOpen,
    removeCartItem,
    clearCart,
    handleCreateOrder,
    // Knowledge dialog
    selectedKnowledgeProductId,
    setSelectedKnowledgeProductId,
    // Sales sheet
    salesSheetsMap,
    salesSheetDialogOpen,
    setSalesSheetDialogOpen,
    selectedSalesSheetProduct,
    setSelectedSalesSheetProduct,
    loadSalesSheets,
    // Data mutation
    handleUpdate,
    handlePick,
    getProductGuard,
    // Pagination
    currentPage,
    totalPages,
    goToPrev,
    goToNext,
    goToPage,
    PAGE_SIZE,
  };
}
