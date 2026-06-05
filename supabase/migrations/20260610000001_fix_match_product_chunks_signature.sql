-- ================================================================
-- Hotfix Phase v1.4.1F.4.1.2 — Fix match_product_chunks RPC Migration Signature
-- Date: 2026-06-10
-- Purpose:
--   1. Drop ALL existing match_product_chunks signatures to ensure clean slate.
--   2. Recreate match_product_chunks with exact precise types and new filters.
-- ================================================================

-- 1. Drop all possible existing signatures
DROP FUNCTION IF EXISTS public.match_product_chunks(vector, double precision, integer, integer[]) CASCADE;
DROP FUNCTION IF EXISTS public.match_product_chunks(vector, double precision, integer, integer[], integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_product_chunks(vector(1536), double precision, integer, integer[], integer) CASCADE;
DROP FUNCTION IF EXISTS public.match_product_chunks(vector, double precision, integer, integer[], integer, uuid[], uuid[], uuid[]) CASCADE;
DROP FUNCTION IF EXISTS public.match_product_chunks(vector(1536), double precision, integer, integer[], integer, uuid[], uuid[], uuid[]) CASCADE;

-- 2. Create function with exact types
CREATE OR REPLACE FUNCTION public.match_product_chunks(
    query_embedding vector(1536),
    match_threshold double precision,
    match_count integer,
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
    similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 3. Grant execute to authenticated users (RLS controls the underlying tables)
GRANT EXECUTE ON FUNCTION public.match_product_chunks(vector(1536), double precision, integer, integer[], integer, uuid[], uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_product_chunks(vector(1536), double precision, integer, integer[], integer, uuid[], uuid[], uuid[]) TO service_role;
