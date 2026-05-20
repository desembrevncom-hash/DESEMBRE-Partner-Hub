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
import { Loader2, Plus, Trash2, Save, X, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const SKIN_CONCERNS_TAGS = [
  "Da mụn", "Thâm nám", "Lão hóa", "Nhạy cảm", "Phục hồi", 
  "Da dầu", "Da khô", "Lỗ chân lông to", "Da xỉn màu"
];

const SPA_TYPES_TAGS = [
  "Spa trị liệu", "Spa thư giãn", "Thẩm mỹ viện/Clinic", "Home Spa"
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

export function ProductKnowledgeDialog({ productId, productName, onClose, productsList, onSaved }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
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
    setBenefits("");
    setSkinConcerns([]);
    setSuitableSpaTypes([]);
    setUsageInstructions("");
    setSalesPitch("");
    setCrossSellProducts([]);
    setRestockCycleDays(60);
    setWarnings("");
    setIsActive(true);
    setObjections([]);
  };

  const loadData = async (id: number) => {
    setLoading(true);
    try {
      // Fetch Knowledge
      const { data: knowledge, error: kError } = await supabase
        .from('product_knowledge')
        .select('*')
        .eq('product_id', id)
        .maybeSingle();

      if (kError) throw kError;

      if (knowledge) {
        setBenefits(knowledge.benefits || "");
        setSkinConcerns(knowledge.skin_concerns || []);
        setSuitableSpaTypes(knowledge.suitable_spa_types || []);
        setUsageInstructions(knowledge.usage_instructions || "");
        setSalesPitch(knowledge.sales_pitch || "");
        setCrossSellProducts(knowledge.cross_sell_products || []);
        setRestockCycleDays(knowledge.restock_cycle_days || 60);
        setWarnings(knowledge.warnings || "");
        setIsActive(knowledge.is_active ?? true);
      } else {
        resetForm(); // Ensure empty state for new
      }

      // Fetch Objections
      const { data: objs, error: oError } = await supabase
        .from('product_objections')
        .select('*')
        .eq('product_id', id);

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
      // 1. Upsert Knowledge
      const { error: kError } = await supabase
        .from('product_knowledge')
        .upsert({
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
          updated_at: new Date().toISOString(),
          updated_by: user.id
        }, { onConflict: 'product_id' });

      if (kError) throw kError;

      // 2. Process Objections
      for (const obj of objections) {
        if (obj.isDeleted) {
          if (obj.id) {
            // Delete from DB
            const { error } = await supabase.from('product_objections').delete().eq('id', obj.id);
            if (error) throw error;
          }
        } else if (obj.id) {
          // Update
          const { error } = await supabase.from('product_objections').update({
            objection_type: obj.objection_type,
            customer_statement: obj.customer_statement,
            suggested_response: obj.suggested_response,
            is_active: obj.is_active,
            updated_at: new Date().toISOString(),
            updated_by: user.id
          }).eq('id', obj.id);
          if (error) throw error;
        } else {
          // Insert
          const { error } = await supabase.from('product_objections').insert({
            product_id: productId,
            objection_type: obj.objection_type,
            customer_statement: obj.customer_statement,
            suggested_response: obj.suggested_response,
            is_active: obj.is_active,
            created_by: user.id,
            updated_by: user.id
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
      setTags(currentTags.filter(t => t !== tag));
    } else {
      setTags([...currentTags, tag]);
    }
  };

  const toggleCrossSell = (id: number) => {
    if (crossSellProducts.includes(id)) {
      setCrossSellProducts(crossSellProducts.filter(p => p !== id));
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
        is_active: true 
      }
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

  const activeObjections = objections.filter(o => !o.isDeleted);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-950 border-slate-800">
        <DialogHeader className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-indigo-400" />
            Cấu hình Tri thức: {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 text-slate-200">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
              <p className="text-slate-400 font-medium">Đang tải tri thức...</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {!benefits && activeObjections.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Sản phẩm này chưa có tri thức tư vấn</h4>
                    <p className="text-xs text-slate-400 mt-1">Hãy bổ sung thông tin để AI Sales Assistant và Sale team có thể tư vấn chuẩn xác nhất.</p>
                  </div>
                </div>
              )}

              {/* SECTION: THÔNG TIN CHUNG */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-2">Thông tin chung</h3>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400">Trạng thái hiển thị (Active)</Label>
                  <div className="flex items-center gap-2">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <span className="text-xs text-slate-500">{isActive ? 'Đang bật' : 'Đã tắt'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400">Lợi ích chính (Benefits) <span className="text-red-400">*</span></Label>
                  <Textarea 
                    value={benefits} 
                    onChange={e => setBenefits(e.target.value)} 
                    placeholder="Mô tả công dụng và lợi ích chính..."
                    className="min-h-[80px] bg-slate-900 border-slate-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400">Vấn đề da (Skin Concerns)</Label>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_CONCERNS_TAGS.map(tag => (
                      <Badge 
                        key={tag}
                        variant="outline"
                        className={`cursor-pointer transition-colors ${skinConcerns.includes(tag) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        onClick={() => toggleTag(skinConcerns, setSkinConcerns, tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400">Loại Spa phù hợp (Spa Types)</Label>
                  <div className="flex flex-wrap gap-2">
                    {SPA_TYPES_TAGS.map(tag => (
                      <Badge 
                        key={tag}
                        variant="outline"
                        className={`cursor-pointer transition-colors ${suitableSpaTypes.includes(tag) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        onClick={() => toggleTag(suitableSpaTypes, setSuitableSpaTypes, tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION: HƯỚNG DẪN & SALES PITCH */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-2">Hướng dẫn & Tư vấn</h3>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400">Hướng dẫn sử dụng (Usage Instructions) <span className="text-red-400">*</span></Label>
                  <Textarea 
                    value={usageInstructions} 
                    onChange={e => setUsageInstructions(e.target.value)} 
                    placeholder="Cách dùng, liều lượng..."
                    className="min-h-[80px] bg-slate-900 border-slate-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400">Sales Pitch (Câu chào hàng) <span className="text-red-400">*</span></Label>
                  <Textarea 
                    value={salesPitch} 
                    onChange={e => setSalesPitch(e.target.value)} 
                    placeholder="Câu chốt sale ấn tượng, lý do tại sao khách nên mua..."
                    className="min-h-[80px] bg-slate-900 border-slate-800"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">Chu kỳ mua lại (Ngày)</Label>
                    <Input 
                      type="number" 
                      value={restockCycleDays} 
                      onChange={e => setRestockCycleDays(parseInt(e.target.value) || 0)} 
                      className="bg-slate-900 border-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-400">Cảnh báo (Warnings)</Label>
                    <Input 
                      value={warnings} 
                      onChange={e => setWarnings(e.target.value)} 
                      placeholder="Lưu ý khi dùng..."
                      className="bg-slate-900 border-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400">Sản phẩm bán kèm (Cross-sell)</Label>
                  <div className="h-32 overflow-y-auto bg-slate-900 border border-slate-800 rounded-md p-2">
                    {productsList.map(p => {
                      if (p.id === productId) return null;
                      return (
                        <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer">
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

              {/* SECTION: XỬ LÝ TỪ CHỐI (OBJECTIONS) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest">Xử lý từ chối (Objections)</h3>
                  <Button variant="outline" size="sm" onClick={addObjection} className="h-7 text-xs bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-white">
                    <Plus className="w-3 h-3 mr-1" /> Thêm tình huống
                  </Button>
                </div>
                
                {activeObjections.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Chưa có kịch bản xử lý từ chối nào.</p>
                ) : (
                  <div className="space-y-4">
                    {objections.map((obj, idx) => {
                      if (obj.isDeleted) return null;
                      return (
                        <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3 relative group">
                          <button 
                            onClick={() => removeObjection(idx)}
                            className="absolute top-3 right-3 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          
                          <div className="grid grid-cols-2 gap-3 pr-8">
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Loại từ chối</Label>
                              <Input 
                                value={obj.objection_type} 
                                onChange={e => updateObjection(idx, 'objection_type', e.target.value)}
                                placeholder="VD: Giá cao, Mùi hắc..."
                                className="h-8 text-xs bg-slate-950 border-slate-800"
                              />
                            </div>
                            <div className="space-y-1 flex flex-col justify-center">
                               <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Trạng thái</Label>
                               <div className="flex items-center gap-2">
                                  <Switch 
                                    checked={obj.is_active} 
                                    onCheckedChange={v => updateObjection(idx, 'is_active', v)} 
                                  />
                                  <span className="text-xs text-slate-400">{obj.is_active ? 'Sử dụng' : 'Vô hiệu hoá'}</span>
                               </div>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Khách hàng nói gì?</Label>
                            <Textarea 
                              value={obj.customer_statement} 
                              onChange={e => updateObjection(idx, 'customer_statement', e.target.value)}
                              placeholder="Câu phản ứng của khách..."
                              className="min-h-[60px] text-xs bg-slate-950 border-slate-800"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Gợi ý trả lời</Label>
                            <Textarea 
                              value={obj.suggested_response} 
                              onChange={e => updateObjection(idx, 'suggested_response', e.target.value)}
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
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="text-slate-400 hover:text-white">
            Đóng
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
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
