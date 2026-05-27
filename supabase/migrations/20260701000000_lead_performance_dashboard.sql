-- ============================================================================
-- MIGRATION: Phase F4 - Lead Performance Dashboard
-- ============================================================================

-- 1. Create necessary indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_customer_channel ON public.customers(customer_channel);
CREATE INDEX IF NOT EXISTS idx_customer_activities_customer_id ON public.customer_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_activities_created_at ON public.customer_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_customer_id ON public.customer_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);

-- 2. Create the RPC for dashboard
CREATE OR REPLACE FUNCTION public.get_lead_performance_dashboard(
    p_from date DEFAULT CURRENT_DATE - interval '30 days',
    p_to date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
BEGIN
    -- Check role
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Requires admin or sub_admin role.';
    END IF;

    -- Using CTEs to compute the JSON result
    WITH date_filtered_customers AS (
        SELECT *
        FROM public.customers
        WHERE created_at >= p_from AND created_at < (p_to + interval '1 day')
          AND deleted_at IS NULL
    ),
    first_interactions AS (
        SELECT 
            customer_id,
            MIN(created_at) as first_contact_at
        FROM public.customer_activities
        GROUP BY customer_id
    ),
    summary_stats AS (
        SELECT 
            COUNT(*) as total_leads,
            COUNT(*) FILTER (WHERE owner_sale_id IS NOT NULL OR owner_tele_id IS NOT NULL) as assigned_leads,
            COUNT(*) FILTER (WHERE owner_sale_id IS NULL AND owner_tele_id IS NULL) as unassigned_leads,
            COUNT(*) FILTER (WHERE last_contacted_at < (now() - interval '30 days')) as at_risk_leads,
            COUNT(*) FILTER (WHERE owner_sale_id IS NOT NULL AND (last_contacted_at < (now() - interval '14 days') OR (last_contacted_at IS NULL AND created_at < (now() - interval '14 days')))) as pending_revoke,
            COUNT(*) FILTER (WHERE next_follow_up_at < now()) as overdue_followups
        FROM date_filtered_customers
    ),
    sla_stats AS (
        SELECT 
            COUNT(*) FILTER (WHERE last_contacted_at >= (now() - interval '7 days')) as on_time,
            COUNT(*) FILTER (WHERE last_contacted_at < (now() - interval '7 days') AND last_contacted_at >= (now() - interval '14 days')) as warning,
            COUNT(*) FILTER (WHERE last_contacted_at < (now() - interval '14 days') OR next_follow_up_at < now()) as overdue
        FROM date_filtered_customers
    ),
    by_sale_stats AS (
        SELECT 
            c.owner_sale_id as user_id,
            COALESCE(p.display_name, c.owner_sale_id::text) as name,
            COUNT(*) as assigned_count,
            COUNT(*) FILTER (WHERE c.last_contacted_at >= (now() - interval '7 days')) as active_count,
            COUNT(*) FILTER (WHERE c.last_contacted_at < (now() - interval '30 days')) as at_risk_count,
            COUNT(*) FILTER (WHERE c.last_contacted_at < (now() - interval '7 days')) as inactive_7d_count,
            COUNT(*) FILTER (WHERE c.owner_sale_id IS NOT NULL AND (c.last_contacted_at < (now() - interval '14 days') OR (c.last_contacted_at IS NULL AND c.created_at < (now() - interval '14 days')))) as pending_revoke_count,
            COALESCE(SUM(c_tasks.overdue_tasks), 0) as overdue_tasks_count,
            COALESCE(SUM(c_acts.interact_count), 0) as interactions_count,
            COALESCE(SUM(c_orders.order_count), 0) as orders_count,
            COALESCE(SUM(c_orders.total_revenue), 0) as revenue_total,
            AVG(EXTRACT(EPOCH FROM (fi.first_contact_at - c.created_at))/3600.0) as avg_first_touch_hours
        FROM date_filtered_customers c
        LEFT JOIN public.profiles p ON p.id = c.owner_sale_id
        LEFT JOIN first_interactions fi ON fi.customer_id = c.id
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as overdue_tasks FROM public.customer_tasks ct WHERE ct.customer_id = c.id AND ct.status != 'completed' AND ct.due_at < now()
        ) c_tasks ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as interact_count FROM public.customer_activities ca WHERE ca.customer_id = c.id
        ) c_acts ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as order_count, SUM(total) as total_revenue FROM public.orders o WHERE o.customer_id = c.id
        ) c_orders ON true
        WHERE c.owner_sale_id IS NOT NULL
        GROUP BY c.owner_sale_id, p.display_name
    ),
    by_tele_stats AS (
        SELECT 
            c.owner_tele_id as user_id,
            COALESCE(p.display_name, c.owner_tele_id::text) as name,
            COUNT(*) as assigned_count,
            COUNT(*) FILTER (WHERE c.last_contacted_at >= (now() - interval '7 days')) as active_count,
            COUNT(*) FILTER (WHERE c.last_contacted_at < (now() - interval '30 days')) as at_risk_count,
            COUNT(*) FILTER (WHERE c.last_contacted_at < (now() - interval '7 days')) as inactive_7d_count,
            COUNT(*) FILTER (WHERE c.owner_sale_id IS NOT NULL AND (c.last_contacted_at < (now() - interval '14 days') OR (c.last_contacted_at IS NULL AND c.created_at < (now() - interval '14 days')))) as pending_revoke_count,
            COALESCE(SUM(c_tasks.overdue_tasks), 0) as overdue_tasks_count,
            COALESCE(SUM(c_acts.interact_count), 0) as interactions_count,
            COALESCE(SUM(c_orders.order_count), 0) as orders_count,
            COALESCE(SUM(c_orders.total_revenue), 0) as revenue_total,
            AVG(EXTRACT(EPOCH FROM (fi.first_contact_at - c.created_at))/3600.0) as avg_first_touch_hours
        FROM date_filtered_customers c
        LEFT JOIN public.profiles p ON p.id = c.owner_tele_id
        LEFT JOIN first_interactions fi ON fi.customer_id = c.id
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as overdue_tasks FROM public.customer_tasks ct WHERE ct.customer_id = c.id AND ct.status != 'completed' AND ct.due_at < now()
        ) c_tasks ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as interact_count FROM public.customer_activities ca WHERE ca.customer_id = c.id
        ) c_acts ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as order_count, SUM(total) as total_revenue FROM public.orders o WHERE o.customer_id = c.id
        ) c_orders ON true
        WHERE c.owner_tele_id IS NOT NULL
        GROUP BY c.owner_tele_id, p.display_name
    ),
    by_source_stats AS (
        SELECT 
            COALESCE(c.customer_channel, 'Không rõ nguồn') as lead_source,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE c.owner_sale_id IS NOT NULL OR c.owner_tele_id IS NOT NULL) as assigned,
            COUNT(*) FILTER (WHERE c_orders.order_count > 0) as converted,
            COALESCE(SUM(c_orders.total_revenue), 0) as revenue_total,
            COUNT(*) FILTER (WHERE c.last_contacted_at < (now() - interval '30 days')) as at_risk_count
        FROM date_filtered_customers c
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as order_count, SUM(total) as total_revenue FROM public.orders o WHERE o.customer_id = c.id
        ) c_orders ON true
        GROUP BY COALESCE(c.customer_channel, 'Không rõ nguồn')
    ),
    revoke_candidates_list AS (
        SELECT 
            c.id as customer_id,
            c.name as customer_name,
            c.owner_sale_id,
            p.display_name as owner_sale_name,
            c.last_contacted_at as last_interaction_at,
            EXTRACT(DAY FROM (now() - COALESCE(c.last_contacted_at, c.created_at))) as inactive_days,
            'Quá hạn chăm sóc (14 ngày)' as reason
        FROM public.customers c
        LEFT JOIN public.profiles p ON p.id = c.owner_sale_id
        WHERE c.owner_sale_id IS NOT NULL
          AND c.deleted_at IS NULL
          AND COALESCE(c.last_contacted_at, c.created_at) < (now() - interval '14 days')
        ORDER BY inactive_days DESC
    )
    SELECT json_build_object(
        'summary', (SELECT to_json(s) FROM summary_stats s),
        'sla', (SELECT to_json(s) FROM sla_stats s),
        'by_sale', COALESCE((SELECT json_agg(s) FROM by_sale_stats s), '[]'::json),
        'by_tele', COALESCE((SELECT json_agg(s) FROM by_tele_stats s), '[]'::json),
        'by_source', COALESCE((SELECT json_agg(s) FROM by_source_stats s), '[]'::json),
        'revoke_candidates', COALESCE((SELECT json_agg(s) FROM revoke_candidates_list s), '[]'::json)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Kích hoạt tải lại schema cho PostgREST
NOTIFY pgrst, 'reload schema';
