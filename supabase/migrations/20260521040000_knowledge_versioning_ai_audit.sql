-- Migration: Phase 7.2 - Knowledge Versioning + AI Conversations Audit Table

-- ===================================================
-- PHẦN 3: KNOWLEDGE VERSIONING
-- ===================================================

-- 1. Add knowledge_version to product_knowledge
ALTER TABLE public.product_knowledge
ADD COLUMN IF NOT EXISTS knowledge_version integer NOT NULL DEFAULT 1;

-- 2. Create a trigger function to auto-increment version on update
CREATE OR REPLACE FUNCTION public.increment_knowledge_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only bump version if any "knowledge" field changes, not just metadata
    IF (
        OLD.benefits IS DISTINCT FROM NEW.benefits OR
        OLD.skin_concerns IS DISTINCT FROM NEW.skin_concerns OR
        OLD.skin_type IS DISTINCT FROM NEW.skin_type OR
        OLD.contraindications IS DISTINCT FROM NEW.contraindications OR
        OLD.ingredient_highlights IS DISTINCT FROM NEW.ingredient_highlights OR
        OLD.routine_position IS DISTINCT FROM NEW.routine_position OR
        OLD.seasonal_usage IS DISTINCT FROM NEW.seasonal_usage OR
        OLD.pregnancy_safe IS DISTINCT FROM NEW.pregnancy_safe OR
        OLD.usage_instructions IS DISTINCT FROM NEW.usage_instructions OR
        OLD.sales_pitch IS DISTINCT FROM NEW.sales_pitch OR
        OLD.warnings IS DISTINCT FROM NEW.warnings
    ) THEN
        NEW.knowledge_version = OLD.knowledge_version + 1;
        NEW.updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to product_knowledge
DROP TRIGGER IF EXISTS trg_increment_knowledge_version ON public.product_knowledge;
CREATE TRIGGER trg_increment_knowledge_version
BEFORE UPDATE ON public.product_knowledge
FOR EACH ROW
EXECUTE FUNCTION public.increment_knowledge_version();

-- 4. Track which chunks were generated from which version
ALTER TABLE public.product_knowledge_chunks
ADD COLUMN IF NOT EXISTS knowledge_version integer NOT NULL DEFAULT 1;

-- 5. Convenience function: get stale chunks (chunk version != current product version)
-- Admin can call this to know which products need re-embedding
CREATE OR REPLACE FUNCTION public.get_stale_chunks()
RETURNS TABLE (
    product_id integer,
    current_knowledge_version integer,
    chunk_version integer,
    stale_chunk_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.product_id,
        pk.knowledge_version AS current_knowledge_version,
        c.knowledge_version AS chunk_version,
        COUNT(*) AS stale_chunk_count
    FROM public.product_knowledge_chunks c
    JOIN public.product_knowledge pk ON c.product_id = pk.product_id
    WHERE c.knowledge_version < pk.knowledge_version
    GROUP BY c.product_id, pk.knowledge_version, c.knowledge_version
    ORDER BY stale_chunk_count DESC;
END;
$$;

-- ===================================================
-- PHẦN 4: AI CONVERSATIONS AUDIT
-- ===================================================

-- 6. Create ai_conversations table for full audit trail
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,

    -- Tracing
    mode text NOT NULL,                          -- summary | rewrite_suggestions | debug_rag
    prompt text,                                 -- Full prompt sent to AI
    retrieved_chunks jsonb DEFAULT '[]'::jsonb,  -- Chunks used by RAG
    response text,                               -- Full AI response

    -- Context
    knowledge_version integer,                   -- Which PK version was active

    -- Audit
    hallucination_flag boolean DEFAULT false,    -- Flagged by Admin/Sale
    hallucination_note text,                     -- Why it was flagged

    -- Sale Feedback
    feedback_score integer CHECK (feedback_score BETWEEN 1 AND 5),
    feedback_note text,

    -- Token cost
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    status text DEFAULT 'success',
    error_message text,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_customer_id ON public.ai_conversations (customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_mode ON public.ai_conversations (mode);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_hallucination ON public.ai_conversations (hallucination_flag);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON public.ai_conversations (created_at DESC);

-- 8. Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Admin sees all
DROP POLICY IF EXISTS "Admin and Sub Admin can view all conversations" ON public.ai_conversations;
CREATE POLICY "Admin and Sub Admin can view all conversations"
ON public.ai_conversations FOR SELECT TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Sales see their own
DROP POLICY IF EXISTS "Users can view own conversations" ON public.ai_conversations;
CREATE POLICY "Users can view own conversations"
ON public.ai_conversations FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Sales can flag/rate their own records
DROP POLICY IF EXISTS "Users can update own conversation feedback" ON public.ai_conversations;
CREATE POLICY "Users can update own conversation feedback"
ON public.ai_conversations FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin flags hallucination
DROP POLICY IF EXISTS "Admin can update hallucination flag" ON public.ai_conversations;
CREATE POLICY "Admin can update hallucination flag"
ON public.ai_conversations FOR UPDATE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Insert via edge function (service role bypasses RLS)

-- 9. Analytics view: summarize prompt performance
CREATE OR REPLACE VIEW public.ai_conversation_analytics AS
SELECT
    mode,
    COUNT(*) AS total_calls,
    AVG(total_tokens) AS avg_tokens,
    SUM(CASE WHEN hallucination_flag = true THEN 1 ELSE 0 END) AS hallucination_count,
    ROUND(AVG(feedback_score), 2) AS avg_feedback_score,
    ROUND(
        SUM(CASE WHEN hallucination_flag = true THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2
    ) AS hallucination_rate_pct
FROM public.ai_conversations
GROUP BY mode;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
