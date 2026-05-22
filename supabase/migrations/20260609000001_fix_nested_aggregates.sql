-- Fix nested aggregate function calls in get_ai_performance_summary

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
                    'total_requests',   reqs,
                    'avg_tokens',       avg_tok,
                    'avg_latency_ms',   avg_lat,
                    'avg_cost_usd',     avg_cost,
                    'total_cost_usd',   tot_cost,
                    'cache_hit_count',  hit_cnt,
                    'cache_hit_rate',   hit_rate
                )
            )
            FROM (
                SELECT mode,
                    COUNT(*) as reqs,
                    ROUND(AVG(total_tokens)) as avg_tok,
                    ROUND(AVG(latency_ms)) as avg_lat,
                    ROUND(AVG(estimated_cost_usd)::numeric, 6) as avg_cost,
                    ROUND(SUM(estimated_cost_usd)::numeric, 4) as tot_cost,
                    SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as hit_cnt,
                    ROUND(
                        SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::numeric
                        / NULLIF(COUNT(*), 0) * 100, 1
                    ) as hit_rate,
                    SUM(estimated_cost_usd) as sort_cost
                FROM public.ai_usage_logs
                WHERE created_at >= now() - interval '30 days'
                GROUP BY mode
                ORDER BY sort_cost DESC
            ) sub_mode
        ),

        -- Today's summary
        'today', (
            SELECT jsonb_build_object(
                'total_requests',   COUNT(*),
                'total_tokens',     COALESCE(SUM(total_tokens), 0),
                'total_cost_usd',   ROUND(COALESCE(SUM(estimated_cost_usd), 0)::numeric, 4),
                'avg_latency_ms',   ROUND(AVG(latency_ms)),
                'cache_hits',       COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0),
                'cache_hit_rate',   ROUND(
                    COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0)::numeric
                    / NULLIF(COUNT(*), 0) * 100, 1
                )
            )
            FROM public.ai_usage_logs
            WHERE created_at >= CURRENT_DATE
        ),

        -- This week's summary
        'this_week', (
            SELECT jsonb_build_object(
                'total_requests', COUNT(*),
                'total_tokens',   COALESCE(SUM(total_tokens), 0),
                'total_cost_usd', ROUND(COALESCE(SUM(estimated_cost_usd), 0)::numeric, 4)
            )
            FROM public.ai_usage_logs
            WHERE created_at >= date_trunc('week', now())
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
                    'total_entries',  entries,
                    'total_hits',     hits,
                    'active_entries', active
                )
            )
            FROM (
                SELECT cache_type,
                    COUNT(*) as entries,
                    SUM(hit_count) as hits,
                    COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > now()) as active
                FROM public.ai_cache
                GROUP BY cache_type
            ) sub_cache
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

    ) INTO result;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
