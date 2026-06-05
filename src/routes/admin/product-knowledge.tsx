/* eslint-disable */
import React, { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMStatusBadge, CRMStatusBadgeVariant } from "@/components/crm/CRMStatusBadge";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Save,
  BookOpen,
  MessageSquare,
  Upload,
  Tag,
  ShieldCheck,
  ArchiveX,
  FileEdit,
  Eye,
  Lock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/product-knowledge")({
  component: AdminProductKnowledge,
});

function AdminProductKnowledge() {
  const { user, isSalesMember, isAdminOrSubAdmin, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterQaStatus, setFilterQaStatus] = useState("all");
  const [filterBuildStatus, setFilterBuildStatus] = useState("all");
  const [filterMapped, setFilterMapped] = useState("all");
  const [filterChunks, setFilterChunks] = useState("all");

  // Form State
  const [structuredData, setStructuredData] = useState({
    skin_type: "",
    contraindications: "",
    ingredient_highlights: "",
    routine_position: "",
    seasonal_usage: "",
    pregnancy_safe: true,
  });

  const [isRebuilding, setIsRebuilding] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    // F.3: Fetch knowledge with catalog alignment and chunk counts
    const { data: pkData, error: pkError } = await supabase
      .from("product_knowledge")
      .select(`
        *,
        product_brands(id, name, slug),
        product_categories(id, name),
        catalog_products(id, name)
      `);

    if (pkError) {
      toast.error("Không thể tải dữ liệu tri thức sản phẩm");
      return;
    }

    // Fetch chunk counts & embedding info
    const { data: chunkData, error: chunkError } = await supabase
      .from("product_knowledge_chunks")
      .select("product_id, is_active, embedding_model, embedding_version");

    if (chunkError) {
      console.error(chunkError);
    }

    const chunkStats: Record<number, any> = {};
    if (chunkData) {
      chunkData.forEach((c) => {
        if (!chunkStats[c.product_id]) {
          chunkStats[c.product_id] = { count: 0, models: new Set(), versions: new Set() };
        }
        if (c.is_active) {
          chunkStats[c.product_id].count += 1;
          if (c.embedding_model) chunkStats[c.product_id].models.add(c.embedding_model);
          if (c.embedding_version) chunkStats[c.product_id].versions.add(c.embedding_version);
        }
      });
    }

    const enrichedProducts = pkData?.map(p => ({
      ...p,
      chunk_count: chunkStats[p.product_id]?.count || 0,
      embedding_model: Array.from(chunkStats[p.product_id]?.models || []).join(", ") || "N/A",
      embedding_version: Array.from(chunkStats[p.product_id]?.versions || []).join(", ") || "N/A",
    })) || [];

    setProducts(enrichedProducts);
    
    if (selectedProduct) {
      const updatedSelected = enrichedProducts.find(p => p.id === selectedProduct.id);
      if (updatedSelected) setSelectedProduct(updatedSelected);
    }
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setStructuredData({
      skin_type: product.skin_type?.join(", ") || "",
      contraindications: product.contraindications?.join(", ") || "",
      ingredient_highlights: product.ingredient_highlights?.join(", ") || "",
      routine_position: product.routine_position || "",
      seasonal_usage: product.seasonal_usage?.join(", ") || "",
      pregnancy_safe: product.pregnancy_safe ?? true,
    });
  };

  const handleSaveStructuredData = async () => {
    if (!selectedProduct) return;
    const toArray = (str: string) =>
      str
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const { error } = await supabase
      .from("product_knowledge")
      .update({
        skin_type: toArray(structuredData.skin_type),
        contraindications: toArray(structuredData.contraindications),
        ingredient_highlights: toArray(structuredData.ingredient_highlights),
        routine_position: structuredData.routine_position,
        seasonal_usage: toArray(structuredData.seasonal_usage),
        pregnancy_safe: structuredData.pregnancy_safe,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedProduct.id);
    if (error) {
      toast.error("Không thể lưu dữ liệu");
    } else {
      toast.success("Đã lưu Structured Data");
      fetchProducts();
    }
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!selectedProduct) return;
    const { error } = await supabase
      .from("product_knowledge")
      .update({
        qa_status: newStatus,
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", selectedProduct.id);
    if (error) {
      toast.error("Không thể cập nhật trạng thái");
    } else {
      const label =
        { draft: "Nháp", review: "Chờ duyệt", approved: "Đã duyệt", archived: "Lưu trữ" }[
          newStatus
        ] || newStatus;
      toast.success(`Đã chuyển trạng thái sang: ${label}`);
      fetchProducts();
    }
  };

  const handleRebuild = async () => {
    if (!selectedProduct) return;
    if (selectedProduct.qa_status !== "approved") {
      toast.error("Chỉ có thể tạo embedding cho Tri thức đã duyệt (Approved)");
      return;
    }
    
    if (!confirm(`Bạn có chắc chắn muốn tạo lại embedding cho sản phẩm ${selectedProduct.product_name || selectedProduct.product_id}? Quá trình này sẽ sử dụng API OpenAI.`)) {
      return;
    }

    setIsRebuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke("embed-product-knowledge", {
        body: { record: selectedProduct, type: "UPDATE" },
      });
      if (error) throw error;
      toast.success("Đã gửi yêu cầu tạo embedding thành công.");
      fetchProducts();
    } catch (err: any) {
      toast.error(`Lỗi tạo embedding: ${err.message}`);
    } finally {
      setIsRebuilding(false);
    }
  };

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

  // Apply filters
  const filteredProducts = products.filter(p => {
    // Search
    if (searchQuery && !p.product_id.toString().includes(searchQuery) && !(p.product_name || "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Brand
    if (filterBrand !== "all" && p.product_brands?.slug !== filterBrand) return false;
    // QA Status
    if (filterQaStatus !== "all" && p.qa_status !== filterQaStatus) return false;
    // Build Status
    if (filterBuildStatus !== "all" && p.build_status !== filterBuildStatus) return false;
    // Mapped
    if (filterMapped === "mapped" && !p.catalog_product_id) return false;
    if (filterMapped === "unmapped" && p.catalog_product_id) return false;
    // Chunks
    if (filterChunks === "has_chunks" && p.chunk_count === 0) return false;
    if (filterChunks === "no_chunks" && p.chunk_count > 0) return false;
    return true;
  });

  return (
    <CRMPageContainer>
      <CRMPageHeader
        title="Quản lý Tri thức Sản phẩm (AI RAG)"
        icon={<BookOpen className="w-7 h-7 text-indigo-500" />}
        description="Quản lý dữ liệu chuyên sâu để AI Sales bot tư vấn (Catalog Aligned)."
        breadcrumbs={[{ label: "Admin Hub", href: "/admin/hub" }, { label: "Tri thức Sản phẩm" }]}
      />

      <div className="flex flex-col md:flex-row gap-6 mt-4 h-auto md:h-[calc(100vh-10rem)]">
        {/* Left Sidebar: Product List */}
        <CRMCard className="w-full md:w-[35%] lg:w-[30%] flex flex-col p-0 h-[500px] md:h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 shrink-0 space-y-3 bg-slate-50/50">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" /> Danh sách Tri thức ({filteredProducts.length})
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Tìm Tên SP / ID..."
                className="pl-9 h-9 text-xs bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Filters */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterBrand} onValueChange={setFilterBrand}>
                <SelectTrigger className="h-8 text-[11px] bg-white"><SelectValue placeholder="Brand" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả Brands</SelectItem>
                  <SelectItem value="desembre">Desembre</SelectItem>
                  <SelectItem value="dermagarden">Dermagarden</SelectItem>
                  <SelectItem value="vavaw">VAVAW</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterQaStatus} onValueChange={setFilterQaStatus}>
                <SelectTrigger className="h-8 text-[11px] bg-white"><SelectValue placeholder="QA Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả QA</SelectItem>
                  <SelectItem value="draft">Nháp</SelectItem>
                  <SelectItem value="review">Chờ duyệt</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterMapped} onValueChange={setFilterMapped}>
                <SelectTrigger className="h-8 text-[11px] bg-white"><SelectValue placeholder="Mapping" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả Mapping</SelectItem>
                  <SelectItem value="mapped">Đã map Catalog</SelectItem>
                  <SelectItem value="unmapped">Chưa map Catalog</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterChunks} onValueChange={setFilterChunks}>
                <SelectTrigger className="h-8 text-[11px] bg-white"><SelectValue placeholder="Chunks" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả Chunks</SelectItem>
                  <SelectItem value="has_chunks">Có active chunks</SelectItem>
                  <SelectItem value="no_chunks">0 chunks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredProducts.map((p) => {
                const statusVariant: Record<string, CRMStatusBadgeVariant> = {
                  draft: "neutral",
                  review: "warning",
                  approved: "success",
                  archived: "error",
                };
                const statusLabel: Record<string, string> = {
                  draft: "Nháp",
                  review: "Duyệt",
                  approved: "OK",
                  archived: "Archive",
                };
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedProduct?.id === p.id
                        ? "bg-indigo-50/50 border-indigo-200 shadow-sm"
                        : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-xs font-bold text-slate-800 line-clamp-1">
                        {p.product_name || `SP ID: ${p.product_id}`}
                      </div>
                      <CRMStatusBadge variant={statusVariant[p.qa_status] || "neutral"}>
                        {statusLabel[p.qa_status] || p.qa_status}
                      </CRMStatusBadge>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.product_brands?.name && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-white border-slate-200 text-slate-500">
                          {p.product_brands.name}
                        </Badge>
                      )}
                      {p.catalog_product_id ? (
                         <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-emerald-50 border-emerald-200 text-emerald-600">
                           ✅ Mapped
                         </Badge>
                      ) : (
                         <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-50 border-amber-200 text-amber-600">
                           ⚠️ Unmapped
                         </Badge>
                      )}
                      <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${p.chunk_count > 0 ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                        {p.chunk_count > 0 ? `${p.chunk_count} chunks` : "0 chunks"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="text-center p-4 text-xs text-slate-500">
                  Không tìm thấy kết quả phù hợp.
                </div>
              )}
          </div>
        </CRMCard>

        {/* Right Content: CMS Editor */}
        <CRMCard className="w-full md:w-[65%] lg:w-[70%] flex flex-col p-0 h-[600px] md:h-full overflow-hidden">
          {selectedProduct ? (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-slate-800">
                      {selectedProduct.product_name || `Sản phẩm #${selectedProduct.product_id}`}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Brand: <strong className="text-slate-700">{selectedProduct.product_brands?.name || "N/A"}</strong></span>
                      <span>&bull;</span>
                      <span>Category: <strong className="text-slate-700">{selectedProduct.product_categories?.name || "N/A"}</strong></span>
                      <span>&bull;</span>
                      <span>Legacy ID: <strong className="text-slate-700">{selectedProduct.product_id}</strong></span>
                    </div>
                    {selectedProduct.catalog_product_id && (
                      <div className="text-[11px] text-emerald-600 font-medium">
                        ↳ Mapped to Catalog: {selectedProduct.catalog_products?.name || selectedProduct.catalog_product_id}
                      </div>
                    )}
                  </div>
                  
                  {/* QA Status Controls */}
                  <div className="flex flex-col gap-2 sm:items-end">
                    <div className="flex items-center gap-1.5">
                      {selectedProduct.qa_status !== "draft" && (
                        <Button size="sm" variant="outline" onClick={() => handleChangeStatus("draft")} className="gap-1 text-slate-600 h-7 text-xs">
                          <FileEdit className="w-3 h-3" /> Nháp
                        </Button>
                      )}
                      {selectedProduct.qa_status !== "review" && (
                        <Button size="sm" variant="outline" onClick={() => handleChangeStatus("review")} className="gap-1 text-amber-600 border-amber-200 h-7 text-xs hover:bg-amber-50">
                          <Eye className="w-3 h-3" /> Gửi Duyệt
                        </Button>
                      )}
                      {selectedProduct.qa_status !== "approved" && (
                        <Button size="sm" onClick={() => handleChangeStatus("approved")} className="gap-1 bg-emerald-600 hover:bg-emerald-700 h-7 text-xs">
                          <ShieldCheck className="w-3 h-3" /> Duyệt (AI dùng)
                        </Button>
                      )}
                    </div>
                    
                    {selectedProduct.qa_status === "approved" && (
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={handleRebuild}
                        disabled={isRebuilding}
                        className="gap-1 bg-indigo-600 hover:bg-indigo-700 h-7 text-xs"
                      >
                        {isRebuilding ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Tạo lại Embedding
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Status Conflict Warning */}
                <div className="mt-4 flex flex-col gap-2">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-800 flex flex-col gap-1">
                    <div className="font-bold">💡 Trạng thái Đồng bộ (Status Fields)</div>
                    <div>
                      RAG hiện đang sử dụng <strong>qa_status = '{selectedProduct.qa_status}'</strong>. 
                      Trường <strong>status = 'published'</strong> là future-state field sẽ được chuẩn hóa trong phase sau.
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-[11px] text-slate-600 bg-white p-2 border border-slate-100 rounded-lg">
                    <div className="flex gap-2 items-center">
                      <span className="font-semibold">Chunks:</span>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">{selectedProduct.chunk_count}</Badge>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="font-semibold">Build:</span>
                      <Badge variant="outline" className={selectedProduct.build_status === "completed" ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200"}>
                        {selectedProduct.build_status}
                      </Badge>
                    </div>
                    <div><span className="font-semibold">Model:</span> {selectedProduct.embedding_model} (v{selectedProduct.embedding_version})</div>
                    <div><span className="font-semibold">Knowledge Ver:</span> {selectedProduct.knowledge_version}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <Tabs defaultValue="tags" className="w-full">
                  <TabsList className="mb-6">
                    <TabsTrigger value="tags" className="flex items-center gap-2">
                      <Tag className="w-4 h-4" /> Structured Tags
                    </TabsTrigger>
                    <TabsTrigger value="faq" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> FAQ & Objections
                    </TabsTrigger>
                    <TabsTrigger value="docs" className="flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Tài liệu
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tags" className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Loại da phù hợp (cách nhau dấu phẩy)</Label>
                        <Input
                          value={structuredData.skin_type}
                          onChange={(e) =>
                            setStructuredData({ ...structuredData, skin_type: e.target.value })
                          }
                          placeholder="Vd: Da dầu, Da mụn..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Thành phần nổi bật</Label>
                        <Input
                          value={structuredData.ingredient_highlights}
                          onChange={(e) =>
                            setStructuredData({
                              ...structuredData,
                              ingredient_highlights: e.target.value,
                            })
                          }
                          placeholder="Vd: Niacinamide 5%, BHA 2%..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Chống chỉ định</Label>
                        <Input
                          value={structuredData.contraindications}
                          onChange={(e) =>
                            setStructuredData({
                              ...structuredData,
                              contraindications: e.target.value,
                            })
                          }
                          placeholder="Vd: Không dùng chung với Retinol..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mùa khuyên dùng</Label>
                        <Input
                          value={structuredData.seasonal_usage}
                          onChange={(e) =>
                            setStructuredData({ ...structuredData, seasonal_usage: e.target.value })
                          }
                          placeholder="Vd: Mùa hè, Mùa hanh khô..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Vị trí chu trình (Routine)</Label>
                        <Input
                          value={structuredData.routine_position}
                          onChange={(e) =>
                            setStructuredData({
                              ...structuredData,
                              routine_position: e.target.value,
                            })
                          }
                          placeholder="Vd: Bước 2 - Sau làm sạch..."
                        />
                      </div>
                      <div className="space-y-2 flex flex-col justify-center">
                        <Label className="mb-2">An toàn cho Mẹ bầu?</Label>
                        <div className="flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={structuredData.pregnancy_safe === true}
                              onChange={() =>
                                setStructuredData({ ...structuredData, pregnancy_safe: true })
                              }
                            />
                            Có
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={structuredData.pregnancy_safe === false}
                              onChange={() =>
                                setStructuredData({ ...structuredData, pregnancy_safe: false })
                              }
                            />
                            Không
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end mt-8">
                      <Button
                        onClick={handleSaveStructuredData}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Save className="w-4 h-4" /> Lưu Structured Data
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="faq" className="space-y-4">
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500">
                      <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p>
                        Giao diện quản lý Câu hỏi thường gặp và Kịch bản xử lý từ chối (Objection
                        Scripts) sẽ được triển khai tại đây.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="docs" className="space-y-4">
                    <div className="p-8 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl text-center">
                      <Upload className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
                      <h3 className="font-bold text-indigo-900 mb-1">Upload Tài liệu Sản phẩm</h3>
                      <p className="text-sm text-indigo-600/80 mb-4">
                        Hỗ trợ PDF, DOCX, TXT. Tài liệu sẽ được dùng cho AI Vector RAG ở Phase sau.
                      </p>
                      <Button
                        variant="outline"
                        className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      >
                        Chọn File
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <CRMEmptyState
                title="Chọn sản phẩm"
                description="Chọn một sản phẩm bên trái để xem chi tiết Tri thức Sản phẩm (AI RAG)"
                icon={<BookOpen className="w-12 h-12 text-slate-200" />}
              />
            </div>
          )}
        </CRMCard>
      </div>
    </CRMPageContainer>
  );
}
