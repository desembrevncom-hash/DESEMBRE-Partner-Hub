-- Migration: Update match_product_chunks RPC to enforce active products, approved QA status, and knowledge_version filter

CREATE OR REPLACE FUNCTION match_product_chunks(
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
) LANGUAGE plpgsql AS $$
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
    JOIN public.product_knowledge pk ON pk.id = pkc.product_id
    WHERE
        pkc.is_active = true
        AND pk.is_active = true
        AND pk.qa_status = 'approved'
        AND (required_knowledge_version IS NULL OR pk.knowledge_version = required_knowledge_version)
        AND 1 - (pkc.embedding <=> query_embedding) > match_threshold
        AND (filter_product_ids IS NULL OR pkc.product_id = ANY(filter_product_ids))
    ORDER BY pkc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
