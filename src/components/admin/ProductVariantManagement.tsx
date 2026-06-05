import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Loader2,
  RefreshCw,
  Archive,
  AlertTriangle,
  FolderOpen,
  Layers,
  Check,
  X,
  PlusCircle,
  Eye,
  Info,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveCatalogProduct,
  saveCatalogVariant,
  checkProductInOrders,
  isValidImageUrl,
  isValidHttpUrl,
  normalizeSku,
  hasDuplicateVariant,
} from "@/lib/catalogAdminDb";
import { stableProductSort, computeNextProductSortOrder } from "@/lib/catalogSort";

interface Brand {
  id: string;
  name: string;
  code: string;
  slug: string;
}

interface Category {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
}

interface ProductVariant {
  id: string;
  product_id: string;
  brand_id: string;
  sku: string;
  channel: "retail" | "salon";
  size_label: string | null;
  price: number;
  currency: string;
  inventory_tracking_enabled: boolean;
  stock_policy: string;
  is_active: boolean;
  sort_order: number;
}

interface Product {
  id: string;
  brand_id: string;
  category_id: string | null;
  product_code: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  catalog_url: string | null;
  status: "active" | "inactive" | "archived";
  sort_order: number;
  variants?: ProductVariant[];
}

interface ProductVariantManagementProps {
  brands: Brand[];
  categories: Category[];
}

export const ProductVariantManagement: React.FC<ProductVariantManagementProps> = ({
  brands,
  categories,
}) => {
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories || []);

  useEffect(() => {
    setLocalCategories(categories || []);
  }, [categories]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [panelImageUrl, setPanelImageUrl] = useState("");
  const [panelImageSaving, setPanelImageSaving] = useState(false);

  useEffect(() => {
    if (selectedProduct) {
      setPanelImageUrl(selectedProduct.image_url || "");
    } else {
      setPanelImageUrl("");
    }
  }, [selectedProduct]);

  // Sync selectedProduct with products list changes
  useEffect(() => {
    if (selectedProduct) {
      const updated = products.find((p) => p.id === selectedProduct.id);
      if (updated) {
        setSelectedProduct(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const getVariantsSummary = (p: Product) => {
    const retail = p.variants?.find((v) => v.channel === "retail");
    const salon = p.variants?.find((v) => v.channel === "salon");
    if (retail && salon) return "2 biến thể: Lẻ, Salon";
    if (retail) return "1 biến thể: Lẻ";
    if (salon) return "1 biến thể: Salon";
    return "Chưa có biến thể";
  };

  // Dialog States
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    product_code: "",
    category_id: "",
    description: "",
    image_url: "",
    catalog_url: "",
    status: "active" as "active" | "inactive" | "archived",
    sort_order: "0",
  });

  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [activeParentProduct, setActiveParentProduct] = useState<Product | null>(null);
  const [variantForm, setVariantForm] = useState({
    sku: "",
    channel: "retail" as "retail" | "salon",
    size_label: "",
    price: "0",
    is_active: true,
    sort_order: "0",
  });

  // Archive Confirm State
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [productToArchive, setProductToArchive] = useState<Product | null>(null);
  const [hasOrderHistory, setHasOrderHistory] = useState(false);
  const [checkingOrderHistory, setCheckingOrderHistory] = useState(false);

  // Default Select first active brand or reset if selectedBrandId is no longer in brands prop
  useEffect(() => {
    if (brands.length > 0) {
      if (!selectedBrandId) {
        // Prefer Desembre
        const desembre = brands.find((b) => b.slug === "desembre");
        setSelectedBrandId(desembre ? desembre.id : brands[0].id);
      } else {
        const exists = brands.some((b) => b.id === selectedBrandId);
        if (!exists) {
          const desembre = brands.find((b) => b.slug === "desembre");
          setSelectedBrandId(desembre ? desembre.id : brands[0].id);
        }
      }
    } else {
      setSelectedBrandId("");
    }
  }, [brands, selectedBrandId]);

  // Load products & variants when brand selection changes
  useEffect(() => {
    if (selectedBrandId) {
      loadProductsAndVariants(selectedBrandId);
    }
  }, [selectedBrandId]);

  const loadProductsAndVariants = async (brandId: string) => {
    setLoading(true);
    try {
      // 0. Fetch categories for this brand dynamically to prevent N/A and filter mismatch
      const { data: catData, error: catErr } = await supabase
        .from("product_categories")
        .select("id, brand_id, name, slug")
        .eq("brand_id", brandId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (!catErr && catData) {
        setLocalCategories(catData as Category[]);
      }

      // 1. Fetch catalog products for brand
      const { data: prodData, error: prodErr } = await supabase
        .from("catalog_products")
        .select("*")
        .eq("brand_id", brandId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (prodErr) throw prodErr;
      const loadedProducts = (prodData || []) as Product[];

      if (loadedProducts.length > 0) {
        // 2. Fetch variants for these products
        const productIds = loadedProducts.map((p) => p.id);
        const { data: varData, error: varErr } = await supabase
          .from("catalog_product_variants")
          .select("*")
          .in("product_id", productIds)
          .order("sort_order", { ascending: true });

        if (varErr) throw varErr;
        const loadedVariants = (varData || []) as ProductVariant[];

        // Map variants to their parent products
        const mappedProducts = loadedProducts.map((p) => ({
          ...p,
          variants: loadedVariants.filter((v) => v.product_id === p.id),
        }));

        setProducts(mappedProducts);
      } else {
        setProducts([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Không thể tải danh sách sản phẩm: " + msg);
    } finally {
      setLoading(false);
    }
  };

  // Filter Categories belonging to current Brand
  const brandCategories = useMemo(() => {
    return (localCategories || []).filter((c) => c.brand_id === selectedBrandId);
  }, [localCategories, selectedBrandId]);

  // Filter products in memory
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      const matchCategory = categoryFilter === "all" || p.category_id === categoryFilter;
      return matchCategory;
    });
    return stableProductSort(list);
  }, [products, categoryFilter]);

  // Image/URL change fallback
  const getImageUrlDisplay = (url: string | null) => {
    if (!url) return "/logo.svg";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
      return url;
    }
    return "/logo.svg";
  };

  const handlePanelImageSave = async () => {
    if (!selectedProduct) return;
    const cleanUrl = panelImageUrl.trim();

    if (cleanUrl !== "" && !isValidImageUrl(cleanUrl)) {
      toast.error(
        "Link ảnh không hợp lệ. Phải bắt đầu bằng http/https hoặc là đường dẫn storage hợp lệ.",
      );
      return;
    }

    setPanelImageSaving(true);
    try {
      const { error } = await supabase
        .from("catalog_products")
        .update({ image_url: cleanUrl || null })
        .eq("id", selectedProduct.id);

      if (error) {
        toast.error("Không thể cập nhật ảnh: " + error.message);
      } else {
        toast.success("Cập nhật ảnh sản phẩm thành công!");
        await loadProductsAndVariants(selectedBrandId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Có lỗi xảy ra: " + msg);
    } finally {
      setPanelImageSaving(false);
    }
  };

  const handlePanelImageClear = async () => {
    if (!selectedProduct) return;
    setPanelImageSaving(true);
    try {
      const { error } = await supabase
        .from("catalog_products")
        .update({ image_url: null })
        .eq("id", selectedProduct.id);

      if (error) {
        toast.error("Không thể xóa ảnh: " + error.message);
      } else {
        toast.success("Đã xóa ảnh sản phẩm.");
        setPanelImageUrl("");
        await loadProductsAndVariants(selectedBrandId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Có lỗi xảy ra: " + msg);
    } finally {
      setPanelImageSaving(false);
    }
  };

  // ==========================================
  // Product CRUD
  // ==========================================
  const openAddProduct = () => {
    if (!selectedBrandId) {
      toast.error("Vui lòng chọn một thương hiệu trước.");
      return;
    }
    const nextSortOrder = computeNextProductSortOrder(products);
    setEditingProduct(null);
    setProductForm({
      name: "",
      product_code: "",
      category_id: brandCategories[0]?.id || "",
      description: "",
      image_url: "",
      catalog_url: "",
      status: "active",
      sort_order: String(nextSortOrder),
    });
    setProductDialogOpen(true);
  };

  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      product_code: prod.product_code || "",
      category_id: prod.category_id || "",
      description: prod.description || "",
      image_url: prod.image_url || "",
      catalog_url: prod.catalog_url || "",
      status: prod.status,
      sort_order: String(prod.sort_order),
    });
    setProductDialogOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // 1. Validation
    const cleanName = productForm.name.trim();
    if (!cleanName) {
      toast.error("Tên sản phẩm không được bỏ trống hoặc toàn khoảng trắng.");
      return;
    }

    const cleanCode = productForm.product_code.trim() || null;

    // Check unique product code locally (only for inserts)
    if (!editingProduct && cleanCode) {
      const exists = products.some(
        (p) => p.product_code?.toLowerCase() === cleanCode.toLowerCase(),
      );
      if (exists) {
        toast.error("Mã sản phẩm đã tồn tại trong thương hiệu này. Vui lòng nhập mã khác.");
        return;
      }
    }

    if (productForm.image_url && !isValidImageUrl(productForm.image_url)) {
      toast.error(
        "Link ảnh không hợp lệ. Phải bắt đầu bằng http/https hoặc là đường dẫn storage hợp lệ.",
      );
      return;
    }

    if (productForm.catalog_url && !isValidHttpUrl(productForm.catalog_url)) {
      toast.error(
        "Link Catalog không hợp lệ. Vui lòng nhập URL bắt đầu bằng http:// hoặc https://",
      );
      return;
    }

    // Validate sort_order
    const rawSortOrder = productForm.sort_order.trim();
    let sortOrderNum = 0;
    if (rawSortOrder === "") {
      if (editingProduct) {
        sortOrderNum = editingProduct.sort_order ?? 0;
      } else {
        sortOrderNum = computeNextProductSortOrder(products);
      }
    } else {
      sortOrderNum = Number(rawSortOrder);
      if (isNaN(sortOrderNum) || sortOrderNum < 0) {
        toast.error("Thứ tự hiển thị phải là số lớn hơn hoặc bằng 0.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        id: editingProduct?.id,
        brand_id: selectedBrandId,
        category_id: productForm.category_id || null,
        product_code: cleanCode,
        name: cleanName,
        description: productForm.description || null,
        image_url: productForm.image_url || null,
        catalog_url: productForm.catalog_url || null,
        status: productForm.status,
        sort_order: sortOrderNum,
      };

      const res = await saveCatalogProduct(payload);

      if (res.error) {
        if (res.error.code === "23505") {
          toast.error("Mã sản phẩm đã tồn tại trong thương hiệu này. Vui lòng nhập mã khác.");
        } else {
          toast.error("Không thể lưu sản phẩm: " + res.error.message);
        }
      } else {
        toast.success(
          editingProduct ? "Cập nhật sản phẩm thành công!" : "Thêm sản phẩm thành công!",
        );
        setProductDialogOpen(false);
        await loadProductsAndVariants(selectedBrandId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Có lỗi xảy ra: " + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const initiateArchive = async (prod: Product) => {
    setProductToArchive(prod);
    setCheckingOrderHistory(true);
    setArchiveConfirmOpen(true);
    try {
      const inOrders = await checkProductInOrders(prod.product_code);
      setHasOrderHistory(inOrders);
    } catch (e) {
      setHasOrderHistory(false);
    } finally {
      setCheckingOrderHistory(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!productToArchive) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("catalog_products")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("id", productToArchive.id);

      if (error) {
        toast.error("Không thể lưu trữ sản phẩm: " + error.message);
      } else {
        toast.success("Sản phẩm đã được lưu trữ (Archived) thành công.");
        setArchiveConfirmOpen(false);
        setProductToArchive(null);
        await loadProductsAndVariants(selectedBrandId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Có lỗi xảy ra khi lưu trữ: " + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivateProduct = async (prod: Product) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("catalog_products")
        .update({ status: "active", archived_at: null })
        .eq("id", prod.id);

      if (error) {
        toast.error("Không thể kích hoạt sản phẩm: " + error.message);
      } else {
        toast.success("Sản phẩm đã được kích hoạt thành công.");
        await loadProductsAndVariants(selectedBrandId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Có lỗi xảy ra khi kích hoạt: " + msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // Variant CRUD
  // ==========================================
  const openAddVariant = (parent: Product, channel: "retail" | "salon") => {
    setActiveParentProduct(parent);
    setEditingVariant(null);
    setVariantForm({
      sku: `${parent.product_code || "DES"}-${channel.toUpperCase()}-${new Date().getTime().toString().slice(-4)}`,
      channel: channel,
      size_label: "",
      price: "0",
      is_active: true,
      sort_order: "0",
    });
    setVariantDialogOpen(true);
  };

  const openEditVariant = (parent: Product, variant: ProductVariant) => {
    setActiveParentProduct(parent);
    setEditingVariant(variant);
    setVariantForm({
      sku: variant.sku,
      channel: variant.channel,
      size_label: variant.size_label || "",
      price: String(variant.price),
      is_active: variant.is_active,
      sort_order: String(variant.sort_order),
    });
    setVariantDialogOpen(true);
  };

  const handleVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !activeParentProduct) return;

    // 1. Validation
    const rawSku = variantForm.sku.trim();
    if (!rawSku) {
      toast.error("SKU của biến thể không được bỏ trống.");
      return;
    }
    const cleanSku = normalizeSku(rawSku);
    const cleanSizeLabel = variantForm.size_label.trim();
    const priceNum = Number(variantForm.price);

    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Giá bán phải là số lớn hơn hoặc bằng 0.");
      return;
    }

    // Check duplicate channel + size locally
    const siblings = activeParentProduct.variants || [];
    const hasDuplicate = hasDuplicateVariant(
      siblings,
      variantForm.channel,
      cleanSizeLabel,
      editingVariant?.id,
    );

    if (hasDuplicate) {
      toast.error(
        `Sản phẩm này đã có biến thể ${variantForm.channel.toUpperCase()} với kích thước "${cleanSizeLabel || "Mặc định"}".`,
      );
      return;
    }

    // Check duplicate SKU locally under the active brand
    const brandSkus = products.flatMap((p) => p.variants || []);
    const skuExists = brandSkus.some(
      (v) => v.sku.toUpperCase() === cleanSku && v.id !== editingVariant?.id,
    );

    if (skuExists) {
      toast.error("Mã SKU này đã tồn tại cho thương hiệu này. Vui lòng nhập SKU khác.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: editingVariant?.id,
        product_id: activeParentProduct.id,
        brand_id: activeParentProduct.brand_id,
        sku: cleanSku,
        channel: variantForm.channel,
        size_label: cleanSizeLabel || null,
        price: priceNum,
        is_active: variantForm.is_active,
        sort_order: Number(variantForm.sort_order || 0),
      };

      const res = await saveCatalogVariant(payload);

      if (res.error) {
        if (res.error.code === "23505") {
          toast.error("Mã SKU này đã tồn tại cho thương hiệu này. Vui lòng nhập SKU khác.");
        } else {
          toast.error("Không thể lưu biến thể: " + res.error.message);
        }
      } else {
        toast.success(
          editingVariant ? "Cập nhật biến thể thành công!" : "Thêm biến thể thành công!",
        );
        setVariantDialogOpen(false);
        await loadProductsAndVariants(selectedBrandId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Có lỗi xảy ra: " + msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Brand Select and Category Filter Panel */}
      <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="w-full md:w-64 space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Thương hiệu:
          </Label>
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
            <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-sm font-medium">
              <SelectValue placeholder="Chọn thương hiệu" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200">
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-sm">
                  {b.name} ({b.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-64 space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Bộ lọc danh mục:
          </Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 text-sm font-medium">
              <SelectValue placeholder="Tất cả danh mục" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200">
              <SelectItem value="all" className="text-sm">
                Tất cả
              </SelectItem>
              {brandCategories.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-sm">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 flex justify-end w-full md:w-auto">
          <Button
            onClick={openAddProduct}
            className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm w-full md:w-auto min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-2" /> THÊM SẢN PHẨM MỚI
          </Button>
        </div>
      </div>

      {/* Database Catalog Table */}
      <CRMCard className="p-0 overflow-hidden border-slate-200">
        {loading ? (
          <div className="p-20 text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
              Đang đồng bộ dữ liệu catalog...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-20 text-center">
            <CRMEmptyState title="Không tìm thấy sản phẩm nào trong cơ sở dữ liệu." />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <CRMTableWrapper className="max-h-[calc(100vh-320px)] overflow-y-auto relative">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-4 text-left w-16 min-w-[64px]">Vị trí</th>
                      <th className="px-4 py-4 text-left min-w-[240px]">Sản phẩm</th>
                      <th className="px-4 py-4 text-left w-24 min-w-[96px]">Mã</th>
                      <th className="px-4 py-4 text-left w-32 min-w-[128px]">Danh mục</th>
                      <th className="px-4 py-4 text-left w-28 min-w-[112px]">Trạng thái</th>
                      <th className="px-4 py-4 text-left min-w-[180px]">Biến thể</th>
                      <th className="px-4 py-4 text-center w-32 min-w-[128px]">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p, idx) => {
                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            setSelectedProduct(p);
                            setDetailOpen(true);
                          }}
                          className="hover:bg-slate-50/40 transition-colors align-top cursor-pointer"
                        >
                          {/* 1. Vị trí */}
                          <td className="px-4 py-5 font-mono font-bold text-slate-400 w-16 min-w-[64px]">
                            {idx + 1}
                          </td>

                          {/* 2. Sản phẩm (Image + Name) */}
                          <td className="px-4 py-5 min-w-[240px]">
                            <div className="flex items-center gap-3">
                              <img
                                src={getImageUrlDisplay(p.image_url)}
                                alt={p.name}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = "/logo.svg";
                                }}
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-sm shrink-0"
                              />
                              <div className="font-black text-slate-800 text-sm leading-snug">
                                {p.name || "Chưa có tên"}
                              </div>
                            </div>
                          </td>

                          {/* 3. Mã */}
                          <td className="px-4 py-5 font-mono text-xs font-bold text-slate-600 w-24 min-w-[96px]">
                            {p.product_code || <span className="text-slate-300">—</span>}
                          </td>

                          {/* 4. Danh mục */}
                          <td className="px-4 py-5 w-32 min-w-[128px]">
                            <span className="text-xs font-bold text-slate-600">
                              {(localCategories || []).find((c) => c.id === p.category_id)?.name ||
                                "Chưa phân loại"}
                            </span>
                          </td>

                          {/* 5. Trạng thái */}
                          <td className="px-4 py-5 w-28 min-w-[112px]">
                            <CRMStatusBadge
                              variant={
                                p.status === "active"
                                  ? "success"
                                  : p.status === "inactive"
                                    ? "neutral"
                                    : "danger"
                              }
                              label={
                                p.status === "active"
                                  ? "Hoạt động"
                                  : p.status === "inactive"
                                    ? "Tạm ngưng"
                                    : "Đã lưu trữ"
                              }
                            />
                          </td>

                          {/* 6. Biến thể tóm tắt */}
                          <td className="px-4 py-5 min-w-[180px]">
                            <span className="text-xs text-slate-500 font-medium">
                              {getVariantsSummary(p)}
                            </span>
                          </td>

                          {/* 7. Thao tác */}
                          <td
                            className="px-4 py-5 w-32 min-w-[128px] text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(p);
                                setDetailOpen(true);
                              }}
                              className="h-7 px-3 text-[10px] font-bold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                            >
                              Xem chi tiết
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CRMTableWrapper>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden space-y-4 p-4">
              {filteredProducts.map((p) => {
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProduct(p);
                      setDetailOpen(true);
                    }}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 cursor-pointer hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={getImageUrlDisplay(p.image_url)}
                        alt={p.name}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = "/logo.svg";
                        }}
                        className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-800 text-sm leading-snug break-words">
                          {p.name || "Chưa có tên"}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Mã: {p.product_code || "—"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {(localCategories || []).find((c) => c.id === p.category_id)?.name ||
                              "Chưa phân loại"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <CRMStatusBadge
                        variant={
                          p.status === "active"
                            ? "success"
                            : p.status === "inactive"
                              ? "neutral"
                              : "danger"
                        }
                        label={
                          p.status === "active"
                            ? "Hoạt động"
                            : p.status === "inactive"
                              ? "Tạm ngưng"
                              : "Đã lưu trữ"
                        }
                      />
                      <span className="text-[10px] text-slate-400 font-bold">
                        {getVariantsSummary(p)}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProduct(p);
                        setDetailOpen(true);
                      }}
                      className="w-full h-9 text-xs font-bold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 min-h-[44px]"
                    >
                      Xem chi tiết
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CRMCard>

      {/* PRODUCT DIALOG */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg w-[95%] border-slate-200 overflow-y-auto max-h-[90vh]">
          <form onSubmit={handleProductSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900 uppercase">
                {editingProduct ? "Cấu hình sản phẩm" : "Thêm sản phẩm mới"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name" className="text-xs font-bold text-slate-500">
                  Tên sản phẩm <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="p-name"
                  value={productForm.name}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 text-sm font-medium"
                  placeholder="Nhập tên sản phẩm..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="p-code" className="text-xs font-bold text-slate-500">
                    Mã sản phẩm (Product Code)
                  </Label>
                  <Input
                    id="p-code"
                    value={productForm.product_code}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        product_code: e.target.value.toUpperCase().replace(/\s+/g, ""),
                      }))
                    }
                    className="h-10 rounded-xl border-slate-200 text-sm font-mono font-bold"
                    placeholder="Ví dụ: 1, 2, DESEMBRE_01"
                    disabled={!!editingProduct}
                  />
                  {editingProduct && (
                    <span className="text-[9px] text-slate-400 font-medium leading-none block mt-1">
                      Khóa sửa mã để bảo toàn lịch sử đơn hàng.
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p-category" className="text-xs font-bold text-slate-500">
                    Danh mục phân loại
                  </Label>
                  <Select
                    value={productForm.category_id}
                    onValueChange={(val) =>
                      setProductForm((prev) => ({ ...prev, category_id: val }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-sm font-medium">
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200">
                      {brandCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-sm">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-desc" className="text-xs font-bold text-slate-500">
                  Mô tả sản phẩm
                </Label>
                <Textarea
                  id="p-desc"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="rounded-xl border-slate-200 text-sm min-h-[80px] leading-relaxed"
                  placeholder="Mô tả kỹ thuật hoặc chức năng sản phẩm..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-img" className="text-xs font-bold text-slate-500">
                  Link ảnh sản phẩm (http/https URL hoặc đường dẫn storage)
                </Label>
                <Input
                  id="p-img"
                  value={productForm.image_url}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, image_url: e.target.value }))
                  }
                  className="h-10 rounded-xl border-slate-200 text-sm"
                  placeholder="https://example.com/image.png hoặc /assets/img.jpg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-catalog" className="text-xs font-bold text-slate-500">
                  Link tài liệu PDF (Catalog URL)
                </Label>
                <Input
                  id="p-catalog"
                  value={productForm.catalog_url}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, catalog_url: e.target.value }))
                  }
                  className="h-10 rounded-xl border-slate-200 text-sm"
                  placeholder="https://example.com/catalog.pdf"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="p-status" className="text-xs font-bold text-slate-500">
                    Trạng thái hoạt động
                  </Label>
                  <Select
                    value={productForm.status}
                    onValueChange={(val) =>
                      setProductForm((prev) => ({
                        ...prev,
                        status: val as "active" | "inactive" | "archived",
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-sm font-medium">
                      <SelectValue placeholder="Chọn trạng thái" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200">
                      <SelectItem value="active" className="text-sm">
                        Hoạt động (Active)
                      </SelectItem>
                      <SelectItem value="inactive" className="text-sm">
                        Tạm ngưng (Inactive)
                      </SelectItem>
                      <SelectItem value="archived" className="text-sm">
                        Lưu trữ (Archived)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p-sort" className="text-xs font-bold text-slate-500">
                    Thứ tự hiển thị
                  </Label>
                  <Input
                    id="p-sort"
                    type="number"
                    value={productForm.sort_order}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, sort_order: e.target.value }))
                    }
                    className="h-10 rounded-xl border-slate-200 text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setProductDialogOpen(false)}
                className="h-11 rounded-xl text-xs font-bold text-slate-600 flex-1 sm:flex-initial min-h-[44px]"
              >
                HỦY
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex-1 sm:flex-initial min-h-[44px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang lưu...
                  </>
                ) : (
                  "LƯU SẢN PHẨM"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VARIANT CONFIG DIALOG */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md w-[95%] border-slate-200">
          <form onSubmit={handleVariantSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900 uppercase">
                {editingVariant ? "Cấu hình biến thể" : "Thêm biến thể mới"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500">Sản phẩm chủ quản</Label>
                <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-800">
                  {activeParentProduct?.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="v-channel" className="text-xs font-bold text-slate-500">
                    Phân loại Kênh <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={variantForm.channel}
                    onValueChange={(val) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        channel: val as "retail" | "salon",
                      }))
                    }
                    disabled={!!editingVariant}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200">
                      <SelectItem value="retail" className="text-sm">
                        Bán lẻ (Retail)
                      </SelectItem>
                      <SelectItem value="salon" className="text-sm">
                        Chuyên nghiệp (Salon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="v-size" className="text-xs font-bold text-slate-500">
                    Dung tích / Kích thước
                  </Label>
                  <Input
                    id="v-size"
                    value={variantForm.size_label}
                    onChange={(e) =>
                      setVariantForm((prev) => ({ ...prev, size_label: e.target.value }))
                    }
                    className="h-10 rounded-xl border-slate-200 text-sm"
                    placeholder="Ví dụ: 150ml, 1000ml"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="v-sku" className="text-xs font-bold text-slate-500">
                  Mã SKU <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="v-sku"
                  value={variantForm.sku}
                  onChange={(e) =>
                    setVariantForm((prev) => ({
                      ...prev,
                      sku: e.target.value.toUpperCase().replace(/[^a-zA-Z0-9_-]/g, ""),
                    }))
                  }
                  className="h-10 rounded-xl border-slate-200 font-mono text-sm font-bold"
                  placeholder="Ví dụ: DES-CLEAN-150ML"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="v-price" className="text-xs font-bold text-slate-500">
                    Giá bán (VND) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="v-price"
                    type="number"
                    value={variantForm.price}
                    onChange={(e) => setVariantForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 text-sm font-bold"
                    min="0"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="v-sort" className="text-xs font-bold text-slate-500">
                    Thứ tự sắp xếp
                  </Label>
                  <Input
                    id="v-sort"
                    type="number"
                    value={variantForm.sort_order}
                    onChange={(e) =>
                      setVariantForm((prev) => ({ ...prev, sort_order: e.target.value }))
                    }
                    className="h-10 rounded-xl border-slate-200 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <Label htmlFor="v-active" className="text-xs font-bold text-slate-700">
                    Kích hoạt hoạt động
                  </Label>
                  <p className="text-[10px] text-slate-400 font-medium leading-none">
                    Tạm dừng sẽ ngưng hiển thị biến thể
                  </p>
                </div>
                <Switch
                  id="v-active"
                  checked={variantForm.is_active}
                  onCheckedChange={(checked) =>
                    setVariantForm((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-[11px] text-amber-700 leading-normal">
                  <strong>Ràng buộc hệ thống:</strong> Biến thể này sẽ được quản lý dưới dạng{" "}
                  <span className="font-bold underline">Chưa quản lý tồn kho (Untracked)</span>. Hệ
                  thống không kích hoạt theo dõi số lượng tồn kho cho phase này.
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariantDialogOpen(false)}
                className="h-11 rounded-xl text-xs font-bold text-slate-600 flex-1 sm:flex-initial min-h-[44px]"
              >
                HỦY
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex-1 sm:flex-initial min-h-[44px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang lưu...
                  </>
                ) : (
                  "LƯU BIẾN THỂ"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ARCHIVE PRODUCT CONFIRM DIALOG */}
      <Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <DialogContent className="rounded-2xl max-w-md w-[95%] border-slate-200">
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" /> XÁC NHẬN LƯU TRỮ
                SẢN PHẨM
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                Bạn đang thực hiện lưu trữ sản phẩm{" "}
                <strong className="text-slate-900">{productToArchive?.name}</strong>. Hệ thống sẽ
                cập nhật trạng thái thành{" "}
                <span className="font-bold text-rose-600">Lưu trữ (Archived)</span> và không hiển
                thị trên Catalog.
              </p>

              {checkingOrderHistory ? (
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xác minh lịch sử đơn hàng...
                </div>
              ) : hasOrderHistory ? (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-rose-700 leading-normal">
                    <strong>CẢNH BÁO NGHIÊM NGẶT:</strong> Sản phẩm này đã tồn tại trong lịch sử đơn
                    hàng của đối tác (order_items). Việc lưu trữ/ẩn sẽ không xóa vật lý bản ghi để
                    giữ toàn vẹn dữ liệu đơn hàng cũ, nhưng sản phẩm sẽ không thể chọn lên đơn mới.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-green-700 leading-normal">
                    Sản phẩm này chưa ghi nhận phát sinh đơn hàng trong cơ sở dữ liệu. An toàn để
                    chuyển trạng thái lưu trữ.
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setArchiveConfirmOpen(false);
                  setProductToArchive(null);
                }}
                className="h-11 rounded-xl text-xs font-bold text-slate-600 flex-1 sm:flex-initial min-h-[44px]"
              >
                HỦY
              </Button>
              <Button
                onClick={handleArchiveConfirm}
                disabled={submitting || checkingOrderHistory}
                className="h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex-1 sm:flex-initial min-h-[44px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang lưu trữ...
                  </>
                ) : (
                  "XÁC NHẬN LƯU TRỮ"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* DETAIL PANEL (DRAWER) */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg md:w-[500px] p-6 overflow-y-auto max-h-[100dvh] lg:max-h-screen">
          {selectedProduct && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-lg font-black text-slate-900 leading-snug">
                    {selectedProduct.name}
                  </SheetTitle>
                  <CRMStatusBadge
                    variant={
                      selectedProduct.status === "active"
                        ? "success"
                        : selectedProduct.status === "inactive"
                          ? "neutral"
                          : "danger"
                    }
                    label={
                      selectedProduct.status === "active"
                        ? "Hoạt động"
                        : selectedProduct.status === "inactive"
                          ? "Tạm ngưng"
                          : "Đã lưu trữ"
                    }
                  />
                </div>
                <SheetDescription className="text-xs font-mono font-bold text-slate-500 mt-1">
                  Mã sản phẩm: {selectedProduct.product_code || "—"} | Thương hiệu:{" "}
                  {brands.find((b) => b.id === selectedProduct.brand_id)?.name || "—"}
                </SheetDescription>
              </SheetHeader>

              {/* Product Info Preview */}
              <div className="flex gap-4 items-start p-4 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
                <img
                  src={getImageUrlDisplay(selectedProduct.image_url)}
                  alt={selectedProduct.name}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = "/logo.svg";
                  }}
                  className="w-20 h-20 object-cover rounded-xl border border-slate-200 shrink-0 shadow-sm"
                />
                <div className="space-y-1 min-w-0">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Danh mục
                  </div>
                  <span className="text-xs font-bold text-slate-700 block">
                    {(localCategories || []).find((c) => c.id === selectedProduct.category_id)
                      ?.name || "Chưa phân loại"}
                  </span>
                  {selectedProduct.catalog_url && (
                    <a
                      href={selectedProduct.catalog_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-bold inline-flex items-center gap-1 mt-1.5 touch-manipulation min-h-[30px]"
                    >
                      Tài liệu PDF (Catalog) <Info className="w-3 h-3 animate-pulse" />
                    </a>
                  )}
                </div>
              </div>

              {/* Product Image Editing block */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Ảnh sản phẩm
                </div>
                <div className="flex gap-4 items-start">
                  <img
                    src={getImageUrlDisplay(selectedProduct.image_url)}
                    alt={selectedProduct.name}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = "/logo.svg";
                    }}
                    className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0 shadow-sm"
                  />
                  <div className="flex-1 space-y-2">
                    <Input
                      value={panelImageUrl}
                      onChange={(e) => setPanelImageUrl(e.target.value)}
                      placeholder="Nhập URL ảnh (http/https hoặc storage path)..."
                      className="h-9 rounded-lg border-slate-200 text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={panelImageSaving}
                        onClick={handlePanelImageSave}
                        className="h-8 text-[10px] px-3 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg min-h-[32px]"
                      >
                        {panelImageSaving ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1" /> Đang lưu
                          </>
                        ) : (
                          "Lưu ảnh"
                        )}
                      </Button>
                      {selectedProduct.image_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={panelImageSaving}
                          onClick={handlePanelImageClear}
                          className="h-8 text-[10px] px-3 font-bold text-rose-600 hover:bg-rose-50 rounded-lg min-h-[32px]"
                        >
                          Xóa ảnh
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Description */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Mô tả sản phẩm
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/40 p-3 rounded-xl border border-slate-100">
                  {selectedProduct.description || "Chưa có mô tả kỹ thuật cho sản phẩm này."}
                </p>
              </div>

              {/* Product Level Action Buttons */}
              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => openEditProduct(selectedProduct)}
                  className="flex-1 h-10 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 min-h-[44px]"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-2" /> Sửa sản phẩm
                </Button>
                {selectedProduct.status === "archived" ? (
                  <Button
                    variant="outline"
                    onClick={() => handleReactivateProduct(selectedProduct)}
                    className="flex-1 h-10 text-xs font-bold rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 min-h-[44px]"
                  >
                    Kích hoạt
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => initiateArchive(selectedProduct)}
                    className="flex-1 h-10 text-xs font-bold rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 min-h-[44px]"
                  >
                    Lưu trữ
                  </Button>
                )}
              </div>

              {/* VARIANTS SECTION */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Cấu hình Biến thể
                </h4>

                {/* Retail variant card */}
                {(() => {
                  const retail = selectedProduct.variants?.find((v) => v.channel === "retail");
                  if (retail) {
                    return (
                      <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100/50 space-y-3 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                            Retail (Bán lẻ)
                          </span>
                          <CRMStatusBadge
                            variant={retail.is_active ? "success" : "neutral"}
                            label={retail.is_active ? "Hoạt động" : "Tạm ngưng"}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">
                              SKU
                            </span>
                            <span className="font-mono font-bold text-slate-700 select-all">
                              {retail.sku}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">
                              Dung tích
                            </span>
                            <span className="font-bold text-slate-700">
                              {retail.size_label || "Mặc định"}
                            </span>
                          </div>
                          <div className="col-span-2 flex justify-between items-end pt-1">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">
                                Giá bán
                              </span>
                              <span className="font-bold text-blue-600 text-sm">
                                {new Intl.NumberFormat("vi-VN").format(retail.price)}đ
                              </span>
                            </div>
                            <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold border border-slate-200/60">
                              Chưa quản lý tồn kho
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditVariant(selectedProduct, retail)}
                          className="w-full h-9 text-[10px] font-bold rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 min-h-[44px]"
                        >
                          Sửa Retail
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <div className="p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Chưa cấu hình kênh Retail (Bán lẻ)
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAddVariant(selectedProduct, "retail")}
                        className="h-9 text-[10px] font-bold rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 px-4 min-h-[44px]"
                      >
                        + Thêm Retail
                      </Button>
                    </div>
                  );
                })()}

                {/* Salon variant card */}
                {(() => {
                  const salon = selectedProduct.variants?.find((v) => v.channel === "salon");
                  if (salon) {
                    return (
                      <div className="p-4 bg-violet-50/40 rounded-xl border border-violet-100/50 space-y-3 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">
                            Salon (Chuyên nghiệp)
                          </span>
                          <CRMStatusBadge
                            variant={salon.is_active ? "success" : "neutral"}
                            label={salon.is_active ? "Hoạt động" : "Tạm ngưng"}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">
                              SKU
                            </span>
                            <span className="font-mono font-bold text-slate-700 select-all">
                              {salon.sku}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase font-bold">
                              Dung tích
                            </span>
                            <span className="font-bold text-slate-700">
                              {salon.size_label || "Mặc định"}
                            </span>
                          </div>
                          <div className="col-span-2 flex justify-between items-end pt-1">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">
                                Giá bán
                              </span>
                              <span className="font-bold text-violet-600 text-sm">
                                {new Intl.NumberFormat("vi-VN").format(salon.price)}đ
                              </span>
                            </div>
                            <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold border border-slate-200/60">
                              Chưa quản lý tồn kho
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditVariant(selectedProduct, salon)}
                          className="w-full h-9 text-[10px] font-bold rounded-lg border-violet-200 text-violet-600 hover:bg-violet-50 min-h-[44px]"
                        >
                          Sửa Salon
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <div className="p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Chưa cấu hình kênh Salon (Chuyên nghiệp)
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAddVariant(selectedProduct, "salon")}
                        className="h-9 text-[10px] font-bold rounded-lg border-violet-200 text-violet-600 hover:bg-violet-50 px-4 min-h-[44px]"
                      >
                        + Thêm Salon
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
