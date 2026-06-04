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
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMTableWrapper } from "@/components/crm/CRMTableWrapper";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";

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
  const [vatOn, setVatOn] = useState(false);
  const [saleViewMode, setSaleViewMode] = useState(false);
  const [cart, setCart] = useState<{ no: number; sizeType: "retail" | "salon" }[]>([]);
  const [selectedKnowledgeProductId, setSelectedKnowledgeProductId] = useState<number | null>(null);
  const navigate = useNavigate();
  const isManager = isAdmin || roles.some((r) => ["admin", "sub_admin"].includes(r));

  useEffect(() => {
    fetchOverrides();
  }, []);

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
      if (o?.deleted) return;

      list.push({
        ...p,
        name: o?.name ?? p.name,
        description: o?.desc ?? p.description,
        categoryId: o?.section ?? p.categoryId,
        imageUrl: o?.image_url ?? p.imageUrl,
        pdfUrl: o?.link_url,
        // Sync variants with overrides
        variants: p.variants.map((v) => {
          if (v.type === "retail") {
            return { ...v, price: o?.retail_price ?? v.price, size: o?.retail_size ?? v.size };
          }
          if (v.type === "salon") {
            return { ...v, price: o?.salon_price ?? v.price, size: o?.salon_size ?? v.size };
          }
          return v;
        }),
      });
    });

    // Add custom products
    Object.values(overrides).forEach((o) => {
      if (!o.is_custom || o.deleted) return;
      list.push({
        id: o.no,
        name: o.name ?? "(Sản phẩm mới)",
        description: o.desc ?? "",
        categoryId: o.section ?? "OTHER",
        imageUrl: o.image_url ?? undefined,
        pdfUrl: o.link_url,
        variants: [
          ...(o.retail_price != null
            ? [
                {
                  id: `${o.no}-retail`,
                  type: "retail",
                  size: o.retail_size ?? "",
                  price: o.retail_price,
                },
              ]
            : []),
          ...(o.salon_price != null
            ? [
                {
                  id: `${o.no}-salon`,
                  type: "salon",
                  size: o.salon_size ?? "",
                  price: o.salon_price,
                },
              ]
            : []),
        ],
        isCustom: true,
      });
    });

    return list;
  }, [overrides]);

  const filteredProducts = useMemo(() => {
    return mergedProducts.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === "all" || p.categoryId === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [mergedProducts, searchQuery, categoryFilter]);

  const fmt = (n: number) => {
    // Determine the role to use for pricing
    const isFieldStaff = roles.some((r) => ["sale", "tele_lead", "telesale"].includes(r));
    const primaryFieldRole = roles.find((r) => ["sale", "tele_lead", "telesale"].includes(r));

    // If admin and saleViewMode is ON, use 'sale' role to show 60% price
    // If field staff, they always see their discounted price
    const effectiveRole = isAdmin && saleViewMode ? "sale" : primaryFieldRole || userRole;

    const price = getDisplayPrice(n, vatOn ? "with" : "without", effectiveRole as UserRole);
    return new Intl.NumberFormat("vi-VN").format(Math.round(price || 0)) + "đ";
  };

  const handleUpdate = (id: number, field: string, value: any) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, no: id },
    }));
  };

  const handlePick = (no: number, sizeType: "retail" | "salon") => {
    setCart((prev) => [...prev, { no, sizeType }]);
    toast.success("Đã thêm vào giỏ nháp");
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
          badgeText="ADMIN ONLY"
          icon={LayoutGrid}
          actions={
            <>
              <PDFDownloadLink
                document={
                  <FullCatalogPDF
                    products={mergedProducts}
                    vatOn={vatOn}
                    vatRate={vatRate}
                    role={isAdmin && saleViewMode ? "sale" : undefined}
                  />
                }
                fileName={`Desembre_Catalog_${new Date().toISOString().slice(0, 10)}.pdf`}
              >
                {({ loading }) => (
                  <Button
                    variant="outline"
                    className="h-10 px-4 rounded-xl font-bold text-xs shrink-0 bg-white"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Xuất PDF
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

            <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar w-full pb-1 lg:pb-0">
              <div className="flex items-center gap-1.5 shrink-0 px-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Phân loại:
                </span>
              </div>
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap
                    ${categoryFilter === "all" ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200"}`}
              >
                Tất cả
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap
                      ${categoryFilter === cat.id ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

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
                  <div
                    className={`w-10 h-5 rounded-full p-1 transition-all duration-300 relative ${vatOn ? "bg-blue-600" : "bg-slate-300"}`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 absolute top-1 ${vatOn ? "left-6" : "left-1"}`}
                    />
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase transition-colors ${vatOn ? "text-indigo-600" : "text-slate-400"}`}
                  >
                    Có VAT ({Math.round(vatRate * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* DATA TABLE - ELITE GLASSMORPHISM STYLE */}
          <CRMCard className="rounded-2xl border-none shadow-sm bg-transparent lg:bg-white overflow-hidden relative p-0 lg:p-0">
            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <CRMTableWrapper className="max-h-[calc(100vh-250px)] overflow-y-auto relative">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-20 bg-white shadow-sm ring-1 ring-slate-100">
                  <tr className="bg-slate-50/95 backdrop-blur-sm text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    <th className="px-6 py-4 text-left w-16 whitespace-nowrap">No.</th>
                    <th className="px-6 py-4 text-left w-28 whitespace-nowrap">Visual</th>
                    <th className="px-6 py-4 text-left min-w-[250px]">Sản phẩm & Mô tả</th>
                    <th className="px-6 py-4 text-center w-32 whitespace-nowrap">Size</th>
                    <th className="px-6 py-4 text-right w-44 whitespace-nowrap">Retail Consumer</th>
                    <th className="px-6 py-4 text-right w-44 whitespace-nowrap">Salon Consumer</th>
                    <th className="px-6 py-4 text-center w-32 whitespace-nowrap">Catalog</th>
                    <th className="px-6 py-4 text-center w-20 whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
                            Đang đồng bộ dữ liệu Cloud...
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-20 text-center">
                        <CRMEmptyState title="Không tìm thấy sản phẩm nào phù hợp" />
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const retail = p.variants.find((v: any) => v.type === "retail");
                      const salon = p.variants.find((v: any) => v.type === "salon");

                      return (
                        <tr
                          key={p.id}
                          className={`group transition-all duration-300 ${idx % 2 === 0 ? "bg-slate-50/60" : "bg-white"} hover:bg-blue-50/60`}
                        >
                          <td className="px-6 py-5 text-center">
                            <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <ProductImageCell
                              productNo={p.id}
                              src={p.imageUrl}
                              onChange={(src) => handleUpdate(p.id, "image_url", src)}
                              isReadOnly={!isManager}
                            />
                          </td>
                          <td className="px-6 py-5 max-w-md">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <h3 className="text-[15px] font-black text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                                  {p.name}
                                </h3>
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
                                  SKU: DES-{p.id}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
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
                                <button
                                  onClick={() => handlePick(p.id, "retail")}
                                  className="w-full h-8 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-[10px] text-blue-600 font-bold uppercase hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                                >
                                  CHỌN LÊN ĐƠN
                                </button>
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
                                <button
                                  onClick={() => handlePick(p.id, "salon")}
                                  className="w-full h-8 flex items-center justify-center rounded-lg bg-white border border-violet-200 text-[10px] text-violet-600 font-bold uppercase hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all shadow-sm"
                                >
                                  CHỌN LÊN ĐƠN
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-6 text-center">
                            <ProductLinkCell
                              productNo={p.id}
                              href={p.pdfUrl}
                              onChange={(url) => handleUpdate(p.id, "link_url", url)}
                              isReadOnly={!isManager}
                            />
                          </td>
                              <td className="px-6 py-6 text-center flex items-center justify-end gap-2 h-full min-h-[120px]">
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
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[15px] font-black text-slate-900 leading-tight">
                              {p.name}
                            </h3>
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
                              SKU: DES-{p.id}
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
                            <button
                              onClick={() => handlePick(p.id, "retail")}
                              className="w-full min-h-[44px] mt-2 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-[11px] text-blue-600 font-bold uppercase hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95 touch-manipulation"
                            >
                              CHỌN
                            </button>
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
                            <button
                              onClick={() => handlePick(p.id, "salon")}
                              className="w-full min-h-[44px] mt-2 flex items-center justify-center rounded-lg bg-white border border-violet-200 text-[11px] text-violet-600 font-bold uppercase hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all shadow-sm active:scale-95 touch-manipulation"
                            >
                              CHỌN
                            </button>
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
                        <div className="w-24">
                          <ProductLinkCell
                            productNo={p.id}
                            href={p.pdfUrl}
                            onChange={(url) => handleUpdate(p.id, "link_url", url)}
                            isReadOnly={!isManager}
                          />
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
                {mergedProducts.length} sản phẩm
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
          productName={mergedProducts.find((p) => p.id === selectedKnowledgeProductId)?.name || ""}
          productsList={mergedProducts.map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setSelectedKnowledgeProductId(null)}
          onSaved={() => {
            // Optional: Reload logic here if we were caching knowledge state in this parent component,
            // but since dialog fetches on mount, it's already fresh next time it opens.
          }}
        />
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
