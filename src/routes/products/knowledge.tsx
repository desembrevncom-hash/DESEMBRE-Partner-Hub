/* eslint-disable */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BookOpen,
  Search,
  Filter,
  Copy,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  HeartPulse,
  Leaf,
  Target,
  Clock,
  Sparkles,
  ChevronDown,
  X,
  RefreshCw,
  MessageCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMLoadingState } from "@/components/crm/CRMLoadingState";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/products/knowledge")({
  component: ProductLearningCenter,
});

interface ProductKnowledge {
  id: string;
  product_id: number;
  benefits: string;
  skin_concerns: string[];
  suitable_spa_types: string[];
  usage_instructions: string;
  sales_pitch: string;
  warnings: string;
  restock_cycle_days: number;
  product: {
    name: string;
    category: string;
  };
}

interface ProductObjection {
  id: string;
  objection_type: string;
  customer_statement: string;
  suggested_response: string;
}

function ProductLearningCenter() {
  const {
    user,
    isSale,
    isTeleLead,
    isTelesale,
    isAdmin,
    isSubAdmin,
    loading: authLoading,
  } = useAuth();

  const [knowledgeList, setKnowledgeList] = useState<ProductKnowledge[]>([]);
  const [objectionsMap, setObjectionsMap] = useState<Record<number, ProductObjection[]>>({});
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkinConcern, setSelectedSkinConcern] = useState<string>("all");
  const [selectedSpaType, setSelectedSpaType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Dialog state
  const [selectedProductObj, setSelectedProductObj] = useState<ProductKnowledge | null>(null);
  const [isObjectionDialogOpen, setIsObjectionDialogOpen] = useState(false);

  const isAuthorized = isAdmin || isSubAdmin || isSale || isTeleLead || isTelesale;

  useEffect(() => {
    async function fetchData() {
      if (!isAuthorized) return;
      setLoading(true);
      try {
        // Fetch approved & active knowledge
        const { data: pkData, error: pkError } = await supabase
          .from("product_knowledge")
          .select(
            `
            id, product_id, benefits, skin_concerns, suitable_spa_types,
            usage_instructions, sales_pitch, warnings, restock_cycle_days,
            product:products(name, category)
          `,
          )
          .eq("is_active", true)
          .eq("qa_status", "approved");

        if (pkError) throw pkError;

        setKnowledgeList((pkData || []) as any[]);

        if (pkData && pkData.length > 0) {
          const productIds = pkData.map((k: any) => k.product_id);
          const { data: objData, error: objError } = await supabase
            .from("product_objections")
            .select("*")
            .in("product_id", productIds)
            .eq("is_active", true);

          if (!objError && objData) {
            const map: Record<number, ProductObjection[]> = {};
            objData.forEach((o: any) => {
              if (!map[o.product_id]) map[o.product_id] = [];
              map[o.product_id].push(o);
            });
            setObjectionsMap(map);
          }
        }
      } catch (err: any) {
        toast.error("Lỗi tải dữ liệu: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) fetchData();
  }, [isAuthorized, authLoading]);

  // Derived filter options
  const allSkinConcerns = useMemo(() => {
    const set = new Set<string>();
    knowledgeList.forEach((k) => k.skin_concerns?.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [knowledgeList]);

  const allSpaTypes = useMemo(() => {
    const set = new Set<string>();
    knowledgeList.forEach((k) => k.suitable_spa_types?.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [knowledgeList]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    knowledgeList.forEach((k) => {
      if (k.product?.category) set.add(k.product.category);
    });
    return Array.from(set).sort();
  }, [knowledgeList]);

  const filteredList = useMemo(() => {
    return knowledgeList.filter((k) => {
      const matchSearch =
        searchTerm === "" ||
        k.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.benefits?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchSkin =
        selectedSkinConcern === "all" ||
        (k.skin_concerns && k.skin_concerns.includes(selectedSkinConcern));
      const matchSpa =
        selectedSpaType === "all" ||
        (k.suitable_spa_types && k.suitable_spa_types.includes(selectedSpaType));
      const matchCategory = selectedCategory === "all" || k.product?.category === selectedCategory;

      return matchSearch && matchSkin && matchSpa && matchCategory;
    });
  }, [knowledgeList, searchTerm, selectedSkinConcern, selectedSpaType, selectedCategory]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Đã copy ${label}!`);
  };

  const openObjections = (product: ProductKnowledge) => {
    setSelectedProductObj(product);
    setIsObjectionDialogOpen(true);
  };

  if (authLoading || loading) {
    return (
      <CRMPageContainer>
        <CRMPageHeader title="Sales Learning Center" />
        <CRMLoadingState type="card" rows={6} message="Đang tải học liệu..." />
      </CRMPageContainer>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <CRMPageContainer>
        <CRMEmptyState 
          icon={<ShieldAlert className="w-10 h-10 text-rose-600" />}
          title="Không có quyền truy cập"
          description="Khu vực này dành riêng cho đội ngũ Sales & Tư vấn viên."
        />
      </CRMPageContainer>
    );
  }

  return (
    <CRMPageContainer>
      {/* HEADER */}
      <CRMPageHeader
        title="Sales Learning Center"
        icon={<BookOpen className="w-7 h-7 text-indigo-500" />}
        description="Kho tri thức sản phẩm chuẩn hóa dành cho Sales. Nơi cung cấp USP, kịch bản chốt sale và hướng dẫn xử lý từ chối đã được QA phê duyệt."
        badgeText="Phase D - Internal Rollout"
      />

      {/* FILTERS */}
      <CRMCard className="mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm theo tên sản phẩm, công dụng..."
            className="pl-9 bg-slate-50 border-slate-200 h-11 rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <select
            className="h-11 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-w-[140px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Tất cả Nhóm SP</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="h-11 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-w-[140px]"
            value={selectedSkinConcern}
            onChange={(e) => setSelectedSkinConcern(e.target.value)}
          >
            <option value="all">Mọi Vấn Đề Da</option>
            {allSkinConcerns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="h-11 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-w-[140px]"
            value={selectedSpaType}
            onChange={(e) => setSelectedSpaType(e.target.value)}
          >
            <option value="all">Mọi Loại Spa</option>
            {allSpaTypes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </CRMCard>

      {/* CONTENT GRID */}
      {filteredList.length === 0 ? (
        <CRMEmptyState 
          icon={<Search className="w-10 h-10 text-slate-300" />}
          title="Không tìm thấy tài liệu phù hợp"
          description="Hãy thử thay đổi từ khóa hoặc bộ lọc tìm kiếm."
          action={
            <Button
              variant="outline"
              className="mt-6 rounded-xl text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() => {
                setSearchTerm("");
                setSelectedSkinConcern("all");
                setSelectedSpaType("all");
                setSelectedCategory("all");
              }}
            >
              Xóa bộ lọc
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredList.map((pk) => (
            <CRMCard key={pk.id} className="p-0 overflow-hidden">
              <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Basic Info & Badges */}
                <div className="lg:col-span-4 flex flex-col">
                  <div>
                    <Badge
                      variant="outline"
                      className="mb-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 border-indigo-200 bg-indigo-50"
                    >
                      {pk.product?.category || "Sản phẩm"}
                    </Badge>
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight mb-2">
                      {pk.product?.name}
                    </h2>

                    <div className="flex flex-wrap gap-1 mt-4">
                      {pk.skin_concerns?.map((s, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="bg-rose-50 text-rose-700 text-[10px] font-bold hover:bg-rose-100"
                        >
                          <HeartPulse className="w-3 h-3 mr-1" /> {s}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pk.suitable_spa_types?.map((s, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100"
                        >
                          <Target className="w-3 h-3 mr-1" /> {s}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <Clock className="w-3.5 h-3.5" /> Chu kỳ Nhắc Repurchase
                      </p>
                      <p className="text-sm font-bold text-slate-800">
                        {pk.restock_cycle_days ? `${pk.restock_cycle_days} ngày` : "Chưa thiết lập"}
                      </p>
                    </div>

                    {pk.warnings && (
                      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="w-3.5 h-3.5" /> Lưu ý / Chống chỉ định
                        </p>
                        <p className="text-xs font-medium text-amber-900 leading-relaxed">
                          {pk.warnings}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Detailed Knowledge */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  {/* Benefits */}
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Giá trị / Công dụng chính
                      (Benefits)
                    </h3>
                    <div className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-2xl border border-slate-100">
                      {pk.benefits.split("\n").map((line, i) => (
                        <span key={i}>
                          {line}
                          <br />
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sales Pitch */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-indigo-500" /> Kịch bản chốt Sale
                        (Sales Pitch)
                      </h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3"
                        onClick={() => handleCopy(pk.sales_pitch, "Kịch bản chốt sale")}
                      >
                        <Copy className="w-3 h-3 mr-1.5" /> Copy Pitch
                      </Button>
                    </div>
                    <div className="text-sm text-indigo-950 font-medium leading-relaxed bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 whitespace-pre-wrap">
                      {pk.sales_pitch}
                    </div>
                  </div>

                  {/* Usage */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <Leaf className="w-4 h-4 text-emerald-500" /> Hướng dẫn sử dụng
                        </h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] font-bold text-slate-500 hover:text-slate-800 rounded-lg px-2"
                          onClick={() => handleCopy(pk.usage_instructions, "Hướng dẫn sử dụng")}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-2xl">
                        {pk.usage_instructions}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col justify-end gap-3">
                      <Button
                        onClick={() => openObjections(pk)}
                        className="w-full h-12 rounded-xl bg-slate-900 hover:bg-black text-white font-bold shadow-lg shadow-slate-200"
                      >
                        <HelpCircle className="w-4 h-4 mr-2" /> Xử lý từ chối (
                        {(objectionsMap[pk.product_id] || []).length})
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CRMCard>
          ))}
        </div>
      )}

      {/* OBJECTIONS DIALOG */}
      <Dialog open={isObjectionDialogOpen} onOpenChange={setIsObjectionDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-slate-50 rounded-3xl border-none">
          <div className="p-6 bg-white border-b border-slate-100 flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-rose-500" />
                Xử lý từ chối (Objection Handling)
              </DialogTitle>
              <DialogDescription className="mt-2 text-slate-500 font-medium">
                {selectedProductObj?.product?.name}
              </DialogDescription>
            </div>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {selectedProductObj &&
            (!objectionsMap[selectedProductObj.product_id] ||
              objectionsMap[selectedProductObj.product_id].length === 0) ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-600">
                  Chưa có kịch bản xử lý từ chối nào được QA duyệt cho sản phẩm này.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedProductObj &&
                  objectionsMap[selectedProductObj.product_id]?.map((obj) => (
                    <div
                      key={obj.id}
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                    >
                      <div className="p-4 bg-rose-50/50 border-b border-rose-100/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className="bg-white text-rose-600 border-rose-200 text-[10px] font-black uppercase"
                          >
                            {obj.objection_type === "price"
                              ? "Về giá"
                              : obj.objection_type === "competition"
                                ? "Đối thủ"
                                : obj.objection_type === "efficacy"
                                  ? "Hiệu quả"
                                  : "Khác"}
                          </Badge>
                        </div>
                        <p className="text-sm font-bold text-rose-950 italic">
                          "{obj.customer_statement}"
                        </p>
                      </div>
                      <div className="p-4 bg-white relative group">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                          <MessageCircle className="w-3.5 h-3.5" /> Gợi ý trả lời
                        </p>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap pr-10">
                          {obj.suggested_response}
                        </p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl"
                          onClick={() => handleCopy(obj.suggested_response, "Câu trả lời")}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setIsObjectionDialogOpen(false)}
              className="rounded-xl font-bold"
            >
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CRMPageContainer>
  );
}
