-- Migration: Update RPCs for Touchpoint Quality & KPI Weighting

-- 1. Update log_quick_call_result to include quality and weight
CREATE OR REPLACE FUNCTION public.log_quick_call_result(
    p_customer_id uuid,
    p_result_type text, -- 'no_answer', 'interested', 'call_back', 'sent_quote', 'wrong_number', 'unreachable'
    p_note text,
    p_next_follow_up_at timestamptz DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_customer RECORD;
    v_is_admin boolean;
    v_has_access boolean;
    v_activity_content text;
    v_result_label text;
    v_weight integer;
    v_quality text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id;
    IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    v_is_admin := public.is_admin_or_sub_admin(v_user_id);
    v_has_access := v_is_admin OR v_customer.owner_sale_id = v_user_id OR v_customer.owner_tele_id = v_user_id OR v_customer.user_id = v_user_id;
    
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permission denied. You do not have access to this customer.';
    END IF;

    v_result_label := CASE p_result_type
        WHEN 'no_answer' THEN 'Không nghe máy'
        WHEN 'interested' THEN 'Quan tâm'
        WHEN 'call_back' THEN 'Hẹn gọi lại'
        WHEN 'sent_quote' THEN 'Đã gửi báo giá'
        WHEN 'wrong_number' THEN 'Sai số'
        WHEN 'unreachable' THEN 'Không liên hệ được'
        ELSE p_result_type
    END;

    -- Calculate Weight & Quality
    v_weight := CASE p_result_type
        WHEN 'interested' THEN 5
        WHEN 'call_back' THEN 4
        WHEN 'no_answer' THEN 1
        WHEN 'wrong_number' THEN 0
        WHEN 'unreachable' THEN 1
        WHEN 'sent_quote' THEN 8
        ELSE 1
    END;

    v_quality := CASE p_result_type
        WHEN 'interested' THEN 'high'
        WHEN 'call_back' THEN 'medium'
        WHEN 'no_answer' THEN 'low'
        WHEN 'wrong_number' THEN 'negative'
        WHEN 'unreachable' THEN 'low'
        WHEN 'sent_quote' THEN 'high'
        ELSE 'neutral'
    END;

    INSERT INTO public.customer_interactions (
        customer_id,
        user_id,
        interaction_type,
        channel,
        content,
        interaction_weight,
        interaction_quality
    ) VALUES (
        p_customer_id,
        v_user_id,
        'outbound',
        'phone',
        'Kết quả gọi: ' || v_result_label || CHR(10) || COALESCE(p_note, ''),
        v_weight,
        v_quality
    );

    v_activity_content := 'Đã log cuộc gọi nhanh: ' || v_result_label;
    IF p_note IS NOT NULL AND p_note != '' THEN
        v_activity_content := v_activity_content || CHR(10) || 'Ghi chú: ' || p_note;
    END IF;
    IF p_next_follow_up_at IS NOT NULL THEN
        v_activity_content := v_activity_content || CHR(10) || 'Lịch hẹn lại: ' || to_char(p_next_follow_up_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI');
    END IF;

    INSERT INTO public.customer_activities (
        customer_id,
        created_by,
        activity_type,
        title,
        content,
        interaction_weight,
        interaction_quality
    ) VALUES (
        p_customer_id,
        v_user_id,
        'status_change',
        'Gọi điện chăm sóc',
        v_activity_content,
        v_weight,
        v_quality
    );

    UPDATE public.customers
    SET 
        last_activity_at = NOW(),
        last_contacted_at = NOW(),
        next_follow_up_at = COALESCE(p_next_follow_up_at, next_follow_up_at),
        ownership_status = CASE WHEN p_result_type = 'wrong_number' THEN 'inactive' ELSE ownership_status END,
        updated_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_customer_id;

    IF p_next_follow_up_at IS NOT NULL THEN
        INSERT INTO public.customer_tasks (
            customer_id,
            assigned_to,
            assigned_by,
            title,
            task_type,
            priority,
            status,
            due_at
        ) VALUES (
            p_customer_id,
            v_user_id,
            v_user_id,
            'Hẹn gọi lại sau khi liên hệ',
            'follow_up',
            'high',
            'pending',
            p_next_follow_up_at
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Log cuộc gọi thành công',
        'customer_id', p_customer_id,
        'weight', v_weight,
        'quality', v_quality
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update get_lead_performance_dashboard to include KPI weighting
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
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Requires admin or sub_admin role.';
    END IF;

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
            COALESCE(SUM(c_acts.touchpoint_score), 0) as touchpoint_score,
            COALESCE(SUM(c_acts.positive_touchpoints), 0) as positive_touchpoints,
            COALESCE(SUM(c_acts.low_quality_touchpoints), 0) as low_quality_touchpoints,
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
            SELECT 
                COUNT(*) as interact_count,
                COALESCE(SUM(ca.interaction_weight), 0) as touchpoint_score,
                COUNT(*) FILTER (WHERE ca.interaction_quality IN ('high', 'medium')) as positive_touchpoints,
                COUNT(*) FILTER (WHERE ca.interaction_quality IN ('low', 'negative')) as low_quality_touchpoints
            FROM public.customer_activities ca 
            WHERE ca.customer_id = c.id
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
            COALESCE(SUM(c_acts.touchpoint_score), 0) as touchpoint_score,
            COALESCE(SUM(c_acts.positive_touchpoints), 0) as positive_touchpoints,
            COALESCE(SUM(c_acts.low_quality_touchpoints), 0) as low_quality_touchpoints,
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
            SELECT 
                COUNT(*) as interact_count,
                COALESCE(SUM(ca.interaction_weight), 0) as touchpoint_score,
                COUNT(*) FILTER (WHERE ca.interaction_quality IN ('high', 'medium')) as positive_touchpoints,
                COUNT(*) FILTER (WHERE ca.interaction_quality IN ('low', 'negative')) as low_quality_touchpoints
            FROM public.customer_activities ca 
            WHERE ca.customer_id = c.id
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

NOTIFY pgrst, 'reload schema';
