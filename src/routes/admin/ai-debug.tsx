import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Search, Activity, BugPlay, DatabaseZap, CheckCircle2, AlertTriangle, 
  XCircle, Code, RefreshCw, AlertOctagon, ShieldX, Star, Clock, GitFork
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/admin/ai-debug')({
  component: AIDebugAdmin
});

function AIDebugAdmin() {
  const { isAdminOrSubAdmin } = useAuth();
  
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [isLoadingSandbox, setIsLoadingSandbox] = useState(false);
  
  const [healthMetrics, setHealthMetrics] = useState<any>({
    total_chunks: 0, avg_chunk_size: 0, missing_embeddings: 0, duplicate_chunks: 0
  });
  const [staleChunks, setStaleChunks] = useState<any[]>([]);

  const [conversations, setConversations] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any[]>([]);

  useEffect(() => {
    fetchHealthMetrics();
    fetchStaleChunks();
    fetchConversations();
    fetchAuditStats();
  }, []);

  const fetchHealthMetrics = async () => {
    try {
      const { data, error } = await supabase.rpc('get_embedding_health_metrics');
      if (error) throw error;
      if (data && data.length > 0) setHealthMetrics(data[0]);
    } catch (e: any) { console.error(e); }
  };

  const fetchStaleChunks = async () => {
    try {
      const { data, error } = await supabase.rpc('get_stale_chunks');
      if (error) throw error;
      setStaleChunks(data || []);
    } catch (e: any) { console.error(e); }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, mode, status, hallucination_flag, feedback_score, total_tokens, created_at, customers(name)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setConversations(data || []);
    } catch (e: any) { console.error(e); }
  };

  const fetchAuditStats = async () => {
    try {
      const { data, error } = await supabase.from('ai_conversation_analytics').select('*');
      if (error) throw error;
      setAuditStats(data || []);
    } catch (e: any) { console.error(e); }
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mode: 'debug_rag', debugQuery: sandboxQuery })
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

  const handleFlagHallucination = async (conversationId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-conversation-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'flag_hallucination', conversation_id: conversationId, hallucination_note: 'Flagged by Admin' })
      });
      if (res.ok) {
        toast.success('Đã gắn cờ ảo giác');
        fetchConversations();
      }
    } catch (e: any) { toast.error(e.message); }
  };

  if (!isAdminOrSubAdmin) {
    return <div className="p-8 text-center text-rose-500 font-bold">Bạn không có quyền truy cập trang này.</div>;
  }

  const duplicateRate = healthMetrics.total_chunks > 0 
    ? (healthMetrics.duplicate_chunks / healthMetrics.total_chunks) * 100 : 0;
  const isHealthy = healthMetrics.missing_embeddings === 0 && duplicateRate < 5 && staleChunks.length === 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
          <BugPlay className="w-6 h-6 text-indigo-500" />
          AI & RAG Debug Center
        </h1>
        <p className="text-sm text-slate-500 mt-1">RAG Quality Control · Embedding Health · Knowledge Versioning · Conversation Audit</p>
      </div>

      <Tabs defaultValue="sandbox" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="sandbox" className="flex items-center gap-2"><Search className="w-4 h-4"/> RAG Sandbox</TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Activity className="w-4 h-4"/> Health Check
            {!isHealthy && <span className="w-2 h-2 rounded-full bg-rose-500 ml-1"></span>}
          </TabsTrigger>
          <TabsTrigger value="versioning" className="flex items-center gap-2">
            <GitFork className="w-4 h-4"/> Versioning
            {staleChunks.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 ml-1"></span>}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2"><AlertOctagon className="w-4 h-4"/> Conversation Audit</TabsTrigger>
        </TabsList>

        {/* TAB 1: SANDBOX */}
        <TabsContent value="sandbox" className="space-y-6">
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-indigo-50/50 pb-4 border-b border-indigo-100">
              <CardTitle className="text-lg text-indigo-900">Mô phỏng RAG Retrieval (Sandbox)</CardTitle>
              <CardDescription>Nhập truy vấn để kiểm tra AI bốc đúng Knowledge Chunks không. <strong>Không tốn token AI Chat.</strong></CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-4">
                <Input 
                  placeholder='VD: "Khách da dầu bị mụn viêm, đang treatment laser"' 
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
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <DatabaseZap className="w-5 h-5 text-emerald-500" />
                      Retrieved Chunks ({sandboxResult.retrieved_chunks?.length || 0})
                    </h3>
                    <div className="grid gap-3">
                      {sandboxResult.retrieved_chunks?.map((chunk: any, i: number) => (
                        <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative overflow-hidden">
                          <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-xl ${chunk.score > 0.8 ? 'bg-emerald-100 text-emerald-700' : chunk.score > 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                            {chunk.score?.toFixed(3)}
                          </div>
                          <div className="font-semibold text-indigo-900 text-sm mb-1">Product #{chunk.product_id} · {chunk.chunk_type}</div>
                          <p className="text-sm text-slate-600 font-mono mt-2 bg-white p-2 rounded border border-slate-100">{chunk.content}</p>
                        </div>
                      ))}
                      {(!sandboxResult.retrieved_chunks || sandboxResult.retrieved_chunks.length === 0) && (
                        <div className="p-6 text-center bg-rose-50 border border-rose-200 rounded-xl">
                          <XCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                          <p className="font-bold text-rose-700">Không tìm thấy Chunk nào!</p>
                          <p className="text-sm text-rose-600 mt-1">Cần nhập thêm dữ liệu vào Product Knowledge và chạy lại Embedding.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><Code className="w-5 h-5 text-indigo-500" /> Final Prompt Preview</h3>
                    <div className="p-4 bg-slate-900 text-slate-300 font-mono text-xs rounded-xl overflow-x-auto whitespace-pre-wrap max-h-64">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Chunks', value: healthMetrics.total_chunks, unit: '', alert: null },
              { label: 'Avg Chunk Size', value: healthMetrics.avg_chunk_size, unit: ' chars', alert: (healthMetrics.avg_chunk_size > 800 || (healthMetrics.avg_chunk_size > 0 && healthMetrics.avg_chunk_size < 100)) ? 'amber' : null },
              { label: 'Missing Embeddings', value: healthMetrics.missing_embeddings, unit: '', alert: healthMetrics.missing_embeddings > 0 ? 'red' : null },
              { label: 'Duplicate Rate', value: `${duplicateRate.toFixed(1)}%`, unit: ` (${healthMetrics.duplicate_chunks})`, alert: duplicateRate >= 5 ? 'amber' : null },
            ].map((m, i) => (
              <Card key={i} className={`shadow-sm ${m.alert === 'red' ? 'border-rose-300 bg-rose-50' : m.alert === 'amber' ? 'border-amber-300 bg-amber-50' : ''}`}>
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-slate-500">{m.label}</p>
                  <p className={`text-3xl font-black mt-2 ${m.alert === 'red' ? 'text-rose-600' : m.alert === 'amber' ? 'text-amber-600' : 'text-slate-800'}`}>{m.value}<span className="text-sm font-normal text-slate-400">{m.unit}</span></p>
                  {m.alert === 'red' && <p className="text-xs text-rose-500 mt-2 flex items-center gap-1"><XCircle className="w-3 h-3"/> Nghiêm trọng</p>}
                  {m.alert === 'amber' && <p className="text-xs text-amber-500 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Cần chú ý</p>}
                  {!m.alert && <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Bình thường</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Activity className="w-5 h-5"/> Chẩn đoán tổng thể</h3>
            <div className={`flex items-center gap-3 p-4 rounded-xl ${isHealthy ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
              {isHealthy ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0"/> : <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0"/>}
              <p className="text-sm font-medium">{isHealthy ? 'Hệ thống Vector Database đang hoạt động ổn định.' : 'Phát hiện có vấn đề. Kiểm tra các cảnh báo ở trên và Tab Versioning.'}</p>
            </div>
            <Button onClick={() => { fetchHealthMetrics(); fetchStaleChunks(); }} variant="outline" size="sm" className="bg-white mt-4 gap-2"><RefreshCw className="w-3 h-3"/> Làm mới</Button>
          </div>
        </TabsContent>

        {/* TAB 3: VERSIONING */}
        <TabsContent value="versioning" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2"><GitFork className="w-5 h-5 text-amber-500"/> Knowledge Versioning & Stale Chunks</CardTitle>
              <CardDescription>Khi Admin sửa sản phẩm, trigger tự động tăng <code>knowledge_version</code>. Các Chunks cũ sẽ hiển thị tại đây và cần Re-embed lại.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {staleChunks.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3"/>
                  <p className="font-bold text-emerald-700">Tất cả Chunks đang đồng bộ với phiên bản mới nhất!</p>
                  <p className="text-sm text-slate-500 mt-1">Không có chunk nào bị lỗi version.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0"/>
                    <p className="text-sm text-amber-700">Tìm thấy <strong>{staleChunks.length}</strong> sản phẩm có chunks lỗi thời. Cần re-embed để AI không đọc kiến thức cũ.</p>
                  </div>
                  {staleChunks.map((row: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                      <div>
                        <p className="font-bold text-slate-800">Sản phẩm #{row.product_id}</p>
                        <p className="text-xs text-slate-500 mt-1">Chunk version: <span className="text-rose-600 font-bold">v{row.chunk_version}</span> → Current: <span className="text-emerald-600 font-bold">v{row.current_knowledge_version}</span></p>
                        <p className="text-xs text-slate-500">{row.stale_chunk_count} chunks lỗi thời</p>
                      </div>
                      <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Cần Re-embed</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: CONVERSATION AUDIT */}
        <TabsContent value="audit" className="space-y-6">
          {/* Analytics Summary */}
          {auditStats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {auditStats.map((stat: any, i: number) => (
                <Card key={i} className="shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{stat.mode}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-slate-500">Total</p><p className="text-xl font-black text-slate-800">{stat.total_calls}</p></div>
                      <div><p className="text-xs text-slate-500">Avg Rating</p><p className={`text-xl font-black ${!stat.avg_feedback_score ? 'text-slate-400' : stat.avg_feedback_score >= 4 ? 'text-emerald-600' : 'text-amber-600'}`}>{stat.avg_feedback_score ? `${stat.avg_feedback_score}★` : '—'}</p></div>
                      <div><p className="text-xs text-slate-500">Hallucinations</p><p className={`text-xl font-black ${stat.hallucination_count > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{stat.hallucination_count}</p></div>
                      <div><p className="text-xs text-slate-500">Hallu Rate</p><p className={`text-xl font-black ${stat.hallucination_rate_pct > 5 ? 'text-rose-600' : 'text-emerald-600'}`}>{stat.hallucination_rate_pct || 0}%</p></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Conversation Log Table */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg">Log Conversations Gần Đây</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {conversations.map((conv: any) => (
                  <div key={conv.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${conv.status === 'error' ? 'bg-rose-500' : conv.hallucination_flag ? 'bg-amber-500' : 'bg-emerald-500'}`}/>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{conv.customers?.name || 'Unknown'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">{conv.mode}</span>
                          <span className="text-xs text-slate-300">·</span>
                          <Clock className="w-3 h-3 text-slate-300"/>
                          <span className="text-xs text-slate-400">{new Date(conv.created_at).toLocaleString('vi-VN')}</span>
                          {conv.total_tokens && <span className="text-xs text-slate-400">· {conv.total_tokens} tokens</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {conv.feedback_score && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500"/>
                          <span className="text-xs font-bold text-amber-700">{conv.feedback_score}</span>
                        </div>
                      )}
                      {conv.hallucination_flag ? (
                        <Badge variant="destructive" className="text-xs gap-1"><ShieldX className="w-3 h-3"/> Ảo giác</Badge>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleFlagHallucination(conv.id)} className="h-7 px-2 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50">
                          Flag
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className="py-12 text-center text-slate-400">Chưa có AI conversation nào được ghi nhận.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
