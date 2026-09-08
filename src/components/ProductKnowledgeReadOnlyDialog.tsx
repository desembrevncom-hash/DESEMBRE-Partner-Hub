import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles,
  BookOpen,
  ShieldCheck,
  HelpCircle,
  AlertTriangle,
  Leaf,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface ObjectionItem {
  objection_type?: string;
  customer_statement: string;
  suggested_response: string;
}

interface ApprovedKnowledgeData {
  id: string;
  benefits: string;
  ingredient_highlights: string[];
  usage_instructions: string;
  skin_types: string[];
  skin_concerns: string[];
  warnings: string;
  sales_pitch: string;
  routine_position?: string;
  pregnancy_safe?: boolean;
  product_characteristics?: string;
  full_ingredients?: string;
  effects?: string;
  key_ingredients_functions?: Array<{ name: string; function: string }>;
  consultation_notes?: string;
  objections: ObjectionItem[];
  updated_at?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: number;
    dbId?: string;
    name: string;
    brand_name?: string;
    imageUrl?: string;
    description?: string;
  } | null;
}

export function ProductKnowledgeReadOnlyDialog({ isOpen, onClose, product }: Props) {
  const [loading, setLoading] = useState(false);
  const [knowledge, setKnowledge] = useState<ApprovedKnowledgeData | null>(null);

  useEffect(() => {
    if (!isOpen || !product) {
      setKnowledge(null);
      return;
    }

    let isMounted = true;

    async function loadApprovedKnowledge() {
      setLoading(true);
      try {
        // Query strictly approved and active knowledge only
        // NEVER selects raw_text, extracted_text, or document URLs
        let query = supabase
          .from("product_knowledge")
          .select(
            "id, benefits, ingredient_highlights, usage_instructions, skin_types, skin_concerns, warnings, sales_pitch, routine_position, pregnancy_safe, objections, updated_at, qa_status, is_active, product_characteristics, full_ingredients, effects, key_ingredients_functions, consultation_notes",
          )
          .eq("qa_status", "approved")
          .eq("is_active", true);

        if (product?.dbId) {
          query = query.or(`catalog_product_id.eq.${product.dbId},product_id.eq.${product.id}`);
        } else if (product?.id) {
          query = query.eq("product_id", product.id);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error("Error fetching approved product knowledge:", error);
          if (isMounted) setKnowledge(null);
        } else if (data && isMounted) {
          setKnowledge({
            id: data.id,
            benefits: data.benefits || "",
            ingredient_highlights: Array.isArray(data.ingredient_highlights)
              ? data.ingredient_highlights
              : [],
            usage_instructions: data.usage_instructions || "",
            skin_types: Array.isArray(data.skin_types) ? data.skin_types : [],
            skin_concerns: Array.isArray(data.skin_concerns) ? data.skin_concerns : [],
            warnings: data.warnings || "",
            sales_pitch: data.sales_pitch || "",
            routine_position: data.routine_position || "",
            pregnancy_safe: data.pregnancy_safe || false,
            product_characteristics: (data as any).product_characteristics || "",
            full_ingredients: (data as any).full_ingredients || "",
            effects: (data as any).effects || "",
            key_ingredients_functions: Array.isArray((data as any).key_ingredients_functions)
              ? (data as any).key_ingredients_functions
              : [],
            consultation_notes: (data as any).consultation_notes || "",
            objections: Array.isArray(data.objections) ? data.objections : [],
            updated_at: data.updated_at,
          });
        } else if (isMounted) {
          setKnowledge(null);
        }
      } catch (err) {
        console.error("Failed to load approved knowledge:", err);
        if (isMounted) setKnowledge(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadApprovedKnowledge();

    return () => {
      isMounted = false;
    };
  }, [isOpen, product]);

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white border-slate-200 text-slate-900 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left space-y-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Tri thức chuẩn hãng (Đã duyệt)
            </Badge>
            {product.brand_name && (
              <Badge variant="outline" className="text-[10px] font-bold text-slate-500 uppercase">
                {product.brand_name}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl font-black text-slate-900 leading-snug">
            {product.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Thông tin tư vấn chính thức dành cho nhân viên kinh doanh và tư vấn viên.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600 mb-2" />
            <p className="text-xs text-slate-400 font-bold">Đang tải tri thức sản phẩm...</p>
          </div>
        ) : !knowledge ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">Chưa có Tri thức AI được phê duyệt</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Tài liệu sản phẩm đang được rà soát hoặc chưa được phê duyệt chính thức. Vui lòng
                liên hệ Admin để duyệt nội dung trước khi tư vấn khách hàng.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1 rounded-xl h-10 text-xs font-bold">
                <TabsTrigger value="overview" className="rounded-lg">
                  Tổng quan
                </TabsTrigger>
                <TabsTrigger value="ingredients" className="rounded-lg">
                  Thành phần & Da
                </TabsTrigger>
                <TabsTrigger value="usage" className="rounded-lg">
                  Cách dùng
                </TabsTrigger>
                <TabsTrigger value="objections" className="rounded-lg">
                  Tư vấn & FAQ ({knowledge.objections.length})
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: TỔNG QUAN & SALES PITCH */}
              <TabsContent value="overview" className="space-y-3 pt-3">
                {knowledge.product_characteristics && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                      Đặc tính sản phẩm (Characteristics)
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {knowledge.product_characteristics}
                    </p>
                  </div>
                )}

                {knowledge.sales_pitch && (
                  <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 to-blue-50/70 rounded-xl border border-indigo-100/80 space-y-1.5">
                    <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Gợi ý tư vấn &amp; Điểm bán nổi bật (Sales Pitch)
                    </span>
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                      {knowledge.sales_pitch}
                    </p>
                  </div>
                )}

                {knowledge.consultation_notes && knowledge.consultation_notes !== knowledge.sales_pitch && (
                  <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-100 space-y-1.5">
                    <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider">
                      Lưu ý tư vấn bán hàng
                    </span>
                    <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">
                      {knowledge.consultation_notes}
                    </p>
                  </div>
                )}

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Công dụng &amp; Lợi ích chính
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {knowledge.benefits || "Chưa có mô tả công dụng."}
                  </p>
                </div>
              </TabsContent>

              {/* TAB 2: THÀNH PHẦN & ĐỐI TƯỢNG PHÙ HỢP */}
              <TabsContent value="ingredients" className="space-y-3 pt-3">
                {knowledge.key_ingredients_functions && knowledge.key_ingredients_functions.length > 0 ? (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                      Thành phần chính &amp; chức năng ({knowledge.key_ingredients_functions.length})
                    </span>
                    <div className="space-y-1.5">
                      {knowledge.key_ingredients_functions.map((ing, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-xs shadow-3xs"
                        >
                          <span className="font-bold text-slate-900">✦ {ing.name}</span>
                          {ing.function && (
                            <span className="text-slate-600 ml-1.5">: {ing.function}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                      Thành phần nổi bật ({knowledge.ingredient_highlights.length})
                    </span>
                    {knowledge.ingredient_highlights.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {knowledge.ingredient_highlights.map((ing, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-3xs"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Chưa ghi nhận thành phần nổi bật.</p>
                    )}
                  </div>
                )}

                {knowledge.full_ingredients && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                      Bảng thành phần đầy đủ (Full Ingredients)
                    </span>
                    <p className="text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap bg-white p-2 rounded-lg border border-slate-200">
                      {knowledge.full_ingredients}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Loại da phù hợp
                    </span>
                    {knowledge.skin_types.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {knowledge.skin_types.map((st, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="bg-white text-xs border-slate-200 font-semibold"
                          >
                            {st}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Mọi loại da</p>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Vấn đề da quan tâm
                    </span>
                    {knowledge.skin_concerns.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {knowledge.skin_concerns.map((sc, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="bg-white text-xs border-slate-200 font-semibold"
                          >
                            {sc}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">—</p>
                    )}
                  </div>
                </div>

                {knowledge.pregnancy_safe && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Sản phẩm được xác nhận an toàn cho phụ nữ mang thai / cho con bú.
                  </div>
                )}
              </TabsContent>

              {/* TAB 3: HƯỚNG DẪN SỬ DỤNG & CẢNH BÁO */}
              <TabsContent value="usage" className="space-y-3 pt-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Hướng dẫn sử dụng
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {knowledge.usage_instructions || "Chưa có hướng dẫn sử dụng cụ thể."}
                  </p>
                </div>

                {knowledge.routine_position && (
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900">
                    <span className="font-bold">Vị trí trong Routine: </span>
                    {knowledge.routine_position}
                  </div>
                )}

                {knowledge.warnings && (
                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 space-y-1.5">
                    <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Lưu ý &amp; Cảnh báo
                    </span>
                    <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap font-medium">
                      {knowledge.warnings}
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* TAB 4: KỊCH BẢN TƯ VẤN & XỬ LÝ TỪ CHỐI */}
              <TabsContent value="objections" className="space-y-2.5 pt-3">
                {knowledge.objections.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    Chưa có câu hỏi thường gặp hoặc kịch bản từ chối.
                  </div>
                ) : (
                  knowledge.objections.map((obj, i) => (
                    <div
                      key={i}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5"
                    >
                      <div className="flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span className="text-xs font-bold text-slate-900">
                          {obj.customer_statement}
                        </span>
                      </div>
                      <div className="pl-6 text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                        <strong className="text-indigo-600">Gợi ý tư vấn: </strong>
                        {obj.suggested_response}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="border-t border-slate-100 pt-3">
          <Button
            onClick={onClose}
            className="h-9 px-4 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white ml-auto"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
