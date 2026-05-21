import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, Activity, BugPlay, DatabaseZap, CheckCircle2, AlertTriangle, XCircle, Code } from 'lucide-react';

export const Route = createFileRoute('/admin/ai-debug')({
  component: AIDebugAdmin
});

function AIDebugAdmin() {
  const { isAdminOrSubAdmin } = useAuth();
  
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [isLoadingSandbox, setIsLoadingSandbox] = useState(false);
  
  const [healthMetrics, setHealthMetrics] = useState<any>({
    total_chunks: 0,
    avg_chunk_size: 0,
    missing_embeddings: 0,
    duplicate_chunks: 0
  });

  useEffect(() => {
    fetchHealthMetrics();
  }, []);

  const fetchHealthMetrics = async () => {
    try {
      const { data, error } = await supabase.rpc('get_embedding_health_metrics');
      if (error) throw error;
      if (data && data.length > 0) {
        setHealthMetrics(data[0]);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Lỗi khi tải Health Metrics');
    }
  };

  const runSandbox = async () => {
    if (!sandboxQuery.trim()) return;
    setIsLoadingSandbox(true);
    setSandboxResult(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sales-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: 'debug_rag',
          debugQuery: sandboxQuery
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Lỗi gọi Sandbox');
      
      setSandboxResult(result);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoadingSandbox(false);
    }
  };

  if (!isAdminOrSubAdmin) {
    return <div className="p-8 text-center text-rose-500 font-bold">Bạn không có quyền truy cập trang này.</div>;
  }

  // Health Status Logic
  const duplicateRate = healthMetrics.total_chunks > 0 
    ? (healthMetrics.duplicate_chunks / healthMetrics.total_chunks) * 100 
    : 0;
  
  const isHealthy = healthMetrics.missing_embeddings === 0 && duplicateRate < 5;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
          <BugPlay className="w-6 h-6 text-indigo-500" />
          AI & RAG Debug Center
        </h1>
        <p className="text-sm text-slate-500 mt-1">Kiểm soát chất lượng trích xuất (RAG Quality) và Sức khoẻ dữ liệu Vector (Phase 7).</p>
      </div>

      <Tabs defaultValue="sandbox" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="sandbox" className="flex items-center gap-2"><Search className="w-4 h-4"/> RAG Sandbox (Test Retrieval)</TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Activity className="w-4 h-4"/> 
            Embedding Health Check
            {!isHealthy && <span className="w-2 h-2 rounded-full bg-rose-500 ml-1"></span>}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SANDBOX */}
        <TabsContent value="sandbox" className="space-y-6">
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-indigo-50/50 pb-4 border-b border-indigo-100">
              <CardTitle className="text-lg text-indigo-900">Mô phỏng Truy vấn (Sandbox)</CardTitle>
              <CardDescription>Nhập câu hỏi của Sale hoặc tóm tắt nhu cầu khách hàng để kiểm tra xem AI bốc (retrieve) đúng thông tin sản phẩm không.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-4">
                <Input 
                  placeholder='VD: "Khách da dầu bị mụn viêm cần tìm sữa rửa mặt"' 
                  className="flex-1"
                  value={sandboxQuery}
                  onChange={(e) => setSandboxQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSandbox()}
                />
                <Button onClick={runSandbox} disabled={isLoadingSandbox} className="bg-indigo-600 hover:bg-indigo-700">
                  {isLoadingSandbox ? 'Đang băm vector...' : 'Test Retrieval'}
                </Button>
              </div>

              {sandboxResult && (
                <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Retrieved Chunks */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <DatabaseZap className="w-5 h-5 text-emerald-500" />
                      Retrieved Chunks ({sandboxResult.retrieved_chunks?.length || 0})
                    </h3>
                    <div className="grid gap-3">
                      {sandboxResult.retrieved_chunks?.map((chunk: any, i: number) => (
                        <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative overflow-hidden">
                          <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-xl ${chunk.score > 0.8 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            Score: {chunk.score?.toFixed(3)}
                          </div>
                          <div className="font-semibold text-indigo-900 text-sm mb-1">Product ID: {chunk.product_id} ({chunk.chunk_type})</div>
                          <p className="text-sm text-slate-600 font-mono mt-2 bg-white p-2 rounded border border-slate-100">{chunk.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Final Prompt Preview */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <Code className="w-5 h-5 text-indigo-500" />
                      Final Prompt Preview
                    </h3>
                    <div className="p-4 bg-slate-900 text-slate-300 font-mono text-xs rounded-xl overflow-x-auto whitespace-pre-wrap">
                      {sandboxResult.final_prompt_preview}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: HEALTH CHECK */}
        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-500">Total Chunks</p>
                <p className="text-3xl font-black text-slate-800 mt-2">{healthMetrics.total_chunks}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-500">Avg Chunk Size</p>
                <p className="text-3xl font-black text-slate-800 mt-2">{healthMetrics.avg_chunk_size} <span className="text-sm font-normal text-slate-400">chars</span></p>
                {(healthMetrics.avg_chunk_size > 800 || (healthMetrics.avg_chunk_size > 0 && healthMetrics.avg_chunk_size < 100)) && (
                  <p className="text-xs text-amber-500 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Kích thước không tối ưu</p>
                )}
              </CardContent>
            </Card>
            <Card className={`shadow-sm ${healthMetrics.missing_embeddings > 0 ? 'border-rose-300 bg-rose-50' : ''}`}>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-500">Missing Embeddings</p>
                <div className="flex items-end gap-2 mt-2">
                  <p className={`text-3xl font-black ${healthMetrics.missing_embeddings > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {healthMetrics.missing_embeddings}
                  </p>
                  {healthMetrics.missing_embeddings === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-500 mb-1" />
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className={`shadow-sm ${duplicateRate >= 5 ? 'border-amber-300 bg-amber-50' : ''}`}>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-500">Duplicate Rate</p>
                <p className={`text-3xl font-black mt-2 ${duplicateRate >= 5 ? 'text-amber-600' : 'text-slate-800'}`}>
                  {duplicateRate.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-2">({healthMetrics.duplicate_chunks} chunks)</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-500"/> Chẩn đoán hệ thống
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                {isHealthy ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
                {isHealthy ? "Hệ thống Vector Database đang hoạt động ổn định." : "Phát hiện có lỗi dữ liệu. Vui lòng kiểm tra lại quá trình Embeddings."}
              </li>
              {healthMetrics.missing_embeddings > 0 && (
                <li className="text-rose-600 ml-6">- Cảnh báo Đỏ: Có {healthMetrics.missing_embeddings} đoạn text chưa được băm thành vector (AI sẽ không thể search thấy các đoạn này).</li>
              )}
              {duplicateRate >= 5 && (
                <li className="text-amber-600 ml-6">- Cảnh báo Vàng: Tỷ lệ trùng lặp dữ liệu khá cao ({duplicateRate.toFixed(1)}%). Sẽ gây nhiễu kết quả RAG.</li>
              )}
            </ul>
            <div className="mt-4">
              <Button onClick={fetchHealthMetrics} variant="outline" size="sm" className="bg-white">Làm mới dữ liệu</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
