/* eslint-disable */
import React, { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/product-knowledge")({
  component: AdminProductKnowledge,
});

function AdminProductKnowledge() {
  const { user, isSalesMember, isAdminOrSubAdmin, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [structuredData, setStructuredData] = useState({
    skin_type: "",
    contraindications: "",
    ingredient_highlights: "",
    routine_position: "",
    seasonal_usage: "",
    pregnancy_safe: true,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    // In a real app, you'd fetch from your products table and join with product_knowledge
    // For now, we mock fetching from product_knowledge and a hypothetical products table.
    // Let's assume we fetch product_knowledge and we'll just display product_id for now.
    const { data, error } = await supabase.from("product_knowledge").select("*");
    if (error) {
      toast.error("Không thể tải dữ liệu sản phẩm");
      return;
    }
    setProducts(data || []);
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

  // Phase 8: QA Status changer
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
      setSelectedProduct({ ...selectedProduct, qa_status: newStatus });
      fetchProducts();
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

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-6 h-auto md:h-[calc(100vh-6rem)]">
      {/* Left Sidebar: Product List */}
      <Card className="w-full md:w-1/3 flex flex-col h-[400px] md:h-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" /> Catalog Sản Phẩm
          </CardTitle>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Tìm ID sản phẩm..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-2">
          {products
            .filter((p) => p.product_id.toString().includes(searchQuery))
            .map((p) => {
              const statusColor: Record<string, string> = {
                draft: "bg-slate-100 text-slate-500",
                review: "bg-amber-100 text-amber-700",
                approved: "bg-emerald-100 text-emerald-700",
                archived: "bg-rose-100 text-rose-500",
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
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${selectedProduct?.id === p.id ? "bg-indigo-50 border-indigo-200" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800">Sản phẩm ID: {p.product_id}</div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor[p.qa_status] || statusColor.draft}`}
                    >
                      {statusLabel[p.qa_status] || p.qa_status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-1">{p.benefits}</div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      {/* Right Content: CMS Editor */}
      <Card className="w-full md:w-2/3 flex flex-col h-[600px] md:h-full overflow-hidden">
        {selectedProduct ? (
          <div className="flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-800">
                  Sản phẩm #{selectedProduct.product_id}
                </h2>
                {/* Phase 8: QA Status Controls */}
                <div className="flex items-center flex-wrap gap-1.5 sm:justify-end">
                  {selectedProduct.qa_status !== "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleChangeStatus("draft")}
                      className="gap-1 text-slate-600 h-7 text-xs"
                    >
                      <FileEdit className="w-3 h-3" /> Nháp
                    </Button>
                  )}
                  {selectedProduct.qa_status !== "review" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleChangeStatus("review")}
                      className="gap-1 text-amber-600 border-amber-200 h-7 text-xs hover:bg-amber-50"
                    >
                      <Eye className="w-3 h-3" /> Gửi Duyệt
                    </Button>
                  )}
                  {selectedProduct.qa_status !== "approved" && (
                    <Button
                      size="sm"
                      onClick={() => handleChangeStatus("approved")}
                      className="gap-1 bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                    >
                      <ShieldCheck className="w-3 h-3" /> Duyệt (AI dùng)
                    </Button>
                  )}
                  {selectedProduct.qa_status !== "archived" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleChangeStatus("archived")}
                      className="gap-1 text-rose-600 border-rose-200 h-7 text-xs hover:bg-rose-50"
                    >
                      <ArchiveX className="w-3 h-3" /> Archive
                    </Button>
                  )}
                </div>
              </div>
              {selectedProduct.qa_status !== "approved" && (
                <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
                  ⚠️ Tri thức này chưa được AI sử dụng. Chỉ status <strong>Approved</strong> mới
                  được đưa vào Retrieval.
                </div>
              )}
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
                  <div className="grid grid-cols-2 gap-6">
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
                          setStructuredData({ ...structuredData, routine_position: e.target.value })
                        }
                        placeholder="Vd: Bước 2 - Sau làm sạch..."
                      />
                    </div>
                    <div className="space-y-2 flex flex-col justify-center">
                      <Label className="mb-2">An toàn cho Mẹ bầu?</Label>
                      <div className="flex items-center gap-4">
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
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <BookOpen className="w-12 h-12 mb-4 text-slate-200" />
            <p>Chọn một sản phẩm bên trái để quản lý Tri thức</p>
          </div>
        )}
      </Card>
    </div>
  );
}
