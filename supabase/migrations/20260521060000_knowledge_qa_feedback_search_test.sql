-- Migration: Phase 8-10 - Product Knowledge QA Status, Feedback Loop, Search QA

-- ===================================================
-- PHẦN 8: PRODUCT KNOWLEDGE QA WORKFLOW
-- ===================================================

-- 1. Add status column to product_knowledge
ALTER TABLE public.product_knowledge
ADD COLUMN IF NOT EXISTS qa_status text NOT NULL DEFAULT 'draft'
    CHECK (qa_status IN ('draft', 'review', 'approved', 'archived'));

-- 2. Add reviewer tracking
ALTER TABLE public.product_knowledge
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS qa_notes text;

-- 3. Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_product_knowledge_qa_status ON public.product_knowledge (qa_status);

-- 4. Update existing records to 'approved' so existing KB stays active
UPDATE public.product_knowledge SET qa_status = 'approved' WHERE qa_status = 'draft';

-- 5. Update the match_product_chunks RPC to accept a status filter
-- We'll join chunks to product_knowledge and filter by qa_status = 'approved'
-- Re-create the function with the approved filter
DROP FUNCTION IF EXISTS public.match_product_chunks(vector(1536), double precision, integer, integer[]) CASCADE;
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
    knowledge_version integer,
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
        pkc.knowledge_version,
        1 - (pkc.embedding <=> query_embedding) AS similarity
    FROM public.product_knowledge_chunks pkc
    -- PHASE 8: Only retrieve chunks for APPROVED products
    INNER JOIN public.product_knowledge pk ON pkc.product_id = pk.product_id
        AND pk.qa_status = 'approved'
    WHERE 
        1 - (pkc.embedding <=> query_embedding) > match_threshold
        AND (filter_product_ids IS NULL OR pkc.product_id = ANY(filter_product_ids))
    ORDER BY pkc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ===================================================
-- PHẦN 9: AI FEEDBACK LOOP — ai_feedback table
-- ===================================================

CREATE TABLE IF NOT EXISTS public.ai_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,

    feedback_type text NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'report')),
    feedback_note text,

    -- Context of what was shown
    mode text,              -- summary | rewrite | suggestion
    content_shown text,     -- What AI actually generated (for audit)

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_conversation_id ON public.ai_feedback (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_id ON public.ai_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON public.ai_feedback (feedback_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON public.ai_feedback (created_at DESC);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.ai_feedback;
CREATE POLICY "Users can insert own feedback"
ON public.ai_feedback FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can see their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.ai_feedback;
CREATE POLICY "Users can view own feedback"
ON public.ai_feedback FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin_or_sub_admin(auth.uid()));

-- Summary view for admin
CREATE OR REPLACE VIEW public.ai_feedback_summary AS
SELECT
    mode,
    feedback_type,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7_days
FROM public.ai_feedback
GROUP BY mode, feedback_type
ORDER BY mode, feedback_type;

-- ===================================================
-- PHẦN 10: SEARCH QUALITY TEST — predefined test cases
-- ===================================================

CREATE TABLE IF NOT EXISTS public.ai_search_qa_tests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    query text NOT NULL,
    expected_field text NOT NULL,    -- which field to check in KB (skin_type, contraindications, etc.)
    expected_keyword text NOT NULL,  -- keyword that must appear in retrieved chunks
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_search_qa_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage search QA tests" ON public.ai_search_qa_tests;
CREATE POLICY "Admin can manage search QA tests"
ON public.ai_search_qa_tests FOR ALL TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Seed default test cases
INSERT INTO public.ai_search_qa_tests (query, expected_field, expected_keyword, description)
VALUES
  ('bà bầu mang thai an toàn', 'content', 'bầu', 'Tìm sản phẩm an toàn cho bà bầu'),
  ('đang treatment laser không dùng được gì', 'content', 'treatment', 'Tìm chống chỉ định sau treatment'),
  ('da mụn viêm cần gì', 'content', 'mụn', 'Tìm sản phẩm cho da mụn'),
  ('da dầu bóng nhờn', 'content', 'dầu', 'Tìm sản phẩm cho da dầu'),
  ('retinol không dùng chung với gì', 'content', 'retinol', 'Kiểm tra contraindications retinol'),
  ('sữa rửa mặt không bọt', 'content', 'sữa rửa mặt', 'Tìm sản phẩm làm sạch'),
  ('da nhạy cảm sau laser', 'content', 'nhạy cảm', 'Tìm sản phẩm cho da nhạy cảm')
ON CONFLICT DO NOTHING;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
