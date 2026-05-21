-- Migration: RAG Quality Control & Embedding Health Check (Phase 7)

-- 1. Add retrieved_chunks to ai_assistant_logs
ALTER TABLE public.ai_assistant_logs
ADD COLUMN IF NOT EXISTS retrieved_chunks jsonb DEFAULT '[]'::jsonb;

-- 2. Create RPC for Embedding Health Check
-- It calculates total chunks, avg size, missing embeddings, and duplicates
CREATE OR REPLACE FUNCTION public.get_embedding_health_metrics()
RETURNS TABLE (
    total_chunks bigint,
    avg_chunk_size numeric,
    missing_embeddings bigint,
    duplicate_chunks bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH metrics AS (
        SELECT 
            COUNT(*) as total,
            COALESCE(AVG(LENGTH(content)), 0) as avg_size,
            SUM(CASE WHEN embedding IS NULL THEN 1 ELSE 0 END) as missing,
            -- Calculate duplicates by grouping content
            (
                SELECT COUNT(*) FROM (
                    SELECT content FROM public.product_knowledge_chunks 
                    GROUP BY content HAVING COUNT(*) > 1
                ) dupes
            ) as duplicate
        FROM public.product_knowledge_chunks
    )
    SELECT 
        metrics.total,
        ROUND(metrics.avg_size, 2),
        metrics.missing,
        metrics.duplicate
    FROM metrics;
END;
$$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
