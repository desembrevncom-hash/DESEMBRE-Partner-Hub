import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS } from "@/data/products";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Copy, Box, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type ProductKnowledge = {
  id: string;
  product_id: number;
  benefits: string;
  skin_concerns: string[];
  suitable_spa_types: string[];
  usage_instructions: string;
  sales_pitch: string;
  cross_sell_products: number[];
  restock_cycle_days: number;
  warnings: string;
};

const SKIN_CONCERNS_TAGS = [
  "Da mụn", "Thâm nám", "Lão hóa", "Nhạy cảm", "Phục hồi", 
  "Da dầu", "Da khô", "Lỗ chân lông to", "Da xỉn màu"
];

export function ProductKnowledgeBook() {
  const [knowledgeList, setKnowledgeList] = useState<ProductKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    try {
      const { data, error } = await supabase
        .from('product_knowledge')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      setKnowledgeList(data || []);
    } catch (err: any) {
      console.error("Error fetching product knowledge:", err);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (id: number) => {
    const product = PRODUCTS.find(p => p.id === id);
    return product ? product.name : `Sản phẩm #${id}`;
  };

  const toggleConcern = (tag: string) => {
    if (selectedConcerns.includes(tag)) {
      setSelectedConcerns(selectedConcerns.filter(t => t !== tag));
    } else {
      setSelectedConcerns([...selectedConcerns, tag]);
    }
  };

  const filteredList = useMemo(() => {
    return knowledgeList.filter(k => {
      // Search filter
      const pName = getProductName(k.product_id).toLowerCase();
      const sQuery = searchQuery.toLowerCase();
      const matchesSearch = pName.includes(sQuery) || (k.benefits || "").toLowerCase().includes(sQuery);
      
      // Concerns filter
      let matchesConcerns = true;
      if (selectedConcerns.length > 0) {
        const kConcerns = k.skin_concerns || [];
        matchesConcerns = selectedConcerns.some(c => kConcerns.includes(c));
      }

      return matchesSearch && matchesConcerns;
    });
  }, [knowledgeList, searchQuery, selectedConcerns]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã copy ${type}!`);
  };

  if (loading) {
    return <div className="text-[11px] text-slate-500 animate-pulse">Đang tải cẩm nang...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Tìm tên sản phẩm, công dụng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SKIN_CONCERNS_TAGS.map(tag => (
            <Badge
              key={tag}
              variant={selectedConcerns.includes(tag) ? "default" : "outline"}
              className={`text-[10px] cursor-pointer transition-colors ${selectedConcerns.includes(tag) ? "bg-indigo-500 hover:bg-indigo-600 border-transparent" : "text-slate-500 hover:border-slate-400"}`}
              onClick={() => toggleConcern(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Box className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Chưa có cẩm nang sản phẩm phù hợp</p>
          </div>
        ) : (
          filteredList.map(k => {
            const isExpanded = expandedId === k.id;
            return (
              <div key={k.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                {/* Header / Summary */}
                <div 
                  className="p-3 cursor-pointer select-none flex items-start gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : k.id)}
                >
                  <div className="flex-1 space-y-1">
                    <h4 className="text-xs font-black text-slate-800 leading-tight">
                      {getProductName(k.product_id)}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {k.benefits}
                    </p>
                  </div>
                  <div className="shrink-0 text-slate-400 mt-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-3 pt-0 space-y-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="pt-3 space-y-3">
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" /> Sales Pitch
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(k.sales_pitch, "Sales Pitch"); }}
                            className="h-6 px-2 text-[9px] text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                        </div>
                        <p className="text-[11px] text-slate-700 bg-amber-50/50 p-2 rounded-lg border border-amber-100 italic">
                          "{k.sales_pitch}"
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Cách dùng
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(k.usage_instructions, "Hướng dẫn"); }}
                            className="h-6 px-2 text-[9px] text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          {k.usage_instructions}
                        </p>
                      </div>

                      {k.warnings && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase text-red-400 tracking-wider">Lưu ý / Cảnh báo</span>
                          <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                            {k.warnings}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="text-[10px] text-slate-500 font-medium">Chu kỳ mua lại: <strong className="text-slate-700">{k.restock_cycle_days} ngày</strong></span>
                        {k.cross_sell_products && k.cross_sell_products.length > 0 && (
                          <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-1 rounded-md">
                            +{k.cross_sell_products.length} SP liên quan
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
