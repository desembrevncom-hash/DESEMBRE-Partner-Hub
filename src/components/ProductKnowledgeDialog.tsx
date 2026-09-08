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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, Info, BookOpen, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { EmbeddingBuilder } from "./product-knowledge/EmbeddingBuilder";
import type { KeyIngredientFunction } from "@/lib/catalogAdminDb";

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
  catalogProductId?: string | null;
  productName: string;
  onClose: () => void;
  productsList: { id: number; name: string }[];
  onSaved?: () => void;
  isOpenOverride?: boolean;
};

export function ProductKnowledgeDialog({
  productId,
  catalogProductId,
  productName,
  onClose,
  productsList,
  onSaved,
  isOpenOverride,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Guidebook suggestions state
  const [guidebookSuggestionsOpen, setGuidebookSuggestionsOpen] = useState(false);
  const [availableGuidebooks, setAvailableGuidebooks] = useState<any[]>([]);
  const [hasCompletedGuidebooks, setHasCompletedGuidebooks] = useState(false);
  const [loadingAvailableGuidebooks, setLoadingAvailableGuidebooks] = useState(false);
  const [selectedGuidebookDoc, setSelectedGuidebookDoc] = useState<any | null>(null);

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
  const [isPublic, setIsPublic] = useState(false);

  // Phase E Fields
  const [ingredientHighlights, setIngredientHighlights] = useState<string[]>([]);
  const [skinTypes, setSkinTypes] = useState<string[]>([]);
  const [pregnancySafe, setPregnancySafe] = useState(false);
  const [routinePosition, setRoutinePosition] = useState("");
  const [productCharacteristics, setProductCharacteristics] = useState("");
  const [fullIngredients, setFullIngredients] = useState("");
  const [effects, setEffects] = useState("");
  const [keyIngredientsFunctions, setKeyIngredientsFunctions] = useState<KeyIngredientFunction[]>(
    [],
  );
  const [consultationNotes, setConsultationNotes] = useState("");

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

  const isOpen =
    isOpenOverride !== undefined ? isOpenOverride : productId !== null || Boolean(catalogProductId);

  useEffect(() => {
    if (isOpen) {
      loadData(productId, catalogProductId);
    } else {
      resetForm();
    }
  }, [isOpen, productId, catalogProductId]);

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
    setIsPublic(false);
    setIngredientHighlights([]);
    setSkinTypes([]);
    setPregnancySafe(false);
    setRoutinePosition("");
    setProductCharacteristics("");
    setFullIngredients("");
    setEffects("");
    setKeyIngredientsFunctions([]);
    setConsultationNotes("");
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

  const loadData = async (id: number | null, catProdId?: string | null) => {
    setLoading(true);
    try {
      // 1. Fetch Knowledge by catalog_product_id or product_id
      let query = supabase.from("product_knowledge").select("*");
      if (catProdId) {
        if (id !== null) {
          query = query.or(`catalog_product_id.eq.${catProdId},product_id.eq.${id}`);
        } else {
          query = query.eq("catalog_product_id", catProdId);
        }
      } else if (id !== null) {
        query = query.eq("product_id", id);
      } else {
        setLoading(false);
        return;
      }

      const { data: knowledge, error: kError } = await query.maybeSingle();

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
        setIsPublic(knowledge.is_public ?? false);

        // New Phase E fields
        setIngredientHighlights(knowledge.ingredient_highlights || []);
        setSkinTypes(knowledge.skin_types || []);
        setPregnancySafe(knowledge.pregnancy_safe || false);
        setRoutinePosition(knowledge.routine_position || "");
        setProductCharacteristics((knowledge as any).product_characteristics || "");
        setFullIngredients((knowledge as any).full_ingredients || "");
        setEffects((knowledge as any).effects || "");
        setKeyIngredientsFunctions(
          Array.isArray((knowledge as any).key_ingredients_functions)
            ? (knowledge as any).key_ingredients_functions
            : [],
        );
        setConsultationNotes((knowledge as any).consultation_notes || "");

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

      // 2. Fetch Objections if product id is available
      if (id !== null) {
        const { data: objs, error: oError } = await supabase
          .from("product_objections")
          .select("*")
          .eq("product_id", id);

        if (!oError && objs) {
          setObjections(objs);
        } else {
          setObjections([]);
        }
      }

      // 3. Check if completed guidebook documents exist for suggestions CTA
      let targetCatId = catProdId;
      if (!targetCatId && id !== null) {
        const { data: catProd } = await supabase
          .from("catalog_products")
          .select("id")
          .or(`product_code.eq.${id},product_code.eq.0${id}`)
          .maybeSingle();
        targetCatId = catProd?.id || null;
      }
      if (targetCatId) {
        const { data: docs } = await supabase
          .from("product_source_documents")
          .select("id, extraction_status")
          .eq("catalog_product_id", targetCatId)
          .eq("extraction_status", "completed");
        setHasCompletedGuidebooks((docs && docs.length > 0) || false);
      } else {
        setHasCompletedGuidebooks(false);
      }
    } catch (error: any) {
      console.error("Error loading knowledge:", error);
      toast.error("Không thể tải tri thức sản phẩm: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if ((!productId && !catalogProductId) || !user) return;

    if (!benefits.trim() || !usageInstructions.trim() || !salesPitch.trim()) {
      toast.error("Vui lòng điền Lợi ích, Hướng dẫn và Sales Pitch.");
      return;
    }

    setSaving(true);
    try {
      // 1. Upsert Knowledge Data
      const effectiveProductId =
        productId ??
        (catalogProductId
          ? Math.abs(
              catalogProductId
                .split("-")[0]
                .split("")
                .reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0),
            ) % 1000000
          : 999999);

      const extendedFields: Record<string, any> = {
        product_characteristics: productCharacteristics.trim() || null,
        full_ingredients: fullIngredients.trim() || null,
        effects: effects.trim() || null,
        key_ingredients_functions:
          Array.isArray(keyIngredientsFunctions) && keyIngredientsFunctions.length > 0
            ? keyIngredientsFunctions
            : [],
        consultation_notes: consultationNotes.trim() || null,
      };

      const payload: any = {
        ...(knowledgeId ? { id: knowledgeId } : {}),
        product_id: effectiveProductId,
        benefits,
        skin_concerns: skinConcerns,
        suitable_spa_types: suitableSpaTypes,
        usage_instructions: usageInstructions,
        sales_pitch: salesPitch,
        cross_sell_products: crossSellProducts,
        restock_cycle_days: restockCycleDays,
        warnings,
        is_active: isActive,
        is_public: isPublic,
        ...(catalogProductId ? { catalog_product_id: catalogProductId } : {}),
        ingredient_highlights: ingredientHighlights,
        skin_types: skinTypes,
        pregnancy_safe: pregnancySafe,
        routine_position: routinePosition,
        ...extendedFields,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      const conflictTarget = knowledgeId ? "id" : "product_id";
      let upsertData: any = null;

      const { data: initialData, error: kError } = await supabase
        .from("product_knowledge")
        .upsert(payload, { onConflict: conflictTarget, select: "id" })
        .single();

      if (kError) {
        // Defensive backward-safe fallback: If schema cache is stale or extended column missing
        const isColumnError =
          kError.message?.includes("column") ||
          kError.message?.includes("schema cache") ||
          kError.code === "PGRST204";

        if (isColumnError) {
          console.warn(
            "[ProductKnowledgeDialog] Schema cache missing extended column, retrying with core fields:",
            kError.message,
          );
          const legacyPayload = { ...payload };
          delete legacyPayload.product_characteristics;
          delete legacyPayload.full_ingredients;
          delete legacyPayload.effects;
          delete legacyPayload.key_ingredients_functions;
          delete legacyPayload.consultation_notes;

          const { data: fallbackData, error: fallbackError } = await supabase
            .from("product_knowledge")
            .upsert(legacyPayload, { onConflict: conflictTarget, select: "id" })
            .single();

          if (fallbackError) throw fallbackError;
          upsertData = fallbackData;
        } else {
          throw kError;
        }
      } else {
        upsertData = initialData;
      }

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

  const handleOpenGuidebookSuggestions = async () => {
    setLoadingAvailableGuidebooks(true);
    try {
      let targetCatalogId = catalogProductId;
      if (!targetCatalogId && productId) {
        const { data: catProd } = await supabase
          .from("catalog_products")
          .select("id")
          .or(`product_code.eq.${productId},product_code.eq.0${productId}`)
          .maybeSingle();
        targetCatalogId = catProd?.id || null;
      }

      if (!targetCatalogId) {
        toast.info("Không tìm thấy mã Catalog DB để liên kết Guidebook.");
        return;
      }

      const { data: docs, error } = await supabase
        .from("product_source_documents")
        .select("*")
        .eq("catalog_product_id", targetCatalogId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!docs || docs.length === 0) {
        toast.info(
          "Chưa có tài liệu Guidebook nào được tải lên cho sản phẩm này. Hãy mở tab Quản lý Brand & Danh mục để tải lên Guidebook trước.",
        );
        return;
      }

      const completedDocs = docs.filter(
        (d) => d.extraction_status === "completed" && d.extracted_data,
      );

      if (completedDocs.length === 0) {
        toast.warning(
          "Sản phẩm có Guidebook nhưng chưa được trích xuất. Vui lòng bấm 'Trích xuất vào Tri thức' trong phần Quản lý trước.",
        );
        return;
      }

      setAvailableGuidebooks(completedDocs);
      setSelectedGuidebookDoc(completedDocs[0]);
      setGuidebookSuggestionsOpen(true);
    } catch (err: any) {
      toast.error("Lỗi khi tải gợi ý từ Guidebook: " + err.message);
    } finally {
      setLoadingAvailableGuidebooks(false);
    }
  };

  const applyGuidebookSuggestions = () => {
    if (!selectedGuidebookDoc?.extracted_data) return;
    const data = selectedGuidebookDoc.extracted_data;

    // Combine benefits and effects if both exist
    const rawBenefits = data.benefits || "";
    const rawEffects = data.effects || "";
    let combinedBenefits = rawBenefits;
    if (rawEffects && !rawBenefits.includes(rawEffects)) {
      combinedBenefits = rawBenefits ? `${rawBenefits}\n\n${rawEffects}` : rawEffects;
    }
    if (combinedBenefits) setBenefits(combinedBenefits);

    if (data.product_characteristics) {
      setProductCharacteristics(data.product_characteristics);
    }

    if (data.full_ingredients) {
      setFullIngredients(data.full_ingredients);
    }

    if (data.effects) {
      setEffects(data.effects);
    }

    if (
      data.key_ingredients_functions &&
      Array.isArray(data.key_ingredients_functions) &&
      data.key_ingredients_functions.length > 0
    ) {
      setKeyIngredientsFunctions(data.key_ingredients_functions);
      setIngredientHighlights(
        data.key_ingredients_functions.map((k: any) => k.name.trim()),
      );
    } else if (data.ingredient_highlights && Array.isArray(data.ingredient_highlights)) {
      setIngredientHighlights(data.ingredient_highlights);
      setKeyIngredientsFunctions(
        data.ingredient_highlights.map((item: string) => {
          const colonIdx = item.indexOf(":");
          if (colonIdx !== -1) {
            return {
              name: item.slice(0, colonIdx).trim(),
              function: item.slice(colonIdx + 1).trim(),
            };
          }
          return { name: item.trim(), function: "" };
        }),
      );
    }

    if (data.usage_instructions) setUsageInstructions(data.usage_instructions);
    if (data.skin_types && Array.isArray(data.skin_types)) {
      setSkinTypes(data.skin_types);
    }
    if (data.skin_concerns && Array.isArray(data.skin_concerns)) {
      setSkinConcerns(data.skin_concerns);
    }
    if (data.warnings) setWarnings(data.warnings);
    if (data.sales_pitch) {
      setSalesPitch(data.sales_pitch);
      setConsultationNotes(data.sales_pitch);
    }

    if (data.objections && Array.isArray(data.objections) && data.objections.length > 0) {
      const newObjs: Objection[] = data.objections.map((o: any) => ({
        product_id: productId || 0,
        objection_type: o.objection_type || "Chung",
        customer_statement: o.customer_statement || "",
        suggested_response: o.suggested_response || "",
        is_active: true,
      }));
      setObjections(newObjs);
    }

    // Set qa_status to draft or review, NEVER approved automatically
    setQaStatus("draft");

    setGuidebookSuggestionsOpen(false);
    toast.success(
      "Đã nạp gợi ý từ Guidebook vào biểu mẫu (Trạng thái: BẢN NHÁP). Hãy rà soát lại và bấm 'Lưu thay đổi' để hoàn tất.",
      { duration: 5000 },
    );
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
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>Tri thức AI: {productName}</span>
              {qaStatus && (
                <Badge
                  className={
                    qaStatus === "approved"
                      ? "bg-green-500/10 text-green-400 border border-green-500/30"
                      : qaStatus === "review"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                  }
                >
                  {qaStatus.toUpperCase()}
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleOpenGuidebookSuggestions}
              disabled={loadingAvailableGuidebooks}
              className="h-8 px-3 text-xs font-bold rounded-lg border-indigo-400/40 text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 hover:text-white"
            >
              {loadingAvailableGuidebooks ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <BookOpen className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              )}
              Nhập từ Guidebook
            </Button>
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
                {/* PROMINENT GUIDEBOOK SUGGESTIONS BANNER */}
                {hasCompletedGuidebooks && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/90 via-purple-950/70 to-slate-900 border border-indigo-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-indigo-200">
                          Đã có dữ liệu trích xuất từ Guidebook!
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Bấm để nạp cấu trúc công dụng, thành phần, HDSD &amp; xử lý từ chối vào
                          bản nháp để duyệt.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleOpenGuidebookSuggestions}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 shadow-sm w-full sm:w-auto"
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Nhập từ Guidebook
                    </Button>
                  </div>
                )}

                {/* SECTION: THÔNG TIN CHUNG */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                    Thông tin cơ bản
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400">
                        Trạng thái (Active)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                        <span className="text-xs text-slate-500">
                          {isActive ? "Đang bật" : "Đã tắt"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400">
                        Hiển thị trên catalog công khai (/san-pham)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                        <span className="text-xs text-slate-500">
                          {isPublic
                            ? "Công khai (Yêu cầu QA: Approved)"
                            : "Nội bộ (Ẩn khỏi catalog)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Đặc tính sản phẩm (Product Characteristics)
                    </Label>
                    <Textarea
                      value={productCharacteristics}
                      onChange={(e) => setProductCharacteristics(e.target.value)}
                      placeholder="Mô tả đặc tính, kết cấu, công nghệ sản phẩm..."
                      className="min-h-[70px] bg-slate-900 border-slate-800"
                    />
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
                      Hiệu quả &amp; tác dụng (Effects)
                    </Label>
                    <Textarea
                      value={effects}
                      onChange={(e) => setEffects(e.target.value)}
                      placeholder="Hiệu quả và tác dụng chi tiết..."
                      className="min-h-[70px] bg-slate-900 border-slate-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Thành phần nổi bật (Ingredient Highlights - Mỗi thành phần 1 dòng)
                    </Label>
                    <Textarea
                      value={ingredientHighlights.join("\n")}
                      onChange={(e) => {
                        const lines = e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        setIngredientHighlights(lines);
                        setKeyIngredientsFunctions(
                          lines.map((line) => {
                            const colonIdx = line.indexOf(":");
                            if (colonIdx !== -1) {
                              return {
                                name: line.slice(0, colonIdx).trim(),
                                function: line.slice(colonIdx + 1).trim(),
                              };
                            }
                            return { name: line.trim(), function: "" };
                          }),
                        );
                      }}
                      placeholder="Chiết xuất hạt mắc ca: Dưỡng ẩm sâu&#10;Glycerin: Giữ nước..."
                      className="min-h-[80px] bg-slate-900 border-slate-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Bảng thành phần đầy đủ (Full Ingredients)
                    </Label>
                    <Textarea
                      value={fullIngredients}
                      onChange={(e) => setFullIngredients(e.target.value)}
                      placeholder="Water, Glycerin, Butylene Glycol..."
                      className="min-h-[70px] bg-slate-900 border-slate-800 text-xs"
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

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">
                      Lưu ý tư vấn bán hàng (Consultation Notes)
                    </Label>
                    <Textarea
                      value={consultationNotes}
                      onChange={(e) => setConsultationNotes(e.target.value)}
                      placeholder="Lưu ý quan trọng cho telesale / tư vấn viên..."
                      className="min-h-[70px] bg-slate-900 border-slate-800"
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

      {/* GUIDEBOOK SUGGESTIONS PREVIEW MODAL */}
      <Dialog open={guidebookSuggestionsOpen} onOpenChange={setGuidebookSuggestionsOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-indigo-400">
              <BookOpen className="w-5 h-5" />
              Gợi ý trích xuất từ Guidebook
            </DialogTitle>
          </DialogHeader>

          {selectedGuidebookDoc ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      selectedGuidebookDoc.source_type === "text" || !selectedGuidebookDoc.file_url
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {selectedGuidebookDoc.source_type === "text" || !selectedGuidebookDoc.file_url
                      ? "Text"
                      : "File"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-200">
                      {selectedGuidebookDoc.file_name || "Tài liệu Guidebook"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Trích xuất:{" "}
                      {new Date(selectedGuidebookDoc.updated_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
                {availableGuidebooks.length > 1 && (
                  <Select
                    value={selectedGuidebookDoc.id}
                    onValueChange={(val) => {
                      const found = availableGuidebooks.find((d) => d.id === val);
                      if (found) setSelectedGuidebookDoc(found);
                    }}
                  >
                    <SelectTrigger className="h-8 w-48 bg-slate-800 border-slate-700 text-xs">
                      <SelectValue placeholder="Chọn tài liệu khác" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                      {availableGuidebooks.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">
                          {d.source_type === "text" || !d.file_url ? "[Text] " : "[File] "}
                          {d.file_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-3">
                {selectedGuidebookDoc.extracted_data?.product_characteristics && (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1">
                      Đặc tính sản phẩm (Characteristics):
                    </span>
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedGuidebookDoc.extracted_data.product_characteristics}
                    </p>
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="font-bold text-indigo-300 block mb-1">Công dụng chính:</span>
                  <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedGuidebookDoc.extracted_data?.benefits || "(Không có)"}
                  </p>
                </div>

                {selectedGuidebookDoc.extracted_data?.effects && (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1">
                      Hiệu quả &amp; tác dụng (Effects):
                    </span>
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedGuidebookDoc.extracted_data.effects}
                    </p>
                  </div>
                )}

                {selectedGuidebookDoc.extracted_data?.key_ingredients_functions &&
                selectedGuidebookDoc.extracted_data.key_ingredients_functions.length > 0 ? (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1.5">
                      Thành phần chính &amp; chức năng (
                      {selectedGuidebookDoc.extracted_data.key_ingredients_functions.length}):
                    </span>
                    <div className="space-y-1.5">
                      {selectedGuidebookDoc.extracted_data.key_ingredients_functions.map(
                        (item: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded bg-slate-900 border border-slate-800/90 text-xs"
                          >
                            <span className="font-bold text-emerald-400">✦ {item.name}</span>
                            {item.function ? (
                              <span className="text-slate-300 ml-1.5">— {item.function}</span>
                            ) : null}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1">
                      Thành phần nổi bật:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedGuidebookDoc.extracted_data?.ingredient_highlights?.map(
                        (ing: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]"
                          >
                            {ing}
                          </span>
                        ),
                      ) || "(Không có)"}
                    </div>
                  </div>
                )}

                {selectedGuidebookDoc.extracted_data?.full_ingredients && (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1">
                      Bảng thành phần đầy đủ (Full Ingredients):
                    </span>
                    <p className="text-slate-300 text-xs whitespace-pre-wrap leading-relaxed font-mono">
                      {selectedGuidebookDoc.extracted_data.full_ingredients}
                    </p>
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="font-bold text-indigo-300 block mb-1">Hướng dẫn sử dụng:</span>
                  <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedGuidebookDoc.extracted_data?.usage_instructions || "(Không có)"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1">Loại da phù hợp:</span>
                    <p className="text-slate-300">
                      {selectedGuidebookDoc.extracted_data?.skin_types?.join(", ") || "(Không có)"}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1">
                      Vấn đề da quan tâm:
                    </span>
                    <p className="text-slate-300">
                      {selectedGuidebookDoc.extracted_data?.skin_concerns?.join(", ") ||
                        "(Không có)"}
                    </p>
                  </div>
                </div>

                {selectedGuidebookDoc.extracted_data?.warnings && (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-1">Cảnh báo / Lưu ý:</span>
                    <p className="text-slate-300">{selectedGuidebookDoc.extracted_data.warnings}</p>
                  </div>
                )}

                {selectedGuidebookDoc.extracted_data?.sales_pitch && (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1">Sales Pitch:</span>
                    <p className="text-slate-300">
                      {selectedGuidebookDoc.extracted_data.sales_pitch}
                    </p>
                  </div>
                )}

                {selectedGuidebookDoc.extracted_data?.objections?.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="font-bold text-indigo-300 block mb-1">
                      Kịch bản xử lý từ chối (
                      {selectedGuidebookDoc.extracted_data.objections.length}):
                    </span>
                    <div className="space-y-1.5">
                      {selectedGuidebookDoc.extracted_data.objections.map((o: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-1.5 bg-slate-900 rounded border border-slate-800/80"
                        >
                          <p className="font-semibold text-slate-200">❓ {o.customer_statement}</p>
                          <p className="text-slate-400 mt-0.5">💬 {o.suggested_response}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-[11px] flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    <strong>Quy tắc bảo vệ dữ liệu:</strong> Dữ liệu áp dụng sẽ được đưa vào biểu
                    mẫu dưới dạng <strong>BẢN NHÁP (Draft)</strong>. Bạn cần rà soát và bấm{" "}
                    <strong>Lưu Tri Thức</strong> để hoàn tất. Hệ thống không tự động phê duyệt.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">Không có dữ liệu trích xuất.</p>
          )}

          <DialogFooter className="border-t border-slate-800 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGuidebookSuggestionsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              onClick={applyGuidebookSuggestions}
              disabled={!selectedGuidebookDoc?.extracted_data}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Áp dụng vào biểu mẫu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
