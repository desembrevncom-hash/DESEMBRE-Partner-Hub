-- ================================================================
-- Migration: Phase v1.4.1F.4 — RAG RPC Brand Filter & Production Readiness
-- Date: 2026-06-10
-- Purpose:
--   1. Update match_product_chunks RPC to support filtering by 
--      brand_id, catalog_product_id, and category_id.
--   2. Preserve backward compatibility with legacy filter_product_ids.
-- ================================================================

-- Drop the old functions to ensure clean replacement if signature changes
DROP FUNCTION IF EXISTS public.match_product_chunks(vector(1536), double precision, integer, integer[]) CASCADE;
DROP FUNCTION IF EXISTS public.match_product_chunks(vector(1536), double precision, integer, integer[], integer) CASCADE;
-- Also drop the new signature just in case it exists
DROP FUNCTION IF EXISTS public.match_product_chunks(vector(1536), double precision, integer, integer[], integer, uuid[], uuid[], uuid[]) CASCADE;

CREATE OR REPLACE FUNCTION public.match_product_chunks(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_product_ids integer[] DEFAULT NULL,
    required_knowledge_version integer DEFAULT NULL,
    filter_brand_ids uuid[] DEFAULT NULL,
    filter_catalog_product_ids uuid[] DEFAULT NULL,
    filter_category_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    product_id integer,
    chunk_type text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
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
    INNER JOIN public.product_knowledge pk ON pk.product_id = pkc.product_id
    WHERE
        pkc.is_active = true
        AND pk.is_active = true
        AND pk.qa_status = 'approved'
        AND (required_knowledge_version IS NULL OR pkc.knowledge_version = required_knowledge_version)
        AND 1 - (pkc.embedding <=> query_embedding) > match_threshold
        AND (filter_product_ids IS NULL OR pkc.product_id = ANY(filter_product_ids))
        AND (filter_brand_ids IS NULL OR pkc.brand_id = ANY(filter_brand_ids))
        AND (filter_catalog_product_ids IS NULL OR pkc.catalog_product_id = ANY(filter_catalog_product_ids))
        AND (filter_category_ids IS NULL OR pkc.category_id = ANY(filter_category_ids))
    ORDER BY pkc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute to authenticated users (RLS controls the underlying tables)
GRANT EXECUTE ON FUNCTION public.match_product_chunks(vector(1536), double precision, integer, integer[], integer, uuid[], uuid[], uuid[]) TO authenticated;
