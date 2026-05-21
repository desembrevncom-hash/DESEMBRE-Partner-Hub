import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, DatabaseZap, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  knowledgeId: string | null;
  productId: number | null;
  qaStatus: string;
  isActive: boolean;
  buildStatus: string;
  knowledgeVersion: number;
  lastEmbeddedAt: string | null;
  embeddingError: string | null;
  onEmbeddingComplete?: () => void;
};

export function EmbeddingBuilder({
  knowledgeId,
  productId,
  qaStatus,
  isActive,
  buildStatus,
  knowledgeVersion,
  lastEmbeddedAt,
  embeddingError,
  onEmbeddingComplete
}: Props) {
  const { user, isAdminOrSubAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);

  // Re-fetch chunk count whenever knowledgeId or buildStatus changes
  useEffect(() => {
    if (productId && buildStatus === 'completed') {
      fetchChunkCount();
    }
  }, [productId, buildStatus]);

  const fetchChunkCount = async () => {
    try {
      const { count, error } = await supabase
        .from('product_knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('is_active', true);
        
      if (!error && count !== null) {
        setChunkCount(count);
      }
    } catch (e) {
      console.error("Failed to fetch chunk count", e);
    }
  };

  const handleBuild = async (rebuild: boolean = false) => {
    if (!knowledgeId) return;
    
    if (qaStatus !== 'approved' || !isActive) {
      toast.error("Chỉ được build khi trạng thái là Đã duyệt và Đang bật!");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('embed-product-knowledge', {
        body: {
          productKnowledgeId: knowledgeId,
          rebuild: rebuild
        }
      });

      if (error) throw new Error(error.message || "Failed to call edge function");
      if (data?.error) throw new Error(data.error);

      toast.success(`Build embedding thành công! Tạo ${data.chunkCount} chunks.`);
      if (onEmbeddingComplete) {
        onEmbeddingComplete();
      }
    } catch (error: any) {
      console.error("Embedding error:", error);
      toast.error("Build embedding thất bại: " + error.message);
      // We'll let the user refresh to see the failed status
      if (onEmbeddingComplete) {
        onEmbeddingComplete();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isAdminOrSubAdmin) return null;
  if (!knowledgeId) return null;

  const isProcessing = buildStatus === 'processing' || loading;
  const isApprovedAndActive = qaStatus === 'approved' && isActive;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
          <DatabaseZap className="w-4 h-4" />
          AI RAG Embedding
        </h3>
        
        {buildStatus === 'completed' && (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Đã Build (v{knowledgeVersion})
          </Badge>
        )}
        {buildStatus === 'processing' && (
          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Đang Build...
          </Badge>
        )}
        {buildStatus === 'failed' && (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
            <AlertCircle className="w-3 h-3 mr-1" /> Lỗi Build
          </Badge>
        )}
        {buildStatus === 'pending' && (
          <Badge className="bg-slate-800 text-slate-400 border-slate-700">
            <Clock className="w-3 h-3 mr-1" /> Chưa Build
          </Badge>
        )}
      </div>

      <div className="text-xs text-slate-400 space-y-2">
        <div className="flex justify-between">
          <span>Phiên bản tri thức:</span>
          <span className="font-mono text-slate-200">v{knowledgeVersion}</span>
        </div>
        <div className="flex justify-between">
          <span>Số lượng Chunks (active):</span>
          <span className="font-mono text-slate-200">{chunkCount > 0 ? chunkCount : '--'}</span>
        </div>
        <div className="flex justify-between">
          <span>Lần build cuối:</span>
          <span className="font-mono text-slate-200">
            {lastEmbeddedAt ? new Date(lastEmbeddedAt).toLocaleString('vi-VN') : 'Chưa từng build'}
          </span>
        </div>
        
        {buildStatus === 'failed' && embeddingError && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400">
            {embeddingError}
          </div>
        )}
        
        {!isApprovedAndActive && (
          <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Chỉ có thể Build Embedding khi trạng thái QA là "Đã duyệt" và Sản phẩm đang bật (Active).</span>
          </div>
        )}
      </div>

      <div className="pt-2">
        {buildStatus === 'pending' || buildStatus === 'failed' ? (
          <Button 
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9 text-xs"
            onClick={() => handleBuild(false)}
            disabled={isProcessing || !isApprovedAndActive}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DatabaseZap className="w-4 h-4 mr-2" />}
            Build Embedding
          </Button>
        ) : (
          <Button 
            variant="outline"
            className="w-full bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 h-9 text-xs"
            onClick={() => handleBuild(true)}
            disabled={isProcessing || !isApprovedAndActive}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DatabaseZap className="w-4 h-4 mr-2" />}
            Rebuild Embedding (v{knowledgeVersion + 1})
          </Button>
        )}
      </div>
    </div>
  );
}
