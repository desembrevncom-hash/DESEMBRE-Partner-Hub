/* eslint-disable */
// @ts-nocheck
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES, PRODUCTS } from "@/data/products";
import type { Product, Category, ProductVariant } from "@/types/product";
import {
  Search,
  Filter,
  Plus,
  Download,
  FileText,
  MoreVertical,
  ArrowLeft,
  Sparkles,
  Zap,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
  Loader2,
  Trash2,
  Edit2,
  LayoutGrid,
  List,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ProductImageCell from "@/components/ProductImageCell";
import ProductLinkCell from "@/components/ProductLinkCell";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { FullCatalogPDF } from "@/components/FullCatalogPDF";
import { EditUnlockProvider } from "@/hooks/useEditUnlock";
import { getDisplayPrice, UserRole } from "@/lib/pricing";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { ProductKnowledgeDialog } from "@/components/ProductKnowledgeDialog";
import { ProductSalesSheetDialog } from "@/components/admin/templates/ProductSalesSheetDialog";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMTableWrapper } from "@/components/crm/CRMTableWrapper";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandCategoryManagement } from "@/components/admin/BrandCategoryManagement";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchActiveDBCatalog,
  mapDbCatalogToProduct,
  checkLegacyOrderability,
} from "@/lib/catalogDb";
import { validateDbCartItem } from "@/lib/orders";

export const Route = createFileRoute("/admin/products")({
  component: ProductCatalogPage,
});

function ProductCatalogPage() {
  const { user, isAdmin, roles } = useAuth();
  const { vatRate } = useSystemSettings();
  const userRole = roles[0] || "user";
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, any>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [vatOn, setVatOn] = useState(false);
  const [saleViewMode, setSaleViewMode] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [selectedKnowledgeProductId, setSelectedKnowledgeProductId] = useState<number | null>(null);
  const [salesSheetsMap, setSalesSheetsMap] = useState<Record<string, { id: string; status: 'draft' | 'approved' | 'archived' }>>({});
  const [salesSheetDialogOpen, setSalesSheetDialogOpen] = useState(false);
  const [selectedSalesSheetProduct, setSelectedSalesSheetProduct] = useState<any | null>(null);
  const navigate = useNavigate();
  const isManager = isAdmin || roles.some((r) => ["admin", "sub_admin"].includes(r));

  const isDbAdminEnabled = 
    String(import.meta.env.VITE_PRODUCT_DB_ADMIN_ENABLED).trim() === "true" ||
    String(import.meta.env.VITE_PRODUCT_DB_ADMIN_ENABLED).trim() === "VITE_PRODUCT_DB_ADMIN_ENABLED";
  const isCatalogDbReadEnabled = 
    String(import.meta.env.VITE_PRODUCT_CATALOG_DB_READ_ENABLED).trim() === "true" ||
    String(import.meta.env.VITE_PRODUCT_CATALOG_DB_READ_ENABLED).trim() === "VITE_PRODUCT_CATALOG_DB_READ_ENABLED";
  const isProductDbOrderEnabled = 
    String(import.meta.env.VITE_PRODUCT_DB_ORDER_ENABLED).trim() === "true" ||
    String(import.meta.env.VITE_PRODUCT_DB_ORDER_ENABLED).trim() === "VITE_PRODUCT_DB_ORDER_ENABLED";

  // DB Catalog States
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbBrands, setDbBrands] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("all");
  const [dbError, setDbError] = useState(false);
  const [dbErrorMessage, setDbErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("catalog");

  const isUsingDbCatalogData = isCatalogDbReadEnabled && !dbError;

  const primaryFieldRole = useMemo(() => {
    if (roles.includes("sale")) return "sale";
    if (roles.includes("telesale")) return "telesale";
    return null;
  }, [roles]);

  useEffect(() => {
    if (isCatalogDbReadEnabled) {
      loadDBCatalog();
    } else {
      fetchOverrides();
    }
    loadSalesSheets();
  }, [isCatalogDbReadEnabled]);

  const loadSalesSheets = async (shouldThrow = false) => {
    try {
      const { data, error } = await supabase
        .from("product_sales_sheets")
        .select("id, catalog_product_id, status");
      if (error) {
        if (shouldThrow) throw error;
        else console.error("Error loading sales sheets map:", error);
      }
      if (data) {
        const map: Record<string, { id: string; status: 'draft' | 'approved' | 'archived' }> = {};
        data.forEach((row: any) => {
          map[row.catalog_product_id] = { id: row.id, status: row.status };
        });
        setSalesSheetsMap(map);
      }
    } catch (err) {
      if (shouldThrow) throw err;
      console.error("Error loading sales sheets map:", err);
    }
  };

  const loadDBCatalog = async () => {
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
  };

  const fetchOverrides = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("product_overrides").select("*");
      if (error) throw error;

      const map: Record<number, any> = {};
      (data || []).forEach((r) => {
        map[r.no] = r;
      });
      setOverrides(map);
    } catch (e) {
      console.warn("Using local overrides fallback", e);
      const local = localStorage.getItem("mock_overrides");
      if (local) {
        const data = JSON.parse(local);
        const map: Record<number, any> = {};
        data.forEach((r: any) => {
          map[r.no] = r;
        });
        setOverrides(map);
      }
    } finally {
      setLoading(false);
    }
  };

  const mergedProducts = useMemo(() => {
    const list: any[] = [];

    // Add static products with overrides
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
    if (isUsingDbCatalogData) {
      return dbProducts;
    }
    return mergedProducts;
  }, [isUsingDbCatalogData, dbProducts, mergedProducts]);

  const filteredProducts = useMemo(() => {
    return productsToFilter.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBrand =
        !isUsingDbCatalogData ||
        selectedBrandFilter === "all" ||
        p.brand_id === selectedBrandFilter;
      const matchCategory = categoryFilter === "all" || p.categoryId === categoryFilter;
      return matchSearch && matchBrand && matchCategory;
    });
  }, [productsToFilter, searchQuery, selectedBrandFilter, categoryFilter, isUsingDbCatalogData]);

  const activeCategoriesToDisplay = useMemo(() => {
    if (isUsingDbCatalogData) {
      if (selectedBrandFilter === "all") {
        return [];
      }
      return dbCategories.filter((c) => c.brand_id === selectedBrandFilter);
    }
    return selectedBrandFilter === "all" ? [] : CATEGORIES;
  }, [isUsingDbCatalogData, dbCategories, selectedBrandFilter]);

  const fmt = (n: number) => {
    const effectiveRole = isAdmin && saleViewMode ? "sale" : primaryFieldRole || userRole;
    const price = getDisplayPrice(n, vatOn ? "with" : "without", effectiveRole as UserRole);
    return new Intl.NumberFormat("vi-VN").format(Math.round(price || 0)) + "đ";
  };

  const handleBrandChange = (val: string) => {
    setSelectedBrandFilter(val);
    setCategoryFilter("all");
    setIsCategoryExpanded(false);
  };

  const handleUpdate = (id: number, field: string, value: any) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, no: id },
    }));
  };

  const handlePick = (p: Product, sizeType: "retail" | "salon") => {
    if (isUsingDbCatalogData && isProductDbOrderEnabled) {
      const variant = p.variants.find((v) => v.type === sizeType);
      if (!variant) {
        toast.error("Không tìm thấy biến thể sản phẩm trong DB");
        return;
      }
      const dbItem = {
        source: "db_catalog",
        catalog_product_id: p.dbId,
        variant_id: variant.id,
        brand_id: p.brand_id,
        brand_name: p.brand_name,
        brand_code: p.brand_code,
        product_code: p.product_code || null,
        sku: variant.sku,
        product_name: p.name,
        category_name: p.categoryName || null,
        channel: sizeType,
        size_label: variant.size || null,
        unit_price: variant.price,
        currency: "VND",
        image_url: p.imageUrl || null,
        catalog_url: p.pdfUrl || null,
        inventory_tracking_enabled: false,
        stock_policy: "untracked",
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
  };

  const renderSalesSheetCell = (p: any) => {
    if (p.isDbProduct && p.dbId) {
      const sheetInfo = salesSheetsMap[p.dbId];
      if (isManager) {
        if (!sheetInfo) {
          return (
            <Button
              onClick={() => {
                setSelectedSalesSheetProduct(p);
                setSalesSheetDialogOpen(true);
              }}
              variant="outline"
              className="h-8 px-2.5 rounded-lg border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-[10px] font-bold"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Tạo AI Sheet
            </Button>
          );
        }
        return (
          <Button
            onClick={() => {
              setSelectedSalesSheetProduct(p);
              setSalesSheetDialogOpen(true);
            }}
            variant="outline"
            className={`h-8 px-2.5 rounded-lg text-[10px] font-bold ${
              sheetInfo.status === "approved"
                ? "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                : "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
            }`}
          >
            <FileText className="w-3 h-3 mr-1" />
            Sheet ({sheetInfo.status === "approved" ? "Duyệt" : "Nháp"})
          </Button>
        );
      } else {
        if (!sheetInfo || sheetInfo.status !== "approved") {
          return <span className="text-xs text-slate-400 font-medium">Chưa có tài liệu</span>;
        }
        return (
          <Button
            onClick={() => {
              setSelectedSalesSheetProduct(p);
              setSalesSheetDialogOpen(true);
            }}
            variant="outline"
            className="h-8 px-3 rounded-lg border-green-200 text-green-700 bg-green-50 hover:bg-green-100 text-[10px] font-bold"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Sales Sheet
          </Button>
        );
      }
    }

    // Fallback for legacy static products
    return (
      <ProductLinkCell
        productNo={p.id}
        href={p.pdfUrl}
        onChange={(url) => handleUpdate(p.id, "link_url", url)}
        isReadOnly={!isManager}
      />
    );
  };

  const handleCreateOrder = () => {
    sessionStorage.setItem("pickupCart", JSON.stringify(cart));
    navigate({ to: "/orders/new" });
  };

  return (
    <EditUnlockProvider>
      <CRMPageContainer>
        <CRMPageHeader
          title="Danh Mục Sản Phẩm (Product Catalog)"
          subtitle="Master Catalog v4.0"
          badgeText={isUsingDbCatalogData ? "Catalog DB Preview" : "ADMIN ONLY"}
          icon={LayoutGrid}
          actions={
            <>
              <PDFDownloadLink
                document={
                  <FullCatalogPDF
                    products={productsToFilter}
                    vatOn={vatOn}
                    vatRate={vatRate}
                    role={isAdmin && saleViewMode ? "sale" : undefined}
                  />
                }
                fileName="DESEMBRE_Master_Catalog.pdf"
              >
                {({ loading: pdfLoading }) => (
                  <Button
                    variant="outline"
                    className="h-10 px-5 rounded-xl border-slate-200 hover:bg-slate-50 text-xs font-bold transition-all shadow-3xs"
                    disabled={pdfLoading}
                  >
                    <Download className="w-4 h-4 mr-2 text-slate-500" />
                    {pdfLoading ? "Đang chuẩn bị PDF..." : "Tải Catalog PDF"}
                  </Button>
                )}
              </PDFDownloadLink>
              {isManager && (
                <Button className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-200 transition-all shrink-0">
                  <Plus className="w-4 h-4 mr-2 shrink-0" /> THÊM SẢN PHẨM
                </Button>
              )}
            </>
          }
        />

        <main className="container mx-auto px-6 py-8 max-w-7xl space-y-8 animate-fade-in">
          {!isCatalogDbReadEnabled && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs font-semibold flex flex-col gap-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-amber-950">Feature Flags Missing (Catalog DB is Disabled)</span>
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                Biến môi trường <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-amber-800">VITE_PRODUCT_CATALOG_DB_READ_ENABLED</code> chưa được cấu hình hoặc bằng <code className="font-mono">false</code> ở thời điểm build trên Vercel. 
                Hệ thống bắt buộc chạy ở chế độ <strong>Legacy Fallback (Danh mục tĩnh cũ)</strong>. Hãy thêm biến môi trường và chạy redeploy lại Vercel.
              </p>
            </div>
          )}

          {isCatalogDbReadEnabled && dbError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-semibold flex flex-col gap-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-bold text-rose-900">Database Connection Failed</span>
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                Không thể kết nối hoặc truy vấn dữ liệu từ Supabase Staging. Hệ thống tự động chuyển sang chế độ dự phòng tĩnh (Legacy Fallback).
              </p>
              <div className="bg-rose-100/50 p-2 rounded font-mono text-[10px] text-rose-900 pl-6 border border-rose-200/50 mt-1 whitespace-pre-wrap">
                Chi tiết lỗi: {dbErrorMessage || "Không có thông báo lỗi cụ thể"}
              </div>
            </div>
          )}

          {isDbAdminEnabled && isManager && (
            <div className="flex border-b border-slate-200 pb-1">
              <div className="bg-slate-100/80 p-1 rounded-xl flex gap-1">
                <button
                  onClick={() => setActiveTab("catalog")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${activeTab === "catalog" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Danh mục sản phẩm
                </button>
                <button
                  onClick={() => setActiveTab("mgmt")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${activeTab === "mgmt" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Quản lý Brand & Danh mục
                </button>
              </div>
            </div>
          )}

          {activeTab === "mgmt" && isDbAdminEnabled && isManager ? (
            <BrandCategoryManagement />
          ) : (
            <>
              {isManager && !isDbAdminEnabled && (
                <div className="bg-blue-50/50 text-blue-600 px-4 py-2 rounded-xl text-xs font-medium border border-blue-100 flex items-center gap-2">
                  Danh mục hiện được quản lý cố định trong mã nguồn. Muốn thêm/sửa nhóm cần triển khai phase Category Management riêng.
                </div>
              )}
              {/* FILTERS & SEARCH */}
              <div className="flex flex-col lg:flex-row gap-3 items-center bg-white p-3 lg:p-2 rounded-2xl border border-slate-200 shadow-sm sticky top-16 lg:static z-30">
                <div className="relative group w-full lg:w-1/3 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <Input
                    placeholder="Tìm tên, công dụng..."
                    className="pl-9 h-11 lg:h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium placeholder:text-slate-400 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {isUsingDbCatalogData && (
                  <div className="w-full lg:w-48 shrink-0">
                    <Select value={selectedBrandFilter} onValueChange={handleBrandChange}>
                      <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <SelectValue placeholder="Thương hiệu" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200">
                        <SelectItem value="all" className="text-xs font-bold uppercase">Tất cả thương hiệu</SelectItem>
                        {dbBrands.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-xs font-bold uppercase">{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex-1"></div>

                <div className="flex items-center justify-between lg:justify-end px-1 lg:px-2 shrink-0 w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0">
                  <div className="text-[10px] font-bold text-slate-400 lg:hidden">
                    {filteredProducts.length} KẾT QUẢ
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 lg:py-1.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setVatOn(!vatOn)}>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Hiển thị giá:
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold uppercase transition-colors ${!vatOn ? "text-indigo-600" : "text-slate-400"}`}
                      >
                        Chưa VAT
                      </span>
                      <div className="relative w-7 h-4 bg-slate-200 rounded-full transition-colors duration-200">
                        <div
                          className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${vatOn ? "translate-x-3 bg-indigo-600" : ""}`}
                        />
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase transition-colors ${vatOn ? "text-indigo-600" : "text-slate-400"}`}
                      >
                        Có VAT
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CATEGORY CARD */}
              <CRMCard className="p-4 lg:p-5 border-slate-200 bg-white">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Danh mục sản phẩm</h4>
                      <p className="text-[11px] font-medium text-slate-500">
                        {selectedBrandFilter === "all"
                          ? "Chọn một thương hiệu để lọc theo danh mục."
                          : `Danh mục của ${dbBrands.find((b) => b.id === selectedBrandFilter)?.name || "thương hiệu"}`}
                      </p>
                    </div>
                  </div>

                  {selectedBrandFilter !== "all" && activeCategoriesToDisplay.length === 0 ? (
                    <div className="text-xs text-slate-500 italic mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      Thương hiệu này chưa có danh mục.
                    </div>
                  ) : selectedBrandFilter !== "all" ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={() => setCategoryFilter("all")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border
                            ${categoryFilter === "all" ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50"}`}
                      >
                        Tất cả sản phẩm
                      </button>
                      {(isCategoryExpanded ? activeCategoriesToDisplay : activeCategoriesToDisplay.slice(0, 10)).map((cat) => {
                        const filterValue = isUsingDbCatalogData ? cat.slug : cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setCategoryFilter(filterValue)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border
                                ${categoryFilter === filterValue ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50"}`}
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                      {activeCategoriesToDisplay.length > 10 && (
                        <button
                          onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          {isCategoryExpanded ? "Thu gọn" : `Xem thêm danh mục (+${activeCategoriesToDisplay.length - 10})`}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </CRMCard>

              {/* Product Layout */}
              <CRMCard className="p-0 overflow-hidden border-slate-200 bg-white">
                {/* Desktop view */}
                <div className="hidden lg:block">
                  <CRMTableWrapper>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="px-3 py-4 text-center w-14">STT</th>
                          <th className="px-3 py-4 text-center w-24">Hình ảnh</th>
                          <th className="px-6 py-4 text-left">Sản phẩm</th>
                          <th className="px-3 py-4 text-center w-36">Size</th>
                          <th className="px-6 py-4 text-right w-44">Retail</th>
                          <th className="px-6 py-4 text-right w-44">Salon</th>
                          <th className="px-3 py-4 text-center w-40">Tài liệu</th>
                          <th className="px-3 py-4 text-center w-40">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          <tr>
                            <td colSpan={8} className="py-32 text-center">
                              <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
                                  Đang đồng bộ dữ liệu Cloud...
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-32 text-center">
                              <div className="flex flex-col items-center gap-4 opacity-30">
                                <Zap className="w-16 h-16 text-slate-600" />
                                <p className="text-sm font-bold text-slate-500">
                                  Không tìm thấy sản phẩm nào phù hợp
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((p, idx) => {
                            const retail = p.variants.find((v: any) => v.type === "retail");
                            const salon = p.variants.find((v: any) => v.type === "salon");

                            const guard =
                              isCatalogDbReadEnabled && !dbError
                                ? (isProductDbOrderEnabled
                                    ? { retailOrderable: !!retail, salonOrderable: !!salon }
                                    : checkLegacyOrderability(p))
                                : { retailOrderable: true, salonOrderable: true };

                            return (
                              <tr
                                key={p.id}
                                className={`group transition-all duration-300 ${idx % 2 === 0 ? "bg-slate-50/60" : "bg-white"} hover:bg-blue-50/60`}
                              >
                                <td className="px-3 py-5 text-center">
                                  <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                                    {String(idx + 1).padStart(2, "0")}
                                  </span>
                                </td>
                                <td className="px-3 py-5">
                                  <ProductImageCell
                                    productNo={p.id}
                                    src={p.imageUrl}
                                    onChange={(src) => handleUpdate(p.id, "image_url", src)}
                                    isReadOnly={!isManager}
                                    isDbMode={isUsingDbCatalogData}
                                  />
                                </td>
                                <td className="px-3 py-5 max-w-md">
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="text-[15px] font-black text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                                        {p.name}
                                      </h3>
                                      {isUsingDbCatalogData && p.brand_name && (
                                        <Badge className="bg-indigo-50 text-indigo-600 border-none text-[8px] font-black shrink-0 uppercase">
                                          {p.brand_name}
                                        </Badge>
                                      )}
                                      {p.isCustom && (
                                        <Badge className="bg-amber-50 text-amber-600 border-none text-[8px] font-black shrink-0">
                                          CUSTOM
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                      {p.description || "Chưa có mô tả kỹ thuật cho sản phẩm này."}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] font-bold text-slate-400 border-slate-200 py-0 uppercase bg-white"
                                      >
                                        {CATEGORIES.find((c) => c.id === p.categoryId)?.name || "N/A"}
                                      </Badge>
                                      <span className="text-[10px] text-slate-400 font-mono font-medium">
                                        SKU: {retail?.sku || salon?.sku || `DES-${p.id}`}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-5 text-center">
                                  <div className="space-y-2">
                                    {retail && (
                                      <div className="px-2 py-1 rounded bg-blue-50/80 border border-blue-100 text-[10px] font-black text-blue-700 uppercase">
                                        {retail.size} (R)
                                      </div>
                                    )}
                                    {salon && (
                                      <div className="px-2 py-1 rounded bg-violet-50/80 border border-violet-100 text-[10px] font-black text-violet-700 uppercase">
                                        {salon.size} (S)
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  {retail ? (
                                    <div className="flex flex-col items-end gap-1.5">
                                      <div>
                                        <p className="text-[15px] font-black text-blue-700 tracking-tight leading-none">
                                          {fmt(retail.price)}
                                        </p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                                          NIÊM YẾT LẺ {vatOn ? "(VAT)" : ""}
                                        </p>
                                      </div>
                                      {guard.retailOrderable ? (
                                        <button
                                          onClick={() => handlePick(p, "retail")}
                                          className="w-full h-8 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-[10px] text-blue-600 font-bold uppercase hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                                        >
                                          CHỌN LÊN ĐƠN
                                        </button>
                                      ) : (
                                        <div className="w-full text-center text-[9px] font-bold text-rose-500 bg-rose-50 border border-rose-100 py-1.5 px-2 rounded-lg leading-snug">
                                          {guard.retailMismatchReason || "Khóa lên đơn"}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-5 text-right">
                                  {salon ? (
                                    <div className="flex flex-col items-end gap-1.5">
                                      <div>
                                        <p className="text-[15px] font-black text-violet-700 tracking-tight leading-none">
                                          {fmt(salon.price)}
                                        </p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                                          CHUYÊN NGHIỆP {vatOn ? "(VAT)" : ""}
                                        </p>
                                      </div>
                                      {guard.salonOrderable ? (
                                        <button
                                          onClick={() => handlePick(p, "salon")}
                                          className="w-full h-8 flex items-center justify-center rounded-lg bg-white border border-violet-200 text-[10px] text-violet-600 font-bold uppercase hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all shadow-sm"
                                        >
                                          CHỌN LÊN ĐƠN
                                        </button>
                                      ) : (
                                        <div className="w-full text-center text-[9px] font-bold text-rose-500 bg-rose-50 border border-rose-100 py-1.5 px-2 rounded-lg leading-snug">
                                          {guard.salonMismatchReason || "Khóa lên đơn"}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-6 text-center">
                                  {renderSalesSheetCell(p)}
                                </td>
                                <td className="px-6 py-6 text-center">
                                  <div className="flex items-center justify-end gap-2">
                                    {isManager && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedKnowledgeProductId(p.id)}
                                        className="h-9 px-3 text-[10px] font-black text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 uppercase tracking-wider rounded-xl transition-all whitespace-nowrap"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 mr-1 animate-pulse" /> Tri thức
                                      </Button>
                                    )}
                                    {isManager && <DropdownAction />}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </CRMTableWrapper>
                </div>

                {/* Mobile Card View */}
                <div className="block lg:hidden space-y-4">
                  {loading ? (
                    <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
                          Đang đồng bộ dữ liệu Cloud...
                        </p>
                      </div>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
                      <CRMEmptyState title="Không tìm thấy sản phẩm nào phù hợp" />
                    </div>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const retail = p.variants.find((v: any) => v.type === "retail");
                      const salon = p.variants.find((v: any) => v.type === "salon");

                      const guard =
                        isCatalogDbReadEnabled && !dbError
                          ? (isProductDbOrderEnabled
                              ? { retailOrderable: !!retail, salonOrderable: !!salon }
                              : checkLegacyOrderability(p))
                          : { retailOrderable: true, salonOrderable: true };

                      return (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
                          {/* Product Header */}
                          <div className="flex items-start gap-4">
                            <div className="w-20 h-20 shrink-0">
                              <ProductImageCell
                                productNo={p.id}
                                src={p.imageUrl}
                                onChange={(src) => handleUpdate(p.id, "image_url", src)}
                                isReadOnly={!isManager}
                                isDbMode={isUsingDbCatalogData}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-[15px] font-black text-slate-900 leading-tight">
                                  {p.name}
                                </h3>
                                {isUsingDbCatalogData && p.brand_name && (
                                  <Badge className="bg-indigo-50 text-indigo-600 border-none text-[8px] font-black shrink-0 px-1.5 py-0.5 uppercase">
                                    {p.brand_name}
                                  </Badge>
                                )}
                                {p.isCustom && (
                                  <Badge className="bg-amber-50 text-amber-600 border-none text-[8px] font-black shrink-0 px-1.5 py-0.5">
                                    CUSTOM
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
                                {p.description || "Chưa có mô tả kỹ thuật cho sản phẩm này."}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] font-bold text-slate-400 border-slate-200 py-0 uppercase bg-white"
                                >
                                  {CATEGORIES.find((c) => c.id === p.categoryId)?.name || "N/A"}
                                </Badge>
                                <span className="text-[10px] text-slate-400 font-mono font-medium">
                                  SKU: {retail?.sku || salon?.sku || `DES-${p.id}`}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Blocks */}
                          <div className="grid grid-cols-2 gap-3 mt-1 border-t border-slate-100 pt-4">
                            {/* Retail Block */}
                            {retail ? (
                              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-blue-50/60 border border-blue-100/50 relative">
                                <div className="absolute top-3 right-3">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100/80 text-[9px] font-black text-blue-700 uppercase">
                                    {retail.size} (R)
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Retail
                                </span>
                                <div className="mt-0.5">
                                  <p className="text-[15px] font-black text-blue-700 tracking-tight leading-none">
                                    {fmt(retail.price)}
                                  </p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                                    {vatOn ? "ĐÃ CÓ VAT" : "CHƯA VAT"}
                                  </p>
                                </div>
                                {guard.retailOrderable ? (
                                  <button
                                    onClick={() => handlePick(p, "retail")}
                                    className="w-full min-h-[44px] mt-2 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-[11px] text-blue-600 font-bold uppercase hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95 touch-manipulation"
                                  >
                                    CHỌN
                                  </button>
                                ) : (
                                  <div className="w-full min-h-[44px] mt-2 flex items-center justify-center rounded-lg bg-rose-50 border border-rose-100 text-[9px] text-rose-500 font-bold uppercase px-2 py-1 text-center leading-snug">
                                    {guard.retailMismatchReason || "Khóa lên đơn"}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100 opacity-60 min-h-[120px]">
                                <span className="text-slate-300">—</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Không có Retail</span>
                              </div>
                            )}

                            {/* Salon Block */}
                            {salon ? (
                              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-violet-50/60 border border-violet-100/50 relative">
                                <div className="absolute top-3 right-3">
                                  <span className="px-1.5 py-0.5 rounded bg-violet-100/80 text-[9px] font-black text-violet-700 uppercase">
                                    {salon.size} (S)
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Salon
                                </span>
                                <div className="mt-0.5">
                                  <p className="text-[15px] font-black text-violet-700 tracking-tight leading-none">
                                    {fmt(salon.price)}
                                  </p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                                    {vatOn ? "ĐÃ CÓ VAT" : "CHƯA VAT"}
                                  </p>
                                </div>
                                {guard.salonOrderable ? (
                                  <button
                                    onClick={() => handlePick(p, "salon")}
                                    className="w-full min-h-[44px] mt-2 flex items-center justify-center rounded-lg bg-white border border-violet-200 text-[11px] text-violet-600 font-bold uppercase hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all shadow-sm active:scale-95 touch-manipulation"
                                  >
                                    CHỌN
                                  </button>
                                ) : (
                                  <div className="w-full min-h-[44px] mt-2 flex items-center justify-center rounded-lg bg-rose-50 border border-rose-100 text-[9px] text-rose-500 font-bold uppercase px-2 py-1 text-center leading-snug">
                                    {guard.salonMismatchReason || "Khóa lên đơn"}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100 opacity-60 min-h-[120px]">
                                <span className="text-slate-300">—</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Không có Salon</span>
                              </div>
                            )}
                          </div>

                          {/* Footer Actions */}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                            <div className="flex items-center">
                              {renderSalesSheetCell(p)}
                            </div>
                            <div className="flex items-center gap-2">
                              {isManager && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedKnowledgeProductId(p.id)}
                                  className="min-h-[44px] px-3 text-[10px] font-black text-blue-600 hover:bg-blue-50 uppercase tracking-wider rounded-xl transition-all whitespace-nowrap active:scale-95 touch-manipulation"
                                >
                                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Tri thức
                                </Button>
                              )}
                              {isManager && <DropdownAction />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* FOOTER PAGINATION PLACEHOLDER */}
                <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Hiển thị <span className="text-slate-900">{filteredProducts.length}</span> /{" "}
                    {productsToFilter.length} sản phẩm
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" disabled className="text-[10px] font-black text-slate-400">
                      PREV
                    </Button>
                    <div className="flex items-center gap-1">
                      <button className="w-8 h-8 rounded-lg bg-indigo-600 text-white text-xs font-black">
                        1
                      </button>
                      <button className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 text-xs font-black hover:bg-slate-200 hover:text-slate-900 transition-all">
                        2
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      className="text-[10px] font-black text-slate-500 hover:text-slate-900"
                    >
                      NEXT
                    </Button>
                  </div>
                </div>
              </CRMCard>
            </>
          )}
        </main>

        {/* FLOATING ACTION CART */}
        {cart.length > 0 && (
          <div className="fixed bottom-8 right-8 z-50 animate-fade-in">
            <Button
              onClick={handleCreateOrder}
              className="h-14 px-6 rounded-xl shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold hover:scale-105 transition-all group"
            >
              <ShoppingCart className="w-5 h-5 mr-2 group-hover:-rotate-12 transition-transform" />
              TẠO ĐƠN NHÁP ({cart.length})
            </Button>
          </div>
        )}

        <ProductKnowledgeDialog
          productId={selectedKnowledgeProductId}
          productName={productsToFilter.find((p) => p.id === selectedKnowledgeProductId)?.name || ""}
          productsList={productsToFilter.map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setSelectedKnowledgeProductId(null)}
          onSaved={() => {
            // Optional: Reload logic here if we were caching knowledge state in this parent component,
            // but since dialog fetches on mount, it's already fresh next time it opens.
          }}
        />

        {selectedSalesSheetProduct && (
          <ProductSalesSheetDialog
            isOpen={salesSheetDialogOpen}
            onClose={() => {
              setSalesSheetDialogOpen(false);
              setSelectedSalesSheetProduct(null);
            }}
            catalogProductId={selectedSalesSheetProduct.dbId}
            productName={selectedSalesSheetProduct.name}
            brandId={selectedSalesSheetProduct.brand_id}
            categoryName={selectedSalesSheetProduct.categoryName}
            imageUrl={selectedSalesSheetProduct.imageUrl}
            productCode={selectedSalesSheetProduct.product_code}
            onSaved={loadSalesSheets}
          />
        )}

        {window.location.hostname !== 'hub.desembre-vn.com' && (
          <div className="fixed bottom-4 left-4 z-[9999] bg-slate-900/95 text-slate-100 p-4 rounded-xl border border-slate-700 shadow-2xl text-[11px] font-mono space-y-1.5 max-w-sm backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-2">
              <span className="font-bold text-indigo-400">🔍 STAGING DEBUG CONSOLE</span>
              <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">47310e8</span>
            </div>
            <div>
              <span className="text-slate-400">catalogDbReadEnabled:</span>{" "}
              <span className={isCatalogDbReadEnabled ? "text-green-400 font-bold" : "text-rose-400 font-bold"}>
                {isCatalogDbReadEnabled ? "true" : "false"}
              </span>{" "}
              <span className="text-slate-500 font-normal">
                ({`raw: ${JSON.stringify(import.meta.env.VITE_PRODUCT_CATALOG_DB_READ_ENABLED)}`})
              </span>
            </div>
            <div>
              <span className="text-slate-400">productDbAdminEnabled:</span>{" "}
              <span className={isDbAdminEnabled ? "text-green-400 font-bold" : "text-rose-400 font-bold"}>
                {isDbAdminEnabled ? "true" : "false"}
              </span>{" "}
              <span className="text-slate-500 font-normal">
                ({`raw: ${JSON.stringify(import.meta.env.VITE_PRODUCT_DB_ADMIN_ENABLED)}`})
              </span>
            </div>
            <div>
              <span className="text-slate-400">productDbOrderEnabled:</span>{" "}
              <span className={isProductDbOrderEnabled ? "text-green-400 font-bold" : "text-rose-400 font-bold"}>
                {isProductDbOrderEnabled ? "true" : "false"}
              </span>{" "}
              <span className="text-slate-500 font-normal">
                ({`raw: ${JSON.stringify(import.meta.env.VITE_PRODUCT_DB_ORDER_ENABLED)}`})
              </span>
            </div>
            <div><span className="text-slate-400">userEmail:</span> <span className="text-blue-400">{user?.email || "none"}</span></div>
            <div><span className="text-slate-400">userRoles:</span> <span className="text-blue-400">{JSON.stringify(roles || [])}</span></div>
            <div><span className="text-slate-400">isAdmin:</span> <span className={isAdmin ? "text-green-400 font-bold" : "text-rose-400"}>{isAdmin ? "true" : "false"}</span></div>
            <div><span className="text-slate-400">isManager:</span> <span className={isManager ? "text-green-400 font-bold" : "text-rose-400"}>{isManager ? "true" : "false"}</span></div>
            <div><span className="text-slate-400">usingCatalogDbMode:</span> <span className={isUsingDbCatalogData ? "text-green-400 font-bold" : "text-rose-400 font-bold"}>{isUsingDbCatalogData ? "true" : "false"}</span></div>
            {dbError && (
              <div className="text-rose-300 bg-rose-950/50 p-2 rounded border border-rose-900 mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono text-[9px] leading-relaxed">
                <span className="font-bold">Error:</span> {dbErrorMessage || "Unknown DB fetch error"}
              </div>
            )}
          </div>
        )}
      </CRMPageContainer>
    </EditUnlockProvider>
  );
}

function DropdownAction() {
  return (
    <button className="w-10 h-10 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-all flex items-center justify-center">
      <MoreVertical className="w-4 h-4" />
    </button>
  );
}
