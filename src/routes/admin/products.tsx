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
  ShoppingCart
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchOverrides();
  }, []);

  const fetchOverrides = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("product_overrides").select("*");
      if (error) throw error;
      
      const map: Record<number, any> = {};
      (data || []).forEach(r => {
        map[r.no] = r;
      });
      setOverrides(map);
    } catch (e) {
      console.warn("Using local overrides fallback", e);
      const local = localStorage.getItem("mock_overrides");
      if (local) {
        const data = JSON.parse(local);
        const map: Record<number, any> = {};
        data.forEach((r: any) => { map[r.no] = r; });
        setOverrides(map);
      }
    } finally {
      setLoading(false);
    }
  };

  const mergedProducts = useMemo(() => {
    const list: any[] = [];
    
    // Add static products with overrides
    PRODUCTS.forEach(p => {
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
        variants: p.variants.map(v => {
          if (v.type === "retail") {
            return { ...v, price: o?.retail_price ?? v.price, size: o?.retail_size ?? v.size };
          }
          if (v.type === "salon") {
            return { ...v, price: o?.salon_price ?? v.price, size: o?.salon_size ?? v.size };
          }
          return v;
        })
      });
    });

    // Add custom products
    Object.values(overrides).forEach(o => {
      if (!o.is_custom || o.deleted) return;
      list.push({
        id: o.no,
        name: o.name ?? "(Sản phẩm mới)",
        description: o.desc ?? "",
        categoryId: o.section ?? "OTHER",
        imageUrl: o.image_url ?? undefined,
        pdfUrl: o.link_url,
        variants: [
          ...(o.retail_price != null ? [{ id: `${o.no}-retail`, type: "retail", size: o.retail_size ?? "", price: o.retail_price }] : []),
          ...(o.salon_price != null ? [{ id: `${o.no}-salon`, type: "salon", size: o.salon_size ?? "", price: o.salon_price }] : []),
        ],
        isCustom: true
      });
    });

    return list;
  }, [overrides]);

  const filteredProducts = useMemo(() => {
    return mergedProducts.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === "all" || p.categoryId === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [mergedProducts, searchQuery, categoryFilter]);

  const fmt = (n: number) => {
    // Determine the role to use for pricing
    const isFieldStaff = roles.some(r => ["sale", "tele_lead", "telesale"].includes(r));
    const primaryFieldRole = roles.find(r => ["sale", "tele_lead", "telesale"].includes(r));
    
    // If admin and saleViewMode is ON, use 'sale' role to show 60% price
    // If field staff, they always see their discounted price
    const effectiveRole = (isAdmin && saleViewMode) ? "sale" : (primaryFieldRole || userRole);
    
    const price = getDisplayPrice(n, vatOn ? "with" : "without", effectiveRole as UserRole);
    return new Intl.NumberFormat("vi-VN").format(Math.round(price || 0)) + "đ";
  };

  const handleUpdate = (id: number, field: string, value: any) => {
    setOverrides(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, no: id }
    }));
  };

  const handlePick = (no: number, sizeType: "retail" | "salon") => {
    setCart(prev => [...prev, { no, sizeType }]);
    toast.success("Đã thêm vào giỏ nháp");
  };

  const handleCreateOrder = () => {
    sessionStorage.setItem("pickupCart", JSON.stringify(cart));
    navigate({ to: "/orders/new" });
  };

  return (
    <EditUnlockProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-indigo-500 selection:text-white">
        {/* ELITE HEADER */}
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="container mx-auto px-6 h-24 flex items-center justify-between max-w-7xl">
            <div className="flex items-center gap-6">
               <Link to="/" className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-2xl">
                  <ArrowLeft className="w-6 h-6" />
               </Link>
               <div>
                  <div className="flex items-center gap-2">
                     <Badge className="bg-indigo-500 text-white border-none text-[9px] font-black tracking-widest px-2 py-0.5 rounded-md">ADMIN ONLY</Badge>
                     <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Master Catalog v4.0</span>
                  </div>
                  <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3 mt-1">
                     Danh Mục Sản Phẩm <span className="text-indigo-400">(Product Catalog)</span>
                  </h1>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <PDFDownloadLink 
                  document={
                      <FullCatalogPDF 
                        products={mergedProducts} 
                        vatOn={vatOn} 
                        vatRate={vatRate}
                        role={(isAdmin && saleViewMode) ? "sale" : undefined}
                      />
                  } 
                  fileName={`Desembre_Catalog_${new Date().toISOString().slice(0,10)}.pdf`}
               >
                  {({ loading }) => (
                    <Button variant="outline" className="h-12 px-6 rounded-2xl bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 font-bold text-xs uppercase tracking-widest">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                      Xuất PDF
                    </Button>
                  )}
               </PDFDownloadLink>
               
               <Button className="h-12 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all hover:scale-105">
                  <Plus className="w-4 h-4 mr-2" /> Thêm sản phẩm
               </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-10 max-w-7xl space-y-8 animate-fade-in">
          {/* FILTERS & SEARCH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-slate-900/40 p-3 rounded-[32px] border border-slate-800/60 backdrop-blur-sm">
             <div className="lg:col-span-4 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input 
                  placeholder="Tìm tên sản phẩm, công dụng..." 
                  className="pl-12 h-14 rounded-[22px] border-slate-800 bg-slate-950/50 focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium placeholder:text-slate-600"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
             
             <div className="lg:col-span-8 flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 px-2 no-scrollbar">
                <div className="flex items-center gap-2 mr-4 shrink-0">
                   <Filter className="w-4 h-4 text-slate-500" />
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Phân loại:</span>
                </div>
                <button 
                  onClick={() => setCategoryFilter('all')}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                    ${categoryFilter === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  Tất cả
                </button>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                      ${categoryFilter === cat.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  >
                    {cat.name}
                  </button>
                ))}
             </div>

             <div className="lg:col-span-12 flex items-center justify-end px-4 py-2 border-t border-slate-800/50 mt-2 gap-4">
                <div className="flex items-center gap-3 bg-slate-950/50 px-4 py-2 rounded-2xl border border-slate-800">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hiển thị giá:</span>
                   <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase transition-colors ${!vatOn ? 'text-indigo-400' : 'text-slate-600'}`}>Chưa VAT</span>
                      <button 
                        onClick={() => setVatOn(!vatOn)}
                        className={`w-10 h-5 rounded-full p-1 transition-all duration-300 ${vatOn ? 'bg-indigo-600' : 'bg-slate-700'}`}
                      >
                         <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${vatOn ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                      <span className={`text-[9px] font-bold uppercase transition-colors ${vatOn ? 'text-indigo-400' : 'text-slate-600'}`}>Có VAT ({Math.round(vatRate * 100)}%)</span>
                   </div>
                </div>
             </div>
          </div>

          {/* DATA TABLE - ELITE GLASSMORPHISM STYLE */}
          <div className="bg-slate-900/20 rounded-[40px] border border-slate-800/50 overflow-hidden backdrop-blur-md shadow-2xl">
             <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                   <thead>
                      <tr className="border-b border-slate-800/50 bg-slate-900/40">
                         <th className="px-6 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-16">No.</th>
                         <th className="px-6 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-28">Visual</th>
                         <th className="px-6 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sản phẩm & Mô tả</th>
                         <th className="px-6 py-6 text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-32">Size</th>
                         <th className="px-6 py-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-44">Retail Consumer</th>
                         <th className="px-6 py-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-44">Salon Consumer</th>
                         <th className="px-6 py-6 text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-32">Catalog</th>
                         <th className="px-6 py-6 text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-20"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/30">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="py-32 text-center">
                             <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Đang đồng bộ dữ liệu Cloud...</p>
                             </div>
                          </td>
                        </tr>
                      ) : filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-32 text-center">
                             <div className="flex flex-col items-center gap-4 opacity-30">
                                <Zap className="w-16 h-16 text-slate-600" />
                                <p className="text-sm font-bold text-slate-500">Không tìm thấy sản phẩm nào phù hợp</p>
                             </div>
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p, idx) => {
                          const retail = p.variants.find((v: any) => v.type === "retail");
                          const salon = p.variants.find((v: any) => v.type === "salon");

                          return (
                            <tr key={p.id} className="group hover:bg-slate-800/20 transition-all duration-300">
                               <td className="px-6 py-6 text-center">
                                  <span className="text-xs font-mono font-bold text-slate-600 group-hover:text-indigo-400 transition-colors">
                                     {String(idx + 1).padStart(2, '0')}
                                  </span>
                               </td>
                               <td className="px-6 py-6">
                                  <ProductImageCell 
                                    productNo={p.id} 
                                    src={p.imageUrl} 
                                    onChange={(src) => handleUpdate(p.id, 'image_url', src)} 
                                  />
                               </td>
                               <td className="px-6 py-6 max-w-md">
                                  <div className="space-y-1">
                                     <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">{p.name}</h3>
                                        {p.isCustom && <Badge className="bg-amber-500/10 text-amber-500 border-none text-[8px] font-black">CUSTOM</Badge>}
                                     </div>
                                     <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-medium">
                                        {p.description || "Chưa có mô tả kỹ thuật cho sản phẩm này."}
                                     </p>
                                     <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline" className="text-[9px] font-black text-slate-500 border-slate-800 py-0 uppercase">
                                           {CATEGORIES.find(c => c.id === p.categoryId)?.name || "N/A"}
                                        </Badge>
                                        <span className="text-[10px] text-slate-700 font-mono">SKU: DES-{p.id}</span>
                                     </div>
                                  </div>
                               </td>
                               <td className="px-6 py-6 text-center">
                                  <div className="space-y-2">
                                     {retail && (
                                        <div className="px-2 py-1 rounded-lg bg-blue-500/5 border border-blue-500/10 text-[10px] font-black text-blue-400 uppercase">
                                           Retail: {retail.size}
                                        </div>
                                     )}
                                     {salon && (
                                        <div className="px-2 py-1 rounded-lg bg-purple-500/5 border border-purple-500/10 text-[10px] font-black text-purple-400 uppercase">
                                           Salon: {salon.size}
                                        </div>
                                     )}
                                  </div>
                               </td>
                               <td className="px-6 py-6 text-right">
                                  {retail ? (
                                     <div className="space-y-1">
                                        <p className="text-sm font-black text-white tracking-tight">{fmt(retail.price)}</p>
                                        <p className="text-[9px] font-bold text-slate-600 uppercase">NIÊM YẾT LẺ {vatOn ? "(ĐÃ CÓ VAT)" : ""}</p>
                                        <button onClick={() => handlePick(p.id, "retail")} className="text-[10px] px-3 py-1 rounded-md bg-indigo-500/20 text-indigo-400 font-bold uppercase hover:bg-indigo-500 hover:text-white transition-all">CHỌN LÊN ĐƠN</button>
                                     </div>
                                  ) : (
                                     <span className="text-slate-800">—</span>
                                  )}
                               </td>
                               <td className="px-6 py-6 text-right">
                                  {salon ? (
                                     <div className="space-y-1">
                                        <p className="text-sm font-black text-indigo-400 tracking-tight">{fmt(salon.price)}</p>
                                        <p className="text-[9px] font-bold text-slate-600 uppercase">GIÁ CHUYÊN NGHIỆP {vatOn ? "(ĐÃ CÓ VAT)" : ""}</p>
                                        <button onClick={() => handlePick(p.id, "salon")} className="text-[10px] px-3 py-1 rounded-md bg-indigo-500/20 text-indigo-400 font-bold uppercase hover:bg-indigo-500 hover:text-white transition-all">CHỌN LÊN ĐƠN</button>
                                     </div>
                                  ) : (
                                     <span className="text-slate-800">—</span>
                                  )}
                               </td>
                               <td className="px-6 py-6 text-center">
                                  <ProductLinkCell 
                                    productNo={p.id} 
                                    href={p.pdfUrl} 
                                    onChange={(url) => handleUpdate(p.id, 'link_url', url)}
                                  />
                               </td>
                               <td className="px-6 py-6 text-center">
                                  <DropdownAction />
                               </td>
                            </tr>
                          );
                        })
                      )}
                   </tbody>
                </table>
             </div>
             
             {/* FOOTER PAGINATION PLACEHOLDER */}
             <div className="px-8 py-6 border-t border-slate-800/50 bg-slate-900/40 flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                   Hiển thị <span className="text-white">{filteredProducts.length}</span> / {mergedProducts.length} sản phẩm
                </p>
                <div className="flex items-center gap-2">
                   <Button variant="ghost" disabled className="text-[10px] font-black text-slate-600">PREV</Button>
                   <div className="flex items-center gap-1">
                      <button className="w-8 h-8 rounded-lg bg-indigo-600 text-white text-xs font-black">1</button>
                      <button className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 text-xs font-black hover:bg-slate-700 hover:text-white transition-all">2</button>
                   </div>
                   <Button variant="ghost" className="text-[10px] font-black text-slate-400 hover:text-white">NEXT</Button>
                </div>
             </div>
          </div>
        </main>

        {/* FLOATING ACTION CART */}
        {cart.length > 0 && (
          <div className="fixed bottom-8 right-8 z-50 animate-fade-in">
             <Button onClick={handleCreateOrder} className="h-16 px-8 rounded-full shadow-[0_10px_40px_-10px_rgba(99,102,241,0.6)] bg-indigo-600 hover:bg-indigo-500 text-white font-black hover:scale-105 transition-all group">
                <ShoppingCart className="w-6 h-6 mr-3 group-hover:-rotate-12 transition-transform" />
                TẠO ĐƠN NHÁP ({cart.length})
             </Button>
          </div>
        )}
      </div>
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
