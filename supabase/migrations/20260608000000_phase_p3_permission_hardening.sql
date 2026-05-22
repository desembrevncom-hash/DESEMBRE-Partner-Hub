-- ================================================================
-- Migration: Phase P3 — Permission Penetration Test & Hardening
-- Date: 2026-06-08
-- Purpose:
--   1. Enable RLS on ai_conversation_logs and ai_safety_events
--   2. Define strict SELECT/INSERT policies on those tables
--   3. Harden product_knowledge SELECT for sales (approved only)
--   4. Harden product_knowledge_chunks SELECT for sales (active only)
--   5. Add internal admin-only checks to administrative RPCs
-- ================================================================

-- ================================================================
-- PART 1: Enable RLS on ai_conversation_logs
-- ================================================================

ALTER TABLE public.ai_conversation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all conversation logs" ON public.ai_conversation_logs;
CREATE POLICY "Admin can view all conversation logs"
ON public.ai_conversation_logs
FOR SELECT
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own conversation logs" ON public.ai_conversation_logs;
CREATE POLICY "Users can view own conversation logs"
ON public.ai_conversation_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Edge functions insert via service role (bypasses RLS), but also allow auth insert
DROP POLICY IF EXISTS "Service role can insert conversation logs" ON public.ai_conversation_logs;
CREATE POLICY "Service role can insert conversation logs"
ON public.ai_conversation_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE for non-admin users on conversation logs
DROP POLICY IF EXISTS "Admin can manage conversation logs" ON public.ai_conversation_logs;
CREATE POLICY "Admin can manage conversation logs"
ON public.ai_conversation_logs
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- ================================================================
-- PART 2: Enable RLS on ai_safety_events
-- ================================================================

ALTER TABLE public.ai_safety_events ENABLE ROW LEVEL SECURITY;

-- Only admin / sub_admin can view safety events (sensitive data)
DROP POLICY IF EXISTS "Admin can view safety events" ON public.ai_safety_events;
CREATE POLICY "Admin can view safety events"
ON public.ai_safety_events
FOR SELECT
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Admin can manage safety events
DROP POLICY IF EXISTS "Admin can manage safety events" ON public.ai_safety_events;
CREATE POLICY "Admin can manage safety events"
ON public.ai_safety_events
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- ================================================================
-- PART 3: Harden product_knowledge SELECT for Sales
--   Sales must only see is_active = true AND qa_status = 'approved'
-- ================================================================

DROP POLICY IF EXISTS "Sales staff can view active product knowledge" ON public.product_knowledge;
CREATE POLICY "Sales staff can view active product knowledge"
ON public.product_knowledge
FOR SELECT
TO authenticated
USING (
    public.is_admin_or_sub_admin(auth.uid())
    OR (
        public.is_sales_member(auth.uid())
        AND is_active = true
        AND qa_status = 'approved'
    )
);

-- ================================================================
-- PART 4: Harden product_knowledge_chunks SELECT for Sales
--   Sales must only see chunks where is_active = true
--   AND the parent product_knowledge is active + approved
-- ================================================================

DROP POLICY IF EXISTS "Sales staff can view chunks" ON public.product_knowledge_chunks;
DROP POLICY IF EXISTS "Sales staff can view active approved chunks" ON public.product_knowledge_chunks;
CREATE POLICY "Sales staff can view active approved chunks"
ON public.product_knowledge_chunks
FOR SELECT
TO authenticated
USING (
    public.is_admin_or_sub_admin(auth.uid())
    OR (
        public.is_sales_member(auth.uid())
        AND is_active = true
        AND EXISTS (
            SELECT 1 FROM public.product_knowledge pk
            WHERE pk.product_id = product_knowledge_chunks.product_id
              AND pk.is_active = true
              AND pk.qa_status = 'approved'
        )
    )
);

-- ================================================================
-- PART 5: Harden admin-only RPCs (SECURITY DEFINER)
--   get_embedding_health_metrics, get_stale_chunks,
--   cleanup_expired_cache, get_cache_stats
-- ================================================================

-- 5a. get_embedding_health_metrics
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
    -- Access control: only admin / sub_admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: only Admin or Sub Admin can call get_embedding_health_metrics';
    END IF;

    RETURN QUERY
    WITH metrics AS (
        SELECT
            COUNT(*) as total,
            COALESCE(AVG(LENGTH(content)), 0) as avg_size,
            SUM(CASE WHEN embedding IS NULL THEN 1 ELSE 0 END) as missing,
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

-- 5b. get_stale_chunks
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
    -- Access control: only admin / sub_admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: only Admin or Sub Admin can call get_stale_chunks';
    END IF;

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

-- 5c. cleanup_expired_cache
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Access control: only admin / sub_admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: only Admin or Sub Admin can call cleanup_expired_cache';
    END IF;

    DELETE FROM public.ai_cache WHERE expires_at IS NOT NULL AND expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 5d. get_cache_stats
CREATE OR REPLACE FUNCTION public.get_cache_stats()
RETURNS TABLE (
    cache_type text,
    total_entries bigint,
    total_hits bigint,
    expired_entries bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Access control: only admin / sub_admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: only Admin or Sub Admin can call get_cache_stats';
    END IF;

    RETURN QUERY
    SELECT
        ac.cache_type,
        COUNT(*) AS total_entries,
        SUM(ac.hit_count) AS total_hits,
        SUM(CASE WHEN ac.expires_at IS NOT NULL AND ac.expires_at < now() THEN 1 ELSE 0 END) AS expired_entries
    FROM public.ai_cache ac
    GROUP BY ac.cache_type
    ORDER BY total_entries DESC;
END;
$$;

-- ================================================================
-- PART 6: Ensure ai_feedback table has public.schema prefix
-- ================================================================

-- Make sure ai_conversation_logs and ai_safety_events are in public schema
-- (they were created without schema prefix in observability_core migration)
-- This is a no-op if they are already in public schema
DO $$
BEGIN
    -- Verify tables exist in public schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ai_conversation_logs'
    ) THEN
        RAISE NOTICE 'ai_conversation_logs not found in public schema, creating alias view...';
    END IF;
END;
$$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
