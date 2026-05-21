import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Save, BookOpen, MessageSquare, Upload, Tag } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const Route = createFileRoute('/admin/product-knowledge')({
  component: AdminProductKnowledge
});

function AdminProductKnowledge() {
  const { user, isSalesMember, isAdminOrSubAdmin } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [structuredData, setStructuredData] = useState({
    skin_type: '',
    contraindications: '',
    ingredient_highlights: '',
    routine_position: '',
    seasonal_usage: '',
    pregnancy_safe: true,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    // In a real app, you'd fetch from your products table and join with product_knowledge
    // For now, we mock fetching from product_knowledge and a hypothetical products table.
    // Let's assume we fetch product_knowledge and we'll just display product_id for now.
    const { data, error } = await supabase
      .from('product_knowledge')
      .select('*');
    if (error) {
      toast.error('Lỗi khi tải dữ liệu sản phẩm');
      return;
    }
    setProducts(data || []);
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setStructuredData({
      skin_type: product.skin_type?.join(', ') || '',
      contraindications: product.contraindications?.join(', ') || '',
      ingredient_highlights: product.ingredient_highlights?.join(', ') || '',
      routine_position: product.routine_position || '',
      seasonal_usage: product.seasonal_usage?.join(', ') || '',
      pregnancy_safe: product.pregnancy_safe ?? true,
    });
  };

  const handleSaveStructuredData = async () => {
    if (!selectedProduct) return;
    
    // Convert comma separated strings to arrays
    const toArray = (str: string) => str.split(',').map(s => s.trim()).filter(Boolean);

    const { error } = await supabase
      .from('product_knowledge')
      .update({
        skin_type: toArray(structuredData.skin_type),
        contraindications: toArray(structuredData.contraindications),
        ingredient_highlights: toArray(structuredData.ingredient_highlights),
        routine_position: structuredData.routine_position,
        seasonal_usage: toArray(structuredData.seasonal_usage),
        pregnancy_safe: structuredData.pregnancy_safe,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedProduct.id);

    if (error) {
      toast.error('Lỗi khi lưu dữ liệu');
      console.error(error);
    } else {
      toast.success('Đã lưu Structured Data');
      fetchProducts(); // refresh
    }
  };

  if (!isAdminOrSubAdmin) {
    return <div className="p-8 text-center text-rose-500 font-bold">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex gap-6 h-[calc(100vh-6rem)]">
      {/* Left Sidebar: Product List */}
      <Card className="w-1/3 flex flex-col h-full">
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
          {products.filter(p => p.product_id.toString().includes(searchQuery)).map(p => (
            <div 
              key={p.id}
              onClick={() => handleSelectProduct(p)}
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${selectedProduct?.id === p.id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'}`}
            >
              <div className="font-bold text-slate-800">Sản phẩm ID: {p.product_id}</div>
              <div className="text-xs text-slate-500 truncate mt-1">{p.benefits}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Right Content: CMS Editor */}
      <Card className="w-2/3 flex flex-col h-full overflow-hidden">
        {selectedProduct ? (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">
                Sản phẩm #{selectedProduct.product_id}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <Tabs defaultValue="tags" className="w-full">
                <TabsList className="mb-6">
                  <TabsTrigger value="tags" className="flex items-center gap-2"><Tag className="w-4 h-4"/> Structured Tags</TabsTrigger>
                  <TabsTrigger value="faq" className="flex items-center gap-2"><MessageSquare className="w-4 h-4"/> FAQ & Objections</TabsTrigger>
                  <TabsTrigger value="docs" className="flex items-center gap-2"><Upload className="w-4 h-4"/> Tài liệu</TabsTrigger>
                </TabsList>

                <TabsContent value="tags" className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Loại da phù hợp (cách nhau dấu phẩy)</Label>
                      <Input 
                        value={structuredData.skin_type} 
                        onChange={e => setStructuredData({...structuredData, skin_type: e.target.value})}
                        placeholder="Vd: Da dầu, Da mụn..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Thành phần nổi bật</Label>
                      <Input 
                        value={structuredData.ingredient_highlights} 
                        onChange={e => setStructuredData({...structuredData, ingredient_highlights: e.target.value})}
                        placeholder="Vd: Niacinamide 5%, BHA 2%..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Chống chỉ định</Label>
                      <Input 
                        value={structuredData.contraindications} 
                        onChange={e => setStructuredData({...structuredData, contraindications: e.target.value})}
                        placeholder="Vd: Không dùng chung với Retinol..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mùa khuyên dùng</Label>
                      <Input 
                        value={structuredData.seasonal_usage} 
                        onChange={e => setStructuredData({...structuredData, seasonal_usage: e.target.value})}
                        placeholder="Vd: Mùa hè, Mùa hanh khô..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vị trí chu trình (Routine)</Label>
                      <Input 
                        value={structuredData.routine_position} 
                        onChange={e => setStructuredData({...structuredData, routine_position: e.target.value})}
                        placeholder="Vd: Bước 2 - Sau làm sạch..."
                      />
                    </div>
                    <div className="space-y-2 flex flex-col justify-center">
                      <Label className="mb-2">An toàn cho Mẹ bầu?</Label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={structuredData.pregnancy_safe === true} onChange={() => setStructuredData({...structuredData, pregnancy_safe: true})} />
                          Có
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={structuredData.pregnancy_safe === false} onChange={() => setStructuredData({...structuredData, pregnancy_safe: false})} />
                          Không
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-8">
                    <Button onClick={handleSaveStructuredData} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                      <Save className="w-4 h-4" /> Lưu Structured Data
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="faq" className="space-y-4">
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500">
                    <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p>Giao diện quản lý Câu hỏi thường gặp và Kịch bản xử lý từ chối (Objection Scripts) sẽ được triển khai tại đây.</p>
                  </div>
                </TabsContent>

                <TabsContent value="docs" className="space-y-4">
                  <div className="p-8 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl text-center">
                    <Upload className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
                    <h3 className="font-bold text-indigo-900 mb-1">Upload Tài liệu Sản phẩm</h3>
                    <p className="text-sm text-indigo-600/80 mb-4">Hỗ trợ PDF, DOCX, TXT. Tài liệu sẽ được dùng cho AI Vector RAG ở Phase sau.</p>
                    <Button variant="outline" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">
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
