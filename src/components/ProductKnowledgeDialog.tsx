/* eslint-disable */
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { EmbeddingBuilder } from "./product-knowledge/EmbeddingBuilder";

const SKIN_CONCERNS_TAGS = [
  "Da mụn",
  "Thâm nám",
  "Lão hóa",
  "Nhạy cảm",
  "Phục hồi",
  "Da dầu",
  "Da khô",
  "Lỗ chân lông to",
  "Da xỉn màu",
];

const SPA_TYPES_TAGS = ["Spa trị liệu", "Spa thư giãn", "Thẩm mỹ viện/Clinic", "Home Spa"];

const SKIN_TYPES_TAGS = ["Da thường", "Da khô", "Da dầu", "Da hỗn hợp", "Da nhạy cảm"];

const QA_STATUSES = [
  { value: "draft", label: "Bản nháp" },
  { value: "review", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "archived", label: "Lưu trữ" },
];

type Objection = {
  id?: string;
  product_id: number;
  objection_type: string;
  customer_statement: string;
  suggested_response: string;
  is_active: boolean;
  isDeleted?: boolean;
};

type Props = {
  productId: number | null;
  productName: string;
  onClose: () => void;
  productsList: { id: number; name: string }[];
  onSaved?: () => void;
};

export function ProductKnowledgeDialog({
  productId,
  productName,
  onClose,
  productsList,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Internal Knowledge ID
  const [knowledgeId, setKnowledgeId] = useState<string | null>(null);

  // Form state
  const [benefits, setBenefits] = useState("");
  const [skinConcerns, setSkinConcerns] = useState<string[]>([]);
  const [suitableSpaTypes, setSuitableSpaTypes] = useState<string[]>([]);
  const [usageInstructions, setUsageInstructions] = useState("");
  const [salesPitch, setSalesPitch] = useState("");
  const [crossSellProducts, setCrossSellProducts] = useState<number[]>([]);
  const [restockCycleDays, setRestockCycleDays] = useState(60);
  const [warnings, setWarnings] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Phase E Fields
  const [ingredientHighlights, setIngredientHighlights] = useState<string[]>([]);
  const [skinTypes, setSkinTypes] = useState<string[]>([]);
  const [pregnancySafe, setPregnancySafe] = useState(false);
  const [routinePosition, setRoutinePosition] = useState("");

  // QA Fields
  const [qaStatus, setQaStatus] = useState("draft");
  const [note, setNote] = useState("");
  const [statusReasonType, setStatusReasonType] = useState("");
  const [auditHistory, setAuditHistory] = useState<any[]>([]);

  // Embedding / Build status
  const [buildStatus, setBuildStatus] = useState("pending");
  const [knowledgeVersion, setKnowledgeVersion] = useState(1);
  const [lastEmbeddedAt, setLastEmbeddedAt] = useState<string | null>(null);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);

  // Objections state
  const [objections, setObjections] = useState<Objection[]>([]);

  const isOpen = productId !== null;

  useEffect(() => {
    if (productId !== null) {
      loadData(productId);
    } else {
      resetForm();
    }
  }, [productId]);

  const resetForm = () => {
    setKnowledgeId(null);
    setBenefits("");
    setSkinConcerns([]);
    setSuitableSpaTypes([]);
    setUsageInstructions("");
    setSalesPitch("");
    setCrossSellProducts([]);
    setRestockCycleDays(60);
    setWarnings("");
    setIsActive(true);
    setIngredientHighlights([]);
    setSkinTypes([]);
    setPregnancySafe(false);
    setRoutinePosition("");
    setQaStatus("draft");
    setNote("");
    setStatusReasonType("");
    setAuditHistory([]);
    setObjections([]);

    setBuildStatus("pending");
    setKnowledgeVersion(1);
    setLastEmbeddedAt(null);
    setEmbeddingError(null);
  };

  const loadData = async (id: number) => {
    setLoading(true);
    try {
      // Fetch Knowledge
      const { data: knowledge, error: kError } = await supabase
        .from("product_knowledge")
        .select("*")
        .eq("product_id", id)
        .maybeSingle();

      if (kError) throw kError;

      if (knowledge) {
        setKnowledgeId(knowledge.id);
        setBenefits(knowledge.benefits || "");
        setSkinConcerns(knowledge.skin_concerns || []);
        setSuitableSpaTypes(knowledge.suitable_spa_types || []);
        setUsageInstructions(knowledge.usage_instructions || "");
        setSalesPitch(knowledge.sales_pitch || "");
        setCrossSellProducts(knowledge.cross_sell_products || []);
        setRestockCycleDays(knowledge.restock_cycle_days || 60);
        setWarnings(knowledge.warnings || "");
        setIsActive(knowledge.is_active ?? true);

        // New Phase E fields
        setIngredientHighlights(knowledge.ingredient_highlights || []);
        setSkinTypes(knowledge.skin_types || []);
        setPregnancySafe(knowledge.pregnancy_safe || false);
        setRoutinePosition(knowledge.routine_position || "");

        setQaStatus(knowledge.qa_status || "draft");
        setStatusReasonType(knowledge.status_reason_type || "");

        setBuildStatus(knowledge.build_status || "pending");
        setKnowledgeVersion(knowledge.knowledge_version || 1);
        setLastEmbeddedAt(knowledge.last_embedded_at || null);
        setEmbeddingError(knowledge.embedding_error || null);

        // Fetch Audit History
        const { data: history } = await supabase
          .from("product_knowledge_status_changes")
          .select("*, changed_by_user:auth.users!changed_by(email)")
          .eq("product_knowledge_id", knowledge.id)
          .order("created_at", { ascending: false });

        if (history) setAuditHistory(history);
      } else {
        resetForm();
      }

      // Fetch Objections
      const { data: objs, error: oError } = await supabase
        .from("product_objections")
        .select("*")
        .eq("product_id", id);

      if (oError) throw oError;

      if (objs) {
        setObjections(objs);
      } else {
        setObjections([]);
      }
    } catch (error: any) {
      console.error("Error loading knowledge:", error);
      toast.error("Không thể tải tri thức sản phẩm: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!productId || !user) return;

    if (!benefits.trim() || !usageInstructions.trim() || !salesPitch.trim()) {
      toast.error("Vui lòng điền Lợi ích, Hướng dẫn và Sales Pitch.");
      return;
    }

    setSaving(true);
    try {
      // 1. Upsert Knowledge Data
      const { data: upsertData, error: kError } = await supabase
        .from("product_knowledge")
        .upsert(
          {
            product_id: productId,
            benefits,
            skin_concerns: skinConcerns,
            suitable_spa_types: suitableSpaTypes,
            usage_instructions: usageInstructions,
            sales_pitch: salesPitch,
            cross_sell_products: crossSellProducts,
            restock_cycle_days: restockCycleDays,
            warnings,
            is_active: isActive,
            ingredient_highlights: ingredientHighlights,
            skin_types: skinTypes,
            pregnancy_safe: pregnancySafe,
            routine_position: routinePosition,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          { onConflict: "product_id", select: "id" },
        )
        .single();

      if (kError) throw kError;

      const currentKnowledgeId = upsertData?.id || knowledgeId;

      // 2. Update QA Status via RPC if changed or has note
      if (currentKnowledgeId && (note || qaStatus)) {
        try {
          await supabase.rpc("update_product_knowledge_status", {
            p_id: currentKnowledgeId,
            new_status: qaStatus,
            note: note,
            status_reason_type: statusReasonType,
          });
        } catch (rpcError: any) {
          console.error("QA Status update failed:", rpcError);
          // May fail if not admin, ignore or show soft warning
          toast.warning(
            "Lưu dữ liệu thành công nhưng không thể cập nhật trạng thái QA: " + rpcError.message,
          );
        }
      }

      // 3. Process Objections
      for (const obj of objections) {
        if (obj.isDeleted) {
          if (obj.id) {
            const { error } = await supabase.from("product_objections").delete().eq("id", obj.id);
            if (error) throw error;
          }
        } else if (obj.id) {
          const { error } = await supabase
            .from("product_objections")
            .update({
              objection_type: obj.objection_type,
              customer_statement: obj.customer_statement,
              suggested_response: obj.suggested_response,
              is_active: obj.is_active,
              updated_at: new Date().toISOString(),
              updated_by: user.id,
            })
            .eq("id", obj.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("product_objections").insert({
            product_id: productId,
            objection_type: obj.objection_type,
            customer_statement: obj.customer_statement,
            suggested_response: obj.suggested_response,
            is_active: obj.is_active,
            created_by: user.id,
            updated_by: user.id,
          });
          if (error) throw error;
        }
      }

      toast.success("Lưu tri thức sản phẩm thành công!");
      if (onSaved) onSaved();
      onClose();
    } catch (error: any) {
      console.error("Error saving knowledge:", error);
      toast.error("Lưu thất bại: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (currentTags: string[], setTags: (t: string[]) => void, tag: string) => {
    if (currentTags.includes(tag)) {
      setTags(currentTags.filter((t) => t !== tag));
    } else {
      setTags([...currentTags, tag]);
    }
  };

  const toggleCrossSell = (id: number) => {
    if (crossSellProducts.includes(id)) {
      setCrossSellProducts(crossSellProducts.filter((p) => p !== id));
    } else {
      setCrossSellProducts([...crossSellProducts, id]);
    }
  };

  const addObjection = () => {
    setObjections([
      ...objections,
      {
        product_id: productId!,
        objection_type: "",
        customer_statement: "",
        suggested_response: "",
        is_active: true,
      },
    ]);
  };

  const updateObjection = (index: number, field: keyof Objection, value: any) => {
    const newObjs = [...objections];
    newObjs[index] = { ...newObjs[index], [field]: value };
    setObjections(newObjs);
  };

  const removeObjection = (index: number) => {
    const newObjs = [...objections];
    newObjs[index].isDeleted = true;
    setObjections(newObjs);
  };

  const activeObjections = objections.filter((o) => !o.isDeleted);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-950 border-slate-800">
        <DialogHeader className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <DialogTitle className="text-xl font-black text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-indigo-400" />
              Cập nhật Tri thức: {productName}
            </div>
            {qaStatus && (
              <Badge
                className={
                  qaStatus === "approved"
                    ? "bg-green-500/10 text-green-400"
                    : qaStatus === "review"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-slate-800 text-slate-400"
                }
              >
                {qaStatus.toUpperCase()}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 text-slate-200">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
              <p className="text-slate-400 font-medium">Đang tải tri thức...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT COLUMN: Data Entry */}
              <div className="lg:col-span-2 space-y-8">
                {/* SECTION: THÔNG TIN CHUNG */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                    Thông tin cơ bản
                  </h3>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">Trạng thái (Active)</Label>
                    <div className="flex items-center gap-2">
                      <Switch checked={isActive} onCheckedChange={setIsActive} />
                      <span className="text-xs text-slate-500">
                        {isActive ? "Đang bật" : "Đã tắt"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Công dụng chính (Benefits) <span className="text-red-400">*</span>
                    </Label>
                    <Textarea
                      value={benefits}
                      onChange={(e) => setBenefits(e.target.value)}
                      placeholder="Mô tả công dụng và lợi ích chính..."
                      className="min-h-[80px] bg-slate-900 border-slate-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Thành phần nổi bật (Ingredient Highlights - Cách nhau bởi dấu phẩy)
                    </Label>
                    <Textarea
                      value={ingredientHighlights.join(", ")}
                      onChange={(e) =>
                        setIngredientHighlights(
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="Niacinamide, Retinol, HA..."
                      className="min-h-[60px] bg-slate-900 border-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400">
                        Vị trí trong Routine (Routine Position)
                      </Label>
                      <Input
                        value={routinePosition}
                        onChange={(e) => setRoutinePosition(e.target.value)}
                        placeholder="VD: Sau toner, trước kem dưỡng..."
                        className="bg-slate-900 border-slate-800 h-11 md:h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400">An toàn mẹ bầu</Label>
                      <div className="flex items-center gap-2 h-10 px-3 bg-slate-900 border border-slate-800 rounded-md">
                        <Switch checked={pregnancySafe} onCheckedChange={setPregnancySafe} />
                        <span className="text-xs text-slate-500">
                          {pregnancySafe ? "Có thể dùng" : "Không an toàn"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">Loại da (Skin Types)</Label>
                    <div className="flex flex-wrap gap-2">
                      {SKIN_TYPES_TAGS.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className={`cursor-pointer transition-colors ${skinTypes.includes(tag) ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"}`}
                          onClick={() => toggleTag(skinTypes, setSkinTypes, tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Vấn đề da (Skin Concerns)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {SKIN_CONCERNS_TAGS.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className={`cursor-pointer transition-colors ${skinConcerns.includes(tag) ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"}`}
                          onClick={() => toggleTag(skinConcerns, setSkinConcerns, tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SECTION: HƯỚNG DẪN & SALES PITCH */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                    Hướng dẫn & Tư vấn
                  </h3>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Hướng dẫn sử dụng (Usage) <span className="text-red-400">*</span>
                    </Label>
                    <Textarea
                      value={usageInstructions}
                      onChange={(e) => setUsageInstructions(e.target.value)}
                      placeholder="Cách dùng, liều lượng..."
                      className="min-h-[80px] bg-slate-900 border-slate-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Sales Pitch (Câu chào hàng) <span className="text-red-400">*</span>
                    </Label>
                    <Textarea
                      value={salesPitch}
                      onChange={(e) => setSalesPitch(e.target.value)}
                      placeholder="Câu chốt sale ấn tượng, lý do khách nên mua..."
                      className="min-h-[80px] bg-slate-900 border-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400">
                        Chu kỳ mua lại (Ngày)
                      </Label>
                      <Input
                        type="number"
                        value={restockCycleDays}
                        onChange={(e) => setRestockCycleDays(parseInt(e.target.value) || 0)}
                        className="bg-slate-900 border-slate-800 h-11 md:h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400">
                        Chống chỉ định (Warnings)
                      </Label>
                      <Input
                        value={warnings}
                        onChange={(e) => setWarnings(e.target.value)}
                        placeholder="Lưu ý khi dùng..."
                        className="bg-slate-900 border-slate-800 h-11 md:h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Sản phẩm bán kèm (Cross-sell)
                    </Label>
                    <div className="h-32 overflow-y-auto bg-slate-900 border border-slate-800 rounded-md p-2">
                      {productsList.map((p) => {
                        if (p.id === productId) return null;
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={crossSellProducts.includes(p.id)}
                              onChange={() => toggleCrossSell(p.id)}
                              className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-300">{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* SECTION: XỬ LÝ TỪ CHỐI */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest">
                      Xử lý từ chối (Objections)
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addObjection}
                      className="h-7 text-xs bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-white"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Thêm tình huống
                    </Button>
                  </div>

                  {activeObjections.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      Chưa có kịch bản xử lý từ chối nào.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {objections.map((obj, idx) => {
                        if (obj.isDeleted) return null;
                        return (
                          <div
                            key={idx}
                            className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3 relative group"
                          >
                            <button
                              onClick={() => removeObjection(idx)}
                              className="absolute top-3 right-3 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="grid grid-cols-2 gap-3 pr-8">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                  Loại từ chối
                                </Label>
                                <Input
                                  value={obj.objection_type}
                                  onChange={(e) =>
                                    updateObjection(idx, "objection_type", e.target.value)
                                  }
                                  placeholder="VD: Giá cao, Mùi hắc..."
                                  className="h-11 md:h-8 text-xs bg-slate-950 border-slate-800"
                                />
                              </div>
                              <div className="space-y-1 flex flex-col justify-center">
                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                                  Trạng thái
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={obj.is_active}
                                    onCheckedChange={(v) => updateObjection(idx, "is_active", v)}
                                  />
                                  <span className="text-xs text-slate-400">
                                    {obj.is_active ? "Sử dụng" : "Vô hiệu hoá"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                Khách hàng nói gì?
                              </Label>
                              <Textarea
                                value={obj.customer_statement}
                                onChange={(e) =>
                                  updateObjection(idx, "customer_statement", e.target.value)
                                }
                                placeholder="Câu phản ứng của khách..."
                                className="min-h-[60px] text-xs bg-slate-950 border-slate-800"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                Gợi ý trả lời
                              </Label>
                              <Textarea
                                value={obj.suggested_response}
                                onChange={(e) =>
                                  updateObjection(idx, "suggested_response", e.target.value)
                                }
                                placeholder="Cách xử lý thuyết phục nhất..."
                                className="min-h-[60px] text-xs bg-slate-950 border-slate-800"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: QA & AI */}
              <div className="space-y-6">
                {/* QA STATUS */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                    QA & Duyệt Tri Thức
                  </h3>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Trạng thái duyệt (QA Status)
                    </Label>
                    <select
                      value={qaStatus}
                      onChange={(e) => setQaStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md h-11 md:h-10 px-3 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500"
                    >
                      {QA_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Loại thay đổi (Reason Type)
                    </Label>
                    <Input
                      value={statusReasonType}
                      onChange={(e) => setStatusReasonType(e.target.value)}
                      placeholder="VD: Chỉnh sửa công dụng, update giá..."
                      className="bg-slate-950 border-slate-800 h-11 md:h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">Ghi chú duyệt (Note)</Label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Lý do từ chối hoặc note thêm..."
                      className="min-h-[80px] bg-slate-950 border-slate-800"
                    />
                  </div>

                  {auditHistory.length > 0 && (
                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <Label className="text-xs font-bold text-slate-400 mb-2 block">
                        Lịch sử Duyệt (Audit)
                      </Label>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {auditHistory.map((h) => (
                          <div
                            key={h.id}
                            className="text-[10px] bg-slate-950 p-2 rounded border border-slate-800"
                          >
                            <div className="flex justify-between text-slate-500">
                              <span>{new Date(h.created_at).toLocaleDateString("vi-VN")}</span>
                              <span className="font-mono">
                                {h.changed_by_user?.email || "Unknown"}
                              </span>
                            </div>
                            <div className="mt-1 font-bold">
                              <span className="text-slate-400">{h.from_status}</span>
                              {" -> "}
                              <span className="text-indigo-400">{h.to_status}</span>
                            </div>
                            {h.note && <p className="text-slate-400 mt-1 italic">"{h.note}"</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* EMBEDDING BUILDER */}
                <EmbeddingBuilder
                  knowledgeId={knowledgeId}
                  productId={productId}
                  qaStatus={qaStatus}
                  isActive={isActive}
                  buildStatus={buildStatus}
                  knowledgeVersion={knowledgeVersion}
                  lastEmbeddedAt={lastEmbeddedAt}
                  embeddingError={embeddingError}
                  onEmbeddingComplete={() => {
                    if (productId) loadData(productId);
                  }}
                />

                {/* AI CONTEXT PREVIEW */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex-1">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                      AI Context Preview
                      <Info className="w-4 h-4" />
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Mô phỏng dữ liệu văn bản mà AI Assistant sẽ đọc để trả lời câu hỏi về sản phẩm
                    này (dựa trên thông tin bên trái).
                  </p>
                  <Textarea
                    readOnly
                    className="min-h-[200px] text-[10px] font-mono bg-slate-950 border-slate-800 text-slate-400 focus-visible:ring-0"
                    value={`[Tên]: ${productName}\n[Thành phần]: ${ingredientHighlights.join(", ")}\n[Loại da]: ${skinTypes.join(", ")}\n[Mẹ bầu]: ${pregnancySafe ? "An toàn" : "Không"}\n[Routine]: ${routinePosition}\n[Công dụng]: ${benefits}\n[HDSD]: ${usageInstructions}\n[Lưu ý]: ${warnings}`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 hover:text-white"
          >
            Đóng
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Lưu Tri Thức
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SparklesIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
