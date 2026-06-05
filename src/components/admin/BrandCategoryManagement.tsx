import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit2, Loader2, RefreshCw, FolderOpen, Layers, Package } from "lucide-react";
import { ProductVariantManagement } from "./ProductVariantManagement";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMStatusBadge } from "@/components/crm/CRMStatusBadge";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";
import { CRMLoadingState } from "@/components/crm/CRMLoadingState";
import { CRMTableWrapper } from "@/components/crm/CRMTableWrapper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  code: string;
  description: string | null;
  logo_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface CategoryRow {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// Helper to normalize slug to lowercase-kebab-case
export const normalizeSlug = (val: string) => {
  return (
    val
      .toLowerCase()
      .trim()
      // Remove accents/diacritics
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Replace spaces & non-alphanumeric chars with hyphen
      .replace(/[^a-z0-9]+/g, "-")
      // Remove trailing/leading hyphens
      .replace(/(^-|-$)+/g, "")
  );
};

// Helper to normalize code to UPPERCASE alphanumeric
export const normalizeCode = (val: string) => {
  return val
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_-]+/g, "");
};

// Pure helper to compute next sort order based on current categories
export const computeNextSortOrder = (currentCategories: { sort_order: number }[]): number => {
  if (currentCategories.length === 0) return 10;
  const maxSort = currentCategories.reduce(
    (max, c) => (c.sort_order > max ? c.sort_order : max),
    0,
  );
  return maxSort + 10;
};

// Pure helper to normalize/validate sort_order input values
export const normalizeSortOrder = (val: string | number, fallbackVal = 10): number => {
  const parsed = typeof val === "string" ? parseInt(val.trim(), 10) : val;
  if (isNaN(parsed) || parsed < 0) return fallbackVal;
  return parsed;
};

export const BrandCategoryManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("brands");

  // Brands data
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({});

  // Categories data
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // Dialog states
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);
  const [brandForm, setBrandForm] = useState({
    name: "",
    slug: "",
    code: "",
    description: "",
    logo_url: "",
    sort_order: "0",
    is_active: true,
  });

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    brand_id: "",
    name: "",
    slug: "",
    description: "",
    sort_order: "0",
    is_active: true,
  });

  const [submitting, setSubmitting] = useState(false);

  // Status Filter State
  const [brandStatusFilter, setBrandStatusFilter] = useState<"active" | "inactive" | "all">(
    "active",
  );

  // Quick Deactivate Confirmation State
  const [deactivatingBrand, setDeactivatingBrand] = useState<BrandRow | null>(null);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  // Normalize Category Sort Dialog State
  const [normalizeDialogOpen, setNormalizeDialogOpen] = useState(false);

  const filteredBrands = useMemo(() => {
    return brands.filter((b) => {
      if (brandStatusFilter === "active") return b.is_active;
      if (brandStatusFilter === "inactive") return !b.is_active;
      return true;
    });
  }, [brands, brandStatusFilter]);

  const selectableBrands = useMemo(() => {
    return brands.filter((b) => {
      if (brandStatusFilter === "all" || brandStatusFilter === "inactive") {
        return true;
      }
      return b.is_active;
    });
  }, [brands, brandStatusFilter]);

  // Reset selectedBrandId if current brand is deactivated and filtered out
  useEffect(() => {
    if (brands.length === 0) return;
    const isCurrentBrandSelectable = selectableBrands.some((b) => b.id === selectedBrandId);
    if (!isCurrentBrandSelectable) {
      const activeBrands = brands.filter((b) => b.is_active);
      const fallbackBrand = activeBrands[0] || selectableBrands[0];
      if (fallbackBrand) {
        setSelectedBrandId(fallbackBrand.id);
        loadCategories(fallbackBrand.id);
      } else {
        setSelectedBrandId("");
        setCategories([]);
      }
    }
  }, [brands, brandStatusFilter, selectedBrandId, selectableBrands]);

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch brands
      const { data: brandsData, error: brandsError } = await supabase
        .from("product_brands")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (brandsError) throw brandsError;
      setBrands(brandsData || []);

      const desembre = brandsData?.find((b: BrandRow) => b.slug === "desembre");

      // Pre-select first brand for category view if not selected
      if (brandsData && brandsData.length > 0 && !selectedBrandId) {
        // Find Desembre or default to first
        setSelectedBrandId(desembre ? desembre.id : brandsData[0]?.id || "");
      }

      // 2. Fetch active product counts for brands & categories
      const { data: prodData, error: prodError } = await supabase
        .from("catalog_products")
        .select("brand_id, category_id")
        .eq("status", "active");

      if (!prodError && prodData) {
        const bCounts: Record<string, number> = {};
        const cCounts: Record<string, number> = {};
        prodData.forEach((p: { brand_id: string | null; category_id: string | null }) => {
          if (p.brand_id) bCounts[p.brand_id] = (bCounts[p.brand_id] || 0) + 1;
          if (p.category_id) cCounts[p.category_id] = (cCounts[p.category_id] || 0) + 1;
        });
        setBrandCounts(bCounts);
        setCategoryCounts(cCounts);
      }

      // 3. Load categories for selected brand
      if (selectedBrandId || (brandsData && brandsData.length > 0)) {
        const brandIdToFetch =
          selectedBrandId || (desembre ? desembre.id : brandsData[0]?.id || "");
        if (brandIdToFetch) {
          await loadCategories(brandIdToFetch);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error("Không thể tải danh mục: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async (brandId: string) => {
    try {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("brand_id", brandId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error("Không thể tải danh mục sản phẩm: " + errorMsg);
    }
  };

  const handleBrandSelectChange = async (brandId: string) => {
    setSelectedBrandId(brandId);
    await loadCategories(brandId);
  };

  // Helpers are now exported as pure functions above

  // Dialog open handlers
  const openAddBrand = () => {
    setEditingBrand(null);
    setBrandForm({
      name: "",
      slug: "",
      code: "",
      description: "",
      logo_url: "",
      sort_order: "0",
      is_active: true,
    });
    setBrandDialogOpen(true);
  };

  const openEditBrand = (brand: BrandRow) => {
    setEditingBrand(brand);
    setBrandForm({
      name: brand.name,
      slug: brand.slug,
      code: brand.code,
      description: brand.description || "",
      logo_url: brand.logo_url || "",
      sort_order: String(brand.sort_order),
      is_active: brand.is_active,
    });
    setBrandDialogOpen(true);
  };

  const openAddCategory = () => {
    if (!selectedBrandId) {
      toast.error("Vui lòng chọn một thương hiệu trước.");
      return;
    }
    setEditingCategory(null);
    const nextSort = computeNextSortOrder(categories);
    setCategoryForm({
      brand_id: selectedBrandId,
      name: "",
      slug: "",
      description: "",
      sort_order: String(nextSort),
      is_active: true,
    });
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (cat: CategoryRow) => {
    setEditingCategory(cat);
    setCategoryForm({
      brand_id: cat.brand_id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || "",
      sort_order: String(cat.sort_order),
      is_active: cat.is_active,
    });
    setCategoryDialogOpen(true);
  };

  // CRUD submit handlers
  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Local validation
    if (!brandForm.name.trim()) {
      toast.error("Tên thương hiệu không được bỏ trống hoặc toàn khoảng trắng.");
      return;
    }
    const cleanSlug = normalizeSlug(brandForm.slug);
    if (!cleanSlug) {
      toast.error("Slug (Đường dẫn) không hợp lệ hoặc toàn khoảng trắng.");
      return;
    }
    const cleanCode = normalizeCode(brandForm.code);
    if (!cleanCode) {
      toast.error("Mã code không hợp lệ hoặc toàn khoảng trắng.");
      return;
    }

    setSubmitting(true);

    try {
      const activeProducts = brandCounts[editingBrand?.id || ""] || 0;

      // Business Rule: Disable brand deactivation if it has active products
      if (editingBrand && !brandForm.is_active && activeProducts > 0) {
        toast.error(
          "Không thể tạm ngưng brand đang có sản phẩm hoạt động. Vui lòng lưu trữ/tạm ngưng sản phẩm trước.",
        );
        setSubmitting(false);
        return;
      }

      // Business Rule: Warning/Block slug/code editing if brand has active products
      if (editingBrand && activeProducts > 0) {
        if (editingBrand.slug !== cleanSlug || editingBrand.code !== cleanCode) {
          toast.error(
            "Thương hiệu đang có sản phẩm hoạt động. Không cho phép thay đổi mã (code) hoặc đường dẫn (slug) để tránh đứt gãy dữ liệu.",
          );
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        name: brandForm.name.trim(),
        slug: cleanSlug,
        code: cleanCode,
        description: brandForm.description.trim() || null,
        logo_url: brandForm.logo_url.trim() || null,
        sort_order: parseInt(brandForm.sort_order, 10) || 0,
        is_active: brandForm.is_active,
        updated_at: new Date().toISOString(),
      };

      let error = null;

      if (editingBrand) {
        const { error: editErr } = await supabase
          .from("product_brands")
          .update(payload)
          .eq("id", editingBrand.id);
        error = editErr;
      } else {
        const { error: addErr } = await supabase.from("product_brands").insert({
          ...payload,
          created_at: new Date().toISOString(),
        });
        error = addErr;
      }

      if (error) {
        // Postgrest Duplicate check (code 23505)
        if (error.code === "23505") {
          throw new Error(
            "Mã thương hiệu (code) hoặc Đường dẫn (slug) đã tồn tại. Vui lòng chọn giá trị khác.",
          );
        }
        throw error;
      }

      toast.success(
        editingBrand ? "Cập nhật thương hiệu thành công!" : "Tạo thương hiệu thành công!",
      );
      setBrandDialogOpen(false);
      await loadAllData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error("Lỗi: " + errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Local validation
    if (!categoryForm.brand_id) {
      toast.error("Thương hiệu liên kết là bắt buộc.");
      return;
    }
    if (!categoryForm.name.trim()) {
      toast.error("Tên danh mục không được bỏ trống hoặc toàn khoảng trắng.");
      return;
    }
    const cleanSlug = normalizeSlug(categoryForm.slug);
    if (!cleanSlug) {
      toast.error("Slug (Đường dẫn) không hợp lệ hoặc toàn khoảng trắng.");
      return;
    }

    const rawSortVal = categoryForm.sort_order.trim();
    if (rawSortVal !== "" && parseInt(rawSortVal, 10) < 0) {
      toast.error("Thứ tự hiển thị không được là số âm.");
      return;
    }

    setSubmitting(true);

    try {
      const activeProducts = categoryCounts[editingCategory?.id || ""] || 0;

      // Business Rule: Disable category deactivation if it has active products
      if (editingCategory && !categoryForm.is_active && activeProducts > 0) {
        toast.error(
          `Danh mục đang có ${activeProducts} sản phẩm hoạt động. Không thể tắt hoạt động danh mục.`,
        );
        setSubmitting(false);
        return;
      }

      const fallbackSort = computeNextSortOrder(categories);
      const cleanSortOrder = normalizeSortOrder(categoryForm.sort_order, fallbackSort);

      const payload = {
        brand_id: categoryForm.brand_id,
        name: categoryForm.name.trim(),
        slug: cleanSlug,
        description: categoryForm.description.trim() || null,
        sort_order: cleanSortOrder,
        is_active: categoryForm.is_active,
        updated_at: new Date().toISOString(),
      };

      let error = null;

      if (editingCategory) {
        const { error: editErr } = await supabase
          .from("product_categories")
          .update(payload)
          .eq("id", editingCategory.id);
        error = editErr;
      } else {
        const { error: addErr } = await supabase.from("product_categories").insert({
          ...payload,
          created_at: new Date().toISOString(),
        });
        error = addErr;
      }

      if (error) {
        if (error.code === "23505") {
          throw new Error(
            "Đường dẫn (slug) danh mục đã tồn tại trong thương hiệu này. Vui lòng thay đổi.",
          );
        }
        throw error;
      }

      toast.success(editingCategory ? "Cập nhật danh mục thành công!" : "Tạo danh mục thành công!");
      setCategoryDialogOpen(false);
      await loadCategories(selectedBrandId);
      // Reload product count maps
      const { data: prodData } = await supabase
        .from("catalog_products")
        .select("brand_id, category_id")
        .eq("status", "active");
      if (prodData) {
        const bCounts: Record<string, number> = {};
        const cCounts: Record<string, number> = {};
        prodData.forEach((p: { brand_id: string | null; category_id: string | null }) => {
          if (p.brand_id) bCounts[p.brand_id] = (bCounts[p.brand_id] || 0) + 1;
          if (p.category_id) cCounts[p.category_id] = (cCounts[p.category_id] || 0) + 1;
        });
        setBrandCounts(bCounts);
        setCategoryCounts(cCounts);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error("Lỗi: " + errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDeactivate = (brand: BrandRow) => {
    setDeactivatingBrand(brand);
    setConfirmDeactivateOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!deactivatingBrand) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("product_brands")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deactivatingBrand.id);

      if (error) throw error;

      toast.success(`Đã tạm ngưng thương hiệu "${deactivatingBrand.name}"`);
      setConfirmDeactivateOpen(false);
      setDeactivatingBrand(null);
      await loadAllData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error("Lỗi khi tạm ngưng thương hiệu: " + errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const openNormalizeCategorySort = () => {
    if (!selectedBrandId) {
      toast.error("Vui lòng chọn một thương hiệu trước.");
      return;
    }
    setNormalizeDialogOpen(true);
  };

  const confirmNormalizeCategorySort = async () => {
    if (!selectedBrandId) return;
    setSubmitting(true);
    try {
      // 1. Sort local categories by sort_order ASC, then name ASC
      const sorted = [...categories].sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.name.localeCompare(b.name, "vi");
      });

      // 2. Update sequential order (10, 20, 30...) for selected brand only
      for (let i = 0; i < sorted.length; i++) {
        const cat = sorted[i];
        const newSort = (i + 1) * 10;
        const { error } = await supabase
          .from("product_categories")
          .update({
            sort_order: newSort,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cat.id);

        if (error) throw error;
      }

      toast.success("Chuẩn hóa thứ tự danh mục thành công!");
      setNormalizeDialogOpen(false);
      await loadCategories(selectedBrandId);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error("Lỗi khi chuẩn hóa thứ tự: " + errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-10">
        <CRMLoadingState type="table" rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-3">
          <TabsList className="bg-slate-100/80 p-1 rounded-xl">
            <TabsTrigger
              value="brands"
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
            >
              <Layers className="w-4 h-4 mr-2" /> Thương hiệu (Brands)
            </TabsTrigger>
            <TabsTrigger
              value="categories"
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
            >
              <FolderOpen className="w-4 h-4 mr-2" /> Danh mục (Categories)
            </TabsTrigger>
            <TabsTrigger
              value="products"
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
            >
              <Package className="w-4 h-4 mr-2" /> Sản phẩm & Biến thể
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllData}
              className="h-10 px-3 rounded-xl border-slate-200 hover:bg-slate-50 text-xs font-bold"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Làm mới
            </Button>
            {activeTab === "brands" && (
              <Button
                onClick={openAddBrand}
                className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" /> THÊM THƯƠNG HIỆU
              </Button>
            )}
            {activeTab === "categories" && (
              <div className="flex gap-2">
                <Button
                  onClick={openNormalizeCategorySort}
                  variant="outline"
                  className="h-10 px-3 rounded-xl border-amber-200 hover:bg-amber-50 text-amber-600 font-bold text-xs bg-white"
                >
                  CHUẨN HÓA THỨ TỰ
                </Button>
                <Button
                  onClick={openAddCategory}
                  className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" /> THÊM DANH MỤC
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* BRANDS CONTENT */}
        <TabsContent value="brands" className="mt-6">
          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0">
              Trạng thái thương hiệu:
            </Label>
            <div className="w-64">
              <Select
                value={brandStatusFilter}
                onValueChange={(val: "active" | "inactive" | "all") => setBrandStatusFilter(val)}
              >
                <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-sm font-medium">
                  <SelectValue placeholder="Lọc trạng thái" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200">
                  <SelectItem value="active" className="text-sm">
                    Đang hoạt động
                  </SelectItem>
                  <SelectItem value="inactive" className="text-sm">
                    Tạm ngưng
                  </SelectItem>
                  <SelectItem value="all" className="text-sm">
                    Tất cả
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <CRMCard className="p-0 overflow-hidden border-slate-200">
            {filteredBrands.length === 0 ? (
              <div className="p-10">
                <CRMEmptyState title="Không tìm thấy thương hiệu nào phù hợp" />
              </div>
            ) : (
              <CRMTableWrapper>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-4 text-left w-20">Thứ tự</th>
                      <th className="px-6 py-4 text-left">Tên thương hiệu</th>
                      <th className="px-6 py-4 text-left">Mã Code</th>
                      <th className="px-6 py-4 text-left">Đường dẫn (Slug)</th>
                      <th className="px-6 py-4 text-center">SP hoạt động</th>
                      <th className="px-6 py-4 text-center">Trạng thái</th>
                      <th className="px-6 py-4 text-center w-24">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBrands.map((b) => {
                      const prodCount = brandCounts[b.id] || 0;
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-slate-400">
                            {b.sort_order}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-bold text-slate-800">{b.name}</div>
                              {b.description && (
                                <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                                  {b.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">
                            {b.code}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{b.slug}</td>
                          <td className="px-6 py-4 text-center font-bold text-slate-600">
                            {prodCount}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <CRMStatusBadge
                              variant={b.is_active ? "success" : "neutral"}
                              label={b.is_active ? "Hoạt động" : "Tạm ngưng"}
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditBrand(b)}
                                className="h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                                title="Chỉnh sửa"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {b.is_active && prodCount === 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickDeactivate(b)}
                                  className="h-8 px-2.5 rounded-lg border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-bold text-xs"
                                >
                                  Tạm ngưng
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CRMTableWrapper>
            )}
          </CRMCard>
        </TabsContent>

        {/* CATEGORIES CONTENT */}
        <TabsContent value="categories" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0">
                Thương hiệu:
              </Label>
              <div className="w-64">
                <Select value={selectedBrandId} onValueChange={handleBrandSelectChange}>
                  <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-sm font-medium">
                    <SelectValue placeholder="Chọn thương hiệu" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    {selectableBrands.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-sm">
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <CRMCard className="p-0 overflow-hidden border-slate-200">
              {!selectedBrandId ? (
                <div className="p-10">
                  <CRMEmptyState title="Vui lòng chọn một thương hiệu để xem danh mục" />
                </div>
              ) : categories.length === 0 ? (
                <div className="p-10">
                  <CRMEmptyState title="Chưa có danh mục nào cho thương hiệu này" />
                </div>
              ) : (
                <CRMTableWrapper>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-4 text-left w-20">Vị trí</th>
                        <th className="px-6 py-4 text-left">Tên danh mục</th>
                        <th className="px-6 py-4 text-left">Đường dẫn (Slug)</th>
                        <th className="px-6 py-4 text-center">SP hoạt động</th>
                        <th className="px-6 py-4 text-center">Trạng thái</th>
                        <th className="px-6 py-4 text-center w-24">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.map((c, idx) => {
                        const prodCount = categoryCounts[c.id] || 0;
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-bold text-slate-800">{c.name}</div>
                                {c.description && (
                                  <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                                    {c.description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{c.slug}</td>
                            <td className="px-6 py-4 text-center font-bold text-slate-600">
                              {prodCount}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <CRMStatusBadge
                                variant={c.is_active ? "success" : "neutral"}
                                label={c.is_active ? "Hoạt động" : "Tạm ngưng"}
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditCategory(c)}
                                className="h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CRMTableWrapper>
              )}
            </CRMCard>
          </div>
        </TabsContent>

        {/* PRODUCTS & VARIANTS CONTENT */}
        <TabsContent value="products" className="mt-6">
          <ProductVariantManagement brands={selectableBrands} categories={categories} />
        </TabsContent>
      </Tabs>

      {/* BRAND FORM DIALOG */}
      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md w-[95%] border-slate-200">
          <form onSubmit={handleBrandSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900">
                {editingBrand ? "CHỈNH SỬA THƯƠNG HIỆU" : "THÊM THƯƠNG HIỆU MỚI"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="b-name" className="text-xs font-bold text-slate-500">
                  Tên thương hiệu <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="b-name"
                  value={brandForm.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBrandForm((prev) => ({
                      ...prev,
                      name: val,
                      // Auto-fill slug if not editing or slug is untouched
                      slug: editingBrand ? prev.slug : normalizeSlug(val),
                    }));
                  }}
                  className="h-10 rounded-xl border-slate-200 text-sm font-medium"
                  placeholder="Ví dụ: Desembre, Dermagarden..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="b-code" className="text-xs font-bold text-slate-500">
                    Mã Code <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="b-code"
                    value={brandForm.code}
                    onChange={(e) =>
                      setBrandForm((prev) => ({ ...prev, code: normalizeCode(e.target.value) }))
                    }
                    className="h-10 rounded-xl border-slate-200 font-mono text-sm font-bold uppercase"
                    placeholder="Ví dụ: DESEMBRE"
                    disabled={!!(editingBrand && (brandCounts[editingBrand.id] || 0) > 0)}
                    required
                  />
                  {editingBrand && (brandCounts[editingBrand.id] || 0) > 0 && (
                    <span className="text-[9px] text-slate-400 font-medium">
                      Đang có SP hoạt động. Khóa sửa code.
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="b-slug" className="text-xs font-bold text-slate-500">
                    Đường dẫn (Slug) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="b-slug"
                    value={brandForm.slug}
                    onChange={(e) =>
                      setBrandForm((prev) => ({ ...prev, slug: normalizeSlug(e.target.value) }))
                    }
                    className="h-10 rounded-xl border-slate-200 font-mono text-sm"
                    placeholder="Ví dụ: desembre"
                    disabled={!!(editingBrand && (brandCounts[editingBrand.id] || 0) > 0)}
                    required
                  />
                  {editingBrand && (brandCounts[editingBrand.id] || 0) > 0 && (
                    <span className="text-[9px] text-slate-400 font-medium">
                      Đang có SP hoạt động. Khóa sửa slug.
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="b-desc" className="text-xs font-bold text-slate-500">
                  Mô tả thương hiệu
                </Label>
                <Textarea
                  id="b-desc"
                  value={brandForm.description}
                  onChange={(e) =>
                    setBrandForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="rounded-xl border-slate-200 text-sm min-h-[60px]"
                  placeholder="Nhập mô tả ngắn..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="b-logo" className="text-xs font-bold text-slate-500">
                  URL ảnh đại diện / Logo
                </Label>
                <Input
                  id="b-logo"
                  value={brandForm.logo_url}
                  onChange={(e) => setBrandForm((prev) => ({ ...prev, logo_url: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 text-sm"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              {(() => {
                const activeProducts = editingBrand ? brandCounts[editingBrand.id] || 0 : 0;
                const showReuseGuidance = !editingBrand || activeProducts === 0;
                return (
                  <>
                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="b-active" className="text-xs font-bold text-slate-700">
                            Hiển thị trong catalog
                          </Label>
                          <p className="text-[10px] text-slate-400 font-medium leading-normal">
                            {brandForm.is_active
                              ? "Kích hoạt để hiển thị thương hiệu trên catalog và bộ lọc chọn sản phẩm."
                              : "Brand sẽ bị ẩn khỏi catalog bán hàng và các filter chọn sản phẩm."}
                          </p>
                        </div>
                        <Switch
                          id="b-active"
                          checked={brandForm.is_active}
                          onCheckedChange={(checked) =>
                            setBrandForm((prev) => ({ ...prev, is_active: checked }))
                          }
                          disabled={activeProducts > 0}
                        />
                      </div>
                      {activeProducts > 0 && (
                        <p className="text-[10px] text-rose-500 font-bold leading-tight mt-1">
                          Không thể tạm ngưng brand đang có sản phẩm hoạt động. Vui lòng lưu trữ/tạm
                          ngưng sản phẩm trước.
                        </p>
                      )}
                    </div>

                    {showReuseGuidance && (
                      <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-[11px] text-amber-700 font-medium leading-normal">
                        <span className="font-bold text-amber-600 block mb-0.5">
                          Gợi ý tái sử dụng:
                        </span>
                        Thương hiệu này chưa có sản phẩm. Bạn có thể đổi tên, mã code và đường dẫn
                        (slug) để tái sử dụng cho thương hiệu mới.
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="b-sort" className="text-xs font-bold text-slate-500">
                        Thứ tự hiển thị
                      </Label>
                      <Input
                        id="b-sort"
                        type="number"
                        value={brandForm.sort_order}
                        onChange={(e) =>
                          setBrandForm((prev) => ({ ...prev, sort_order: e.target.value }))
                        }
                        className="h-10 rounded-xl border-slate-200 text-sm"
                        required
                      />
                    </div>
                  </>
                );
              })()}
            </div>

            <DialogFooter className="gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBrandDialogOpen(false)}
                className="h-11 rounded-xl text-xs font-bold text-slate-600 flex-1 sm:flex-initial"
              >
                HỦY
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex-1 sm:flex-initial"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang xử lý...
                  </>
                ) : (
                  "LƯU THƯƠNG HIỆU"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CATEGORY FORM DIALOG */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md w-[95%] border-slate-200">
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900">
                {editingCategory ? "CHỈNH SỬA DANH MỤC" : "THÊM DANH MỤC MỚI"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-brand" className="text-xs font-bold text-slate-500">
                  Thương hiệu chủ quản
                </Label>
                <Input
                  id="c-brand"
                  value={brands.find((b) => b.id === categoryForm.brand_id)?.name || ""}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 cursor-not-allowed"
                  disabled
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-name" className="text-xs font-bold text-slate-500">
                  Tên danh mục <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="c-name"
                  value={categoryForm.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategoryForm((prev) => ({
                      ...prev,
                      name: val,
                      slug: editingCategory ? prev.slug : normalizeSlug(val),
                    }));
                  }}
                  className="h-10 rounded-xl border-slate-200 text-sm font-medium"
                  placeholder="Ví dụ: Cleanser, Toner..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-slug" className="text-xs font-bold text-slate-500">
                  Đường dẫn (Slug) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="c-slug"
                  value={categoryForm.slug}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, slug: normalizeSlug(e.target.value) }))
                  }
                  className="h-10 rounded-xl border-slate-200 font-mono text-sm"
                  placeholder="Ví dụ: cleanser"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-desc" className="text-xs font-bold text-slate-500">
                  Mô tả danh mục
                </Label>
                <Textarea
                  id="c-desc"
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="rounded-xl border-slate-200 text-sm min-h-[60px]"
                  placeholder="Nhập mô tả ngắn..."
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <Label htmlFor="c-active" className="text-xs font-bold text-slate-700">
                    Kích hoạt hoạt động
                  </Label>
                  <p className="text-[10px] text-slate-400 font-medium leading-none">
                    Tạm dừng sẽ ẩn danh mục trên Catalog
                  </p>
                </div>
                <Switch
                  id="c-active"
                  checked={categoryForm.is_active}
                  onCheckedChange={(checked) =>
                    setCategoryForm((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-sort" className="text-xs font-bold text-slate-500">
                  Thứ tự hiển thị
                </Label>
                <Input
                  id="c-sort"
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({ ...prev, sort_order: e.target.value }))
                  }
                  className="h-10 rounded-xl border-slate-200 text-sm"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
                className="h-11 rounded-xl text-xs font-bold text-slate-600 flex-1 sm:flex-initial"
              >
                HỦY
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex-1 sm:flex-initial"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang xử lý...
                  </>
                ) : (
                  "LƯU DANH MỤC"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QUICK DEACTIVATE CONFIRM DIALOG */}
      <Dialog open={confirmDeactivateOpen} onOpenChange={setConfirmDeactivateOpen}>
        <DialogContent className="rounded-2xl max-w-sm w-[95%] border-slate-200">
          <div className="space-y-4 pt-2">
            <h3 className="text-base font-black text-slate-900 uppercase">Xác nhận tạm ngưng</h3>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              Brand này chưa có sản phẩm. Bạn có muốn tạm ngưng để ẩn khỏi catalog không?
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmDeactivateOpen(false);
                  setDeactivatingBrand(null);
                }}
                className="h-10 rounded-xl text-xs font-bold text-slate-600 flex-1"
              >
                HỦY
              </Button>
              <Button
                type="button"
                onClick={confirmDeactivate}
                disabled={submitting}
                className="h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex-1"
              >
                {submitting ? "ĐANG XỬ LÝ..." : "ĐỒNG Ý"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* NORMALIZE CATEGORY SORT CONFIRM DIALOG */}
      <Dialog open={normalizeDialogOpen} onOpenChange={setNormalizeDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm w-[95%] border-slate-200">
          <div className="space-y-4 pt-2">
            <h3 className="text-base font-black text-slate-900 uppercase">Chuẩn hóa thứ tự</h3>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              Hệ thống sẽ chuẩn hóa thứ tự danh mục của brand hiện tại thành 10, 20, 30... Không
              thay đổi tên, slug hay sản phẩm. Bạn có đồng ý không?
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNormalizeDialogOpen(false)}
                className="h-10 rounded-xl text-xs font-bold text-slate-600 flex-1"
              >
                HỦY
              </Button>
              <Button
                type="button"
                onClick={confirmNormalizeCategorySort}
                disabled={submitting}
                className="h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex-1"
              >
                {submitting ? "ĐANG XỬ LÝ..." : "ĐỒNG Ý"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
