import React, { useState, useEffect, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Copy, Check, Info, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/products/knowledge')({
  component: ProductKnowledgeViewer
});

function ProductKnowledgeViewer() {
  const { user } = useAuth();
  const [knowledgeList, setKnowledgeList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    const { data, error } = await supabase
      .from('product_knowledge')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      toast.error('Lỗi khi tải Cẩm nang sản phẩm');
      return;
    }
    setKnowledgeList(data || []);
  };

  const filteredKnowledge = useMemo(() => {
    if (!searchQuery) return knowledgeList;
    const query = searchQuery.toLowerCase();
    
    return knowledgeList.filter(k => {
      const matchID = k.product_id?.toString().includes(query);
      const matchBenefits = k.benefits?.toLowerCase().includes(query);
      const matchConcerns = k.skin_concerns?.some((c: string) => c.toLowerCase().includes(query));
      const matchTypes = k.skin_type?.some((t: string) => t.toLowerCase().includes(query));
      const matchIngredients = k.ingredient_highlights?.some((i: string) => i.toLowerCase().includes(query));
      const matchContra = k.contraindications?.some((c: string) => c.toLowerCase().includes(query));
      
      // Pregnancy check: if user searches "bầu"
      const matchPregnancy = (query.includes('bầu') || query.includes('pregnant')) && k.pregnancy_safe;

      return matchID || matchBenefits || matchConcerns || matchTypes || matchIngredients || matchContra || matchPregnancy;
    });
  }, [knowledgeList, searchQuery]);

  const handleCopy = async (text: string, fieldId: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      toast.success('Đã copy nội dung');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast.error('Lỗi khi copy');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-500" />
            Cẩm Nang Tư Vấn Sản Phẩm
          </h1>
          <p className="text-sm text-slate-500 mt-1">Tìm kiếm siêu tốc thông tin, thành phần, kịch bản chốt sale (Phase 6.6 Viewer)</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-indigo-400" />
        </div>
        <Input 
          className="pl-12 h-14 rounded-2xl border-2 border-indigo-100 bg-white text-lg shadow-sm focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
          placeholder="Tìm theo tình trạng da (mụn, nám), thành phần (BHA), mẹ bầu..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Results */}
      <div className="space-y-6">
        {filteredKnowledge.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-2xl border border-slate-100">
            <p className="text-slate-500">Không tìm thấy thông tin phù hợp.</p>
          </div>
        ) : (
          filteredKnowledge.map(k => (
            <Card key={k.id} className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-100">
              <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Sản phẩm #{k.product_id}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {k.pregnancy_safe && (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md flex items-center gap-1">
                        <Check className="w-3 h-3" /> An toàn Mẹ bầu
                      </span>
                    )}
                    {k.skin_type?.map((t: string) => (
                      <span key={t} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-md">{t}</span>
                    ))}
                    {k.skin_concerns?.map((c: string) => (
                      <span key={c} className="px-2 py-1 bg-rose-50 text-rose-600 text-xs font-medium rounded-md border border-rose-100">{c}</span>
                    ))}
                  </div>
                </div>
                {k.routine_position && (
                  <div className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-100">
                    {k.routine_position}
                  </div>
                )}
              </div>
              
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  
                  {/* Left Col: Info */}
                  <div className="p-5 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" /> Công dụng chính
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{k.benefits}</p>
                    </div>

                    {k.ingredient_highlights && k.ingredient_highlights.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Thành phần nổi bật</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {k.ingredient_highlights.map((i: string) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded">{i}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {k.contraindications && k.contraindications.length > 0 && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> Chống chỉ định
                        </h4>
                        <ul className="list-disc list-inside text-xs text-amber-800 space-y-1">
                          {k.contraindications.map((c: string, idx: number) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Right Col: Sales tools */}
                  <div className="p-5 space-y-4 bg-slate-50/30">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> Sales Pitch (Gửi khách)
                        </h4>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                          onClick={() => handleCopy(k.sales_pitch, `pitch-${k.id}`)}
                        >
                          {copiedField === `pitch-${k.id}` ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          Copy
                        </Button>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-sm text-slate-700 italic relative">
                        "{k.sales_pitch}"
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cách dùng</h4>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs text-slate-500 hover:bg-slate-100"
                          onClick={() => handleCopy(k.usage_instructions, `usage-${k.id}`)}
                        >
                          {copiedField === `usage-${k.id}` ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          Copy
                        </Button>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                        {k.usage_instructions}
                      </p>
                    </div>

                    {k.warnings && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lưu ý khi bán</h4>
                        <p className="text-xs text-slate-500">{k.warnings}</p>
                      </div>
                    )}
                  </div>

                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
