-- ================================================================
-- Migration: Phase P4 — AI Cost & Performance Optimization
-- Date: 2026-06-09
-- Purpose:
--   1. Fix critical JOIN bug in match_product_chunks RPC
--      (pk.id UUID vs pkc.product_id integer → type mismatch)
--   2. Add get_ai_performance_summary() RPC for Performance Dashboard
-- ================================================================

-- ================================================================
-- PART 1: Fix match_product_chunks JOIN bug
-- The previous migration (20260521083000) joined:
--   pk.id (UUID) = pkc.product_id (integer)  ← WRONG
-- Correct join:
--   pk.product_id (integer) = pkc.product_id (integer)
-- ================================================================

DROP FUNCTION IF EXISTS public.match_product_chunks(vector(1536), double precision, integer, integer[]) CASCADE;
DROP FUNCTION IF EXISTS public.match_product_chunks(vector(1536), double precision, integer, integer[], integer) CASCADE;

CREATE OR REPLACE FUNCTION public.match_product_chunks(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_product_ids integer[] DEFAULT NULL,
    required_knowledge_version integer DEFAULT NULL
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
    -- FIX: join on integer product_id, not on UUID id
    INNER JOIN public.product_knowledge pk ON pk.product_id = pkc.product_id
    WHERE
        pkc.is_active = true
        AND pk.is_active = true
        AND pk.qa_status = 'approved'
        AND (required_knowledge_version IS NULL OR pkc.knowledge_version = required_knowledge_version)
        AND 1 - (pkc.embedding <=> query_embedding) > match_threshold
        AND (filter_product_ids IS NULL OR pkc.product_id = ANY(filter_product_ids))
    ORDER BY pkc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute to authenticated users (RLS controls the underlying tables)
GRANT EXECUTE ON FUNCTION public.match_product_chunks(vector(1536), double precision, integer, integer[], integer) TO authenticated;

-- ================================================================
-- PART 2: get_ai_performance_summary() — Admin Performance Dashboard
-- Returns key metrics: tokens, latency, cost, cache hit ratio
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_ai_performance_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Access control: admin only
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT jsonb_build_object(

        -- Per-mode averages (last 30 days)
        'by_mode', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'mode',             mode,
                    'total_requests',   COUNT(*),
                    'avg_tokens',       ROUND(AVG(total_tokens)),
                    'avg_latency_ms',   ROUND(AVG(latency_ms)),
                    'avg_cost_usd',     ROUND(AVG(estimated_cost_usd)::numeric, 6),
                    'total_cost_usd',   ROUND(SUM(estimated_cost_usd)::numeric, 4),
                    'cache_hit_count',  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END),
                    'cache_hit_rate',   ROUND(
                        SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::numeric
                        / NULLIF(COUNT(*), 0) * 100, 1
                    )
                )
            )
            FROM public.ai_usage_logs
            WHERE created_at >= now() - interval '30 days'
            GROUP BY mode
            ORDER BY SUM(estimated_cost_usd) DESC
        ),

        -- Today's summary
        'today', jsonb_build_object(
            'total_requests',   COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
            'total_tokens',     COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= CURRENT_DATE), 0),
            'total_cost_usd',   ROUND(COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at >= CURRENT_DATE), 0)::numeric, 4),
            'avg_latency_ms',   ROUND(AVG(latency_ms) FILTER (WHERE created_at >= CURRENT_DATE)),
            'cache_hits',       COALESCE(SUM(CASE WHEN cache_hit AND created_at >= CURRENT_DATE THEN 1 ELSE 0 END), 0),
            'cache_hit_rate',   ROUND(
                COALESCE(SUM(CASE WHEN cache_hit AND created_at >= CURRENT_DATE THEN 1 ELSE 0 END), 0)::numeric
                / NULLIF(COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE), 0) * 100, 1
            )
        ),

        -- This week's summary
        'this_week', jsonb_build_object(
            'total_requests', COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now())),
            'total_tokens',   COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= date_trunc('week', now())), 0),
            'total_cost_usd', ROUND(COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at >= date_trunc('week', now())), 0)::numeric, 4)
        ),

        -- Top 5 most expensive single requests (last 7 days)
        'top_expensive', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'mode',               mode,
                    'total_tokens',       total_tokens,
                    'estimated_cost_usd', estimated_cost_usd,
                    'latency_ms',         latency_ms,
                    'model',              model,
                    'created_at',         created_at
                )
            )
            FROM (
                SELECT mode, total_tokens, estimated_cost_usd, latency_ms, model, created_at
                FROM public.ai_usage_logs
                WHERE created_at >= now() - interval '7 days'
                ORDER BY estimated_cost_usd DESC
                LIMIT 5
            ) top5
        ),

        -- Overall cache stats from ai_cache table
        'cache_stats', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'cache_type',     cache_type,
                    'total_entries',  COUNT(*),
                    'total_hits',     SUM(hit_count),
                    'active_entries', COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > now())
                )
            )
            FROM public.ai_cache
            GROUP BY cache_type
        ),

        -- Safety events last 7 days
        'safety_events_7d', (
            SELECT jsonb_build_object(
                'total', (SELECT COUNT(*) FROM public.ai_safety_events WHERE created_at >= now() - interval '7 days'),
                'unhandled', (SELECT COUNT(*) FROM public.ai_safety_events WHERE created_at >= now() - interval '7 days' AND NOT handled),
                'by_type', COALESCE((
                    SELECT jsonb_object_agg(et, ec)
                    FROM (
                        SELECT COALESCE(event_type, 'unknown') as et, COUNT(*) as ec
                        FROM public.ai_safety_events
                        WHERE created_at >= now() - interval '7 days'
                        GROUP BY COALESCE(event_type, 'unknown')
                    ) sub
                ), '{}'::jsonb)
            )
        ),

        'generated_at', now()

    ) INTO result
    FROM public.ai_usage_logs;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_performance_summary() TO authenticated;

-- ================================================================
-- PART 3: Daily usage materialized stats view (for quick reads)
-- ================================================================

DROP VIEW IF EXISTS public.ai_performance_daily;
CREATE OR REPLACE VIEW public.ai_performance_daily AS
SELECT
    date_trunc('day', created_at)::date                                 AS day,
    mode,
    COUNT(*)                                                            AS total_requests,
    ROUND(AVG(total_tokens))                                            AS avg_tokens,
    ROUND(AVG(latency_ms))                                              AS avg_latency_ms,
    ROUND(SUM(estimated_cost_usd)::numeric, 4)                         AS total_cost_usd,
    SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)                         AS cache_hits,
    ROUND(
        SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
    )                                                                   AS cache_hit_rate_pct
FROM public.ai_usage_logs
GROUP BY date_trunc('day', created_at)::date, mode
ORDER BY day DESC, mode;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
