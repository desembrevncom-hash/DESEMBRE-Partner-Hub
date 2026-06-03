/* eslint-disable */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Box,
  Plus,
  Search,
  Filter,
  Layers,
  Zap,
  TrendingUp,
  ChevronRight,
  MoreVertical,
  LayoutDashboard,
  Package,
  AlertCircle,
  CheckCircle2,
  Tag,
  ArrowUpRight,
  ShoppingCart,
  Image as ImageIcon,
  Archive,
  BarChart3,
  ArrowLeft,
  Edit2,
  Trash2,
  Lock,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/inventory")({
  component: InventoryManagementPage,
});

function InventoryManagementPage() {
  const { user, isAdmin, isAdminOrSubAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Fetch products with their variants
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          categories(name),
          product_variants(*)
        `,
        )
        .eq("is_deleted", false)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error(e);
      // Fallback to mock data for demo
      const mockProducts = [
        {
          id: 1,
          name: "Desembre Medi Epi Science P.Skin Care Toner",
          image_url: "https://picsum.photos/200/200?random=1",
          categories: { name: "Dòng Đặc Trị" },
          product_variants: [
            { size: "200ml", type: "retail", price: 850000 },
            { size: "1000ml", type: "salon", price: 2450000 },
          ],
          stock: 45,
        },
        {
          id: 2,
          name: "Desembre Pure Science Pure E.R Cream Mask",
          image_url: "https://picsum.photos/200/200?random=2",
          categories: { name: "Mặt Nạ Kem" },
          product_variants: [{ size: "200g", type: "retail", price: 1200000 }],
          stock: 12,
        },
        {
          id: 3,
          name: "Desembre Activator EGF Whitening Ampoule",
          image_url: "https://picsum.photos/200/200?random=3",
          categories: { name: "Ampoule" },
          product_variants: [{ size: "7ml x 10", type: "retail", price: 3200000 }],
          stock: 0,
        },
        {
          id: 4,
          name: "Desembre Derma Science Milk Cleanser",
          image_url: "https://picsum.photos/200/200?random=4",
          categories: { name: "Làm Sạch" },
          product_variants: [
            { size: "200ml", type: "retail", price: 650000 },
            { size: "1000ml", type: "salon", price: 1850000 },
          ],
          stock: 85,
        },
      ];
      setProducts(mockProducts);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === "all" || p.categories?.name === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.categories?.name).filter(Boolean));
    return Array.from(cats);
  }, [products]);

  const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans antialiased">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Đang xác thực quyền truy cập...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdminOrSubAdmin) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans antialiased">
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto text-rose-500">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Không có quyền truy cập
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Trang này chỉ dành cho Quản trị viên (Admin) hoặc Sub-admin. Vui lòng quay lại khu vực
              làm việc của bạn.
            </p>
          </div>
          <Link to="/workspace">
            <Button className="w-full rounded-xl bg-slate-900 hover:bg-black font-black text-[10px] h-11 tracking-widest mt-2">
              QUAY LẠI WORKSPACE
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      {/* HEADER */}
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 h-auto md:h-20 flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link
              to="/workspace"
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Quản lý Kho hàng</h1>
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                <Package className="w-3 h-3 fill-amber-500" /> Inventory & Catalog Center
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <Button variant="ghost" size="icon" className="rounded-xl text-slate-400 shrink-0">
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button className="rounded-xl bg-slate-900 hover:bg-black font-black text-[10px] h-10 px-6 shadow-lg shadow-slate-200 transition-all hover:scale-105 tracking-widest">
              <Plus className="w-4 h-4 mr-2 shrink-0" /> THÊM SẢN PHẨM
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* INVENTORY STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <InventoryStatCard
            title="Tổng mã hàng (SKU)"
            value={products.length}
            icon={Box}
            color="indigo"
          />
          <InventoryStatCard title="Sản phẩm sắp hết" value="8" icon={AlertCircle} color="amber" />
          <InventoryStatCard
            title="Hết hàng (Out of Stock)"
            value={products.filter((p) => p.stock === 0).length}
            icon={Archive}
            color="rose"
          />
          <InventoryStatCard
            title="Giá trị kho ước tính"
            value="1.2B"
            icon={TrendingUp}
            color="emerald"
          />
        </div>

        {/* FILTERS & SEARCH */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm kiếm sản phẩm, mã SKU..."
              className="pl-10 h-11 rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all text-sm font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Lọc danh mục:
            </span>
            <Button
              variant={categoryFilter === "all" ? "default" : "ghost"}
              size="sm"
              className={`rounded-xl text-[10px] font-black ${categoryFilter === "all" ? "bg-slate-900 text-white" : "text-slate-500"}`}
              onClick={() => setCategoryFilter("all")}
            >
              TẤT CẢ
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "ghost"}
                size="sm"
                className={`rounded-xl text-[10px] font-black ${categoryFilter === cat ? "bg-slate-900 text-white" : "text-slate-500"}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* PRODUCT GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {loading ? (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Đang kiểm kê kho hàng...
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[32px] border border-dashed border-slate-200">
              <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-slate-900">Không tìm thấy sản phẩm nào</h3>
              <p className="text-xs text-slate-400 mt-1">
                Hãy thử điều chỉnh bộ lọc hoặc tìm kiếm lại.
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white hover:shadow-xl hover:-translate-y-2 transition-all duration-500 group"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                  <img
                    src={product.image_url || "https://via.placeholder.com/400"}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge
                      className={`rounded-lg font-black text-[9px] uppercase shadow-sm border-none ${
                        product.stock > 20
                          ? "bg-emerald-500 text-white"
                          : product.stock > 0
                            ? "bg-amber-500 text-white"
                            : "bg-rose-500 text-white"
                      }`}
                    >
                      {product.stock > 0 ? `Còn ${product.stock} SP` : "Hết hàng"}
                    </Badge>
                  </div>
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="rounded-xl bg-white/90 backdrop-blur-md shadow-lg h-9 w-9"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-900" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">
                      {product.categories?.name || "Chưa phân loại"}
                    </p>
                    <h3 className="text-sm font-black text-slate-900 line-clamp-2 leading-tight h-10 group-hover:text-amber-600 transition-colors">
                      {product.name}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {product.product_variants?.map((v: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-amber-50/50 group-hover:border-amber-100 transition-all"
                      >
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                          {v.type} {v.size}
                        </span>
                        <span className="text-xs font-black text-slate-900">{fmt(v.price)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl border-slate-100 text-[10px] font-black text-slate-400 hover:text-slate-900"
                    >
                      <Edit2 className="w-3 h-3 mr-2" /> SỬA
                    </Button>
                    <Button className="flex-1 rounded-xl bg-slate-900 hover:bg-black font-black text-[10px] tracking-widest">
                      NHẬP KHO <ArrowUpRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function InventoryStatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };
  return (
    <Card className="rounded-[28px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all group">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-1">{value}</h3>
        </div>
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110 ${colors[color]}`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}
