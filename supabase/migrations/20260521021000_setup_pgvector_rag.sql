-- Migration: Setup pgvector and RAG tables for Product Knowledge (Phase 6.6 Step 2)

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create chunks table to store embeddings
CREATE TABLE IF NOT EXISTS public.product_knowledge_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id integer NOT NULL,
    chunk_type text NOT NULL, -- 'benefit', 'instruction', 'objection', 'faq', 'document'
    content text NOT NULL,    -- The raw text chunk
    embedding vector(1536),   -- OpenAI text-embedding-3-small or ada-002 dimension
    metadata jsonb DEFAULT '{}'::jsonb, -- Store extra info like document name, page number, etc.
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add index on product_id for fast filtering
CREATE INDEX IF NOT EXISTS idx_product_knowledge_chunks_product_id ON public.product_knowledge_chunks (product_id);

-- Enable RLS
ALTER TABLE public.product_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Only edge functions / service role need to read/write embeddings, 
-- but let's allow admins full access and sales to read if necessary.
DROP POLICY IF EXISTS "Admin and Sub Admin can manage chunks" ON public.product_knowledge_chunks;
CREATE POLICY "Admin and Sub Admin can manage chunks"
ON public.product_knowledge_chunks
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Sales staff can view chunks" ON public.product_knowledge_chunks;
CREATE POLICY "Sales staff can view chunks"
ON public.product_knowledge_chunks
FOR SELECT
TO authenticated
USING (public.is_sales_member(auth.uid()) OR public.is_admin_or_sub_admin(auth.uid()));

-- 3. Create Semantic Search function (match_product_chunks)
-- Uses cosine distance (<=>) for text-embedding models
CREATE OR REPLACE FUNCTION match_product_chunks(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_product_ids integer[] DEFAULT NULL
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
    WHERE 
        1 - (pkc.embedding <=> query_embedding) > match_threshold
        AND (filter_product_ids IS NULL OR pkc.product_id = ANY(filter_product_ids))
    ORDER BY pkc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
