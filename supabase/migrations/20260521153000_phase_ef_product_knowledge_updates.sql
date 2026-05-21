-- Migration: Phase E & F - Product Knowledge Updates
-- 1. Add missing fields to product_knowledge
ALTER TABLE public.product_knowledge
  ADD COLUMN IF NOT EXISTS ingredient_highlights text[],
  ADD COLUMN IF NOT EXISTS skin_types text[],
  ADD COLUMN IF NOT EXISTS pregnancy_safe boolean,
  ADD COLUMN IF NOT EXISTS routine_position text;

-- 2. Update match_product_chunks RPC to fix join condition and add strict filters
CREATE OR REPLACE FUNCTION public.match_product_chunks(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_product_ids integer[] DEFAULT NULL,
    required_knowledge_version integer DEFAULT NULL
) RETURNS TABLE (
    id uuid,
    product_id integer,
    chunk_type text,
    content text,
    metadata jsonb,
    similarity float
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        pkc.id,
        pkc.product_id,
        pkc.chunk_type,
        pkc.content,
        pkc.metadata,
        1 - (pkc.embedding <=> query_embedding) AS similarity
    FROM public.product_knowledge_chunks pkc
    -- FIX: Join on pk.product_id instead of pk.id
    JOIN public.product_knowledge pk ON pk.product_id = pkc.product_id
    WHERE
        -- Require active records and approved QA
        pk.is_active = true
        AND pk.qa_status = 'approved'
        AND pkc.is_active = true
        
        -- Version matching (if required_version is provided, use it; otherwise match pk and pkc versions if both exist)
        AND (
            required_knowledge_version IS NULL OR (
                pk.knowledge_version = required_knowledge_version 
                AND pkc.knowledge_version = required_knowledge_version
            )
        )
        AND (
            required_knowledge_version IS NOT NULL OR 
            pk.knowledge_version IS NULL OR 
            pkc.knowledge_version IS NULL OR 
            pk.knowledge_version = pkc.knowledge_version
        )
        
        -- Similarity threshold
        AND 1 - (pkc.embedding <=> query_embedding) > match_threshold
        
        -- Optional product filter
        AND (filter_product_ids IS NULL OR pkc.product_id = ANY(filter_product_ids))
    ORDER BY pkc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
