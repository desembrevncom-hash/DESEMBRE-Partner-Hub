-- ============================================================================
-- MIGRATION: Phase P1B, P1C, P1D - Workspace Execution Dashboard (Full)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_workspace_execution_dashboard();
CREATE OR REPLACE FUNCTION public.get_workspace_execution_dashboard()
RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
    v_lead_to_call_count int := 0;
    v_follow_up_today_count int := 0;
    v_check_in_today_count int := 0;
    v_quotation_pending_count int := 0;
    v_draft_order_count int := 0;
    v_overdue_count int := 0;
    
    v_stale_customers_count int := 0;
    v_missing_social_count int := 0;
    v_duplicate_risk_count int := 0;
    v_overdue_followups_count int := 0;
    
    v_today_priorities jsonb := '[]'::jsonb;
    v_upcoming_timeline jsonb := '[]'::jsonb;
    v_team_risks jsonb := '[]'::jsonb;
BEGIN
    v_user_id := auth.uid();
    v_is_admin := public.is_admin_or_sub_admin(v_user_id);

    -- 1. Tính toán Counters (P1A)
    IF v_is_admin THEN
        SELECT COUNT(*) INTO v_lead_to_call_count FROM public.customer_tasks WHERE task_type = 'call' AND status = 'pending';
        SELECT COUNT(*) INTO v_follow_up_today_count FROM public.customers WHERE next_follow_up_at::date = CURRENT_DATE AND deleted_at IS NULL;
        SELECT COUNT(*) INTO v_check_in_today_count FROM public.customer_tasks WHERE task_type IN ('visit', 'check_in') AND status = 'pending';
        SELECT COUNT(*) INTO v_quotation_pending_count FROM public.customer_tasks WHERE (task_type IN ('quote_follow_up', 'quotation') OR title ILIKE '%báo giá%') AND status = 'pending';
        SELECT COUNT(*) INTO v_draft_order_count FROM public.orders WHERE status IN ('draft', 'pending');
        SELECT COUNT(*) INTO v_overdue_count FROM public.customer_tasks WHERE due_at < NOW() AND status = 'pending';
        v_overdue_count := v_overdue_count + (SELECT COUNT(*) FROM public.calendar_events WHERE starts_at < NOW() AND status = 'pending');
    ELSE
        SELECT COUNT(*) INTO v_lead_to_call_count FROM public.customer_tasks WHERE task_type = 'call' AND status = 'pending' AND assigned_to = v_user_id;
        SELECT COUNT(*) INTO v_follow_up_today_count FROM public.customers WHERE next_follow_up_at::date = CURRENT_DATE AND deleted_at IS NULL AND owner_sale_id = v_user_id;
        SELECT COUNT(*) INTO v_check_in_today_count FROM public.customer_tasks WHERE task_type IN ('visit', 'check_in') AND status = 'pending' AND assigned_to = v_user_id;
        SELECT COUNT(*) INTO v_quotation_pending_count FROM public.customer_tasks WHERE (task_type IN ('quote_follow_up', 'quotation') OR title ILIKE '%báo giá%') AND status = 'pending' AND assigned_to = v_user_id;
        SELECT COUNT(*) INTO v_draft_order_count FROM public.orders WHERE status IN ('draft', 'pending') AND created_by = v_user_id;
        SELECT COUNT(*) INTO v_overdue_count FROM public.customer_tasks WHERE due_at < NOW() AND status = 'pending' AND assigned_to = v_user_id;
        v_overdue_count := v_overdue_count + (SELECT COUNT(*) FROM public.calendar_events WHERE starts_at < NOW() AND status = 'pending' AND assigned_sale_id = v_user_id);
    END IF;

    -- 2. Smart Alerts (P1C)
    IF v_is_admin THEN
        SELECT COUNT(*) INTO v_stale_customers_count FROM public.customers WHERE (last_activity_at < NOW() - INTERVAL '7 days' OR last_activity_at IS NULL) AND deleted_at IS NULL;
        SELECT COUNT(*) INTO v_missing_social_count FROM public.customers c WHERE deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.customer_contact_channels ch WHERE ch.customer_id = c.id AND ch.channel_type IN ('facebook', 'zalo'));
        SELECT COUNT(*) INTO v_duplicate_risk_count FROM (SELECT value FROM public.customer_contact_channels WHERE channel_type = 'phone' GROUP BY value HAVING COUNT(DISTINCT customer_id) > 1) as dupes;
        SELECT COUNT(*) INTO v_overdue_followups_count FROM public.customers WHERE next_follow_up_at::date < CURRENT_DATE AND deleted_at IS NULL;
    ELSE
        SELECT COUNT(*) INTO v_stale_customers_count FROM public.customers WHERE (last_activity_at < NOW() - INTERVAL '7 days' OR last_activity_at IS NULL) AND deleted_at IS NULL AND owner_sale_id = v_user_id;
        SELECT COUNT(*) INTO v_missing_social_count FROM public.customers c WHERE deleted_at IS NULL AND owner_sale_id = v_user_id AND NOT EXISTS (SELECT 1 FROM public.customer_contact_channels ch WHERE ch.customer_id = c.id AND ch.channel_type IN ('facebook', 'zalo'));
        SELECT COUNT(*) INTO v_duplicate_risk_count FROM (SELECT ch.value FROM public.customer_contact_channels ch JOIN public.customers c ON c.id = ch.customer_id WHERE ch.channel_type = 'phone' AND c.owner_sale_id = v_user_id GROUP BY ch.value HAVING COUNT(DISTINCT ch.customer_id) > 1) as dupes;
        SELECT COUNT(*) INTO v_overdue_followups_count FROM public.customers WHERE next_follow_up_at::date < CURRENT_DATE AND deleted_at IS NULL AND owner_sale_id = v_user_id;
    END IF;

    -- 3. Today Priorities (P1B, P1D)
    WITH priorities AS (
        -- Overdue Tasks (Score 100)
        SELECT 
            t.id::text, 
            'overdue_task' as type, 
            t.title as title, 
            'Đã quá hạn xử lý' as subtitle,
            t.customer_id::text, 
            c.name as customer_name,
            t.due_at::text, 
            'urgent' as priority, 
            100 as priority_score, 
            'Task chưa hoàn thành đúng hạn' as reason, 
            'Mở việc' as action_label, 
            'open_customer' as action_type,
            '/customers?id=' || t.customer_id as deep_link
        FROM public.customer_tasks t
        LEFT JOIN public.customers c ON c.id = t.customer_id
        WHERE t.status = 'pending' AND t.due_at < NOW()
          AND (v_is_admin OR t.assigned_to = v_user_id)

        UNION ALL

        -- Follow up today (Score 90)
        SELECT 
            c.id::text as id, 
            'follow_up' as type, 
            'Follow-up khách hàng' as title, 
            'Lịch CSKH định kỳ' as subtitle,
            c.id::text as customer_id, 
            c.name as customer_name,
            c.next_follow_up_at::text as due_at, 
            'high' as priority, 
            90 as priority_score, 
            'Đã đến hạn chăm sóc' as reason, 
            'Mở khách' as action_label, 
            'open_customer' as action_type,
            '/customers?id=' || c.id as deep_link
        FROM public.customers c
        WHERE c.next_follow_up_at::date = CURRENT_DATE AND c.deleted_at IS NULL
          AND (v_is_admin OR c.owner_sale_id = v_user_id)

        UNION ALL

        -- Upcoming event in 2 hours (Score 80)
        SELECT 
            e.id::text, 
            'upcoming_event' as type, 
            e.title as title, 
            'Lịch trình sắp diễn ra' as subtitle,
            e.customer_id::text, 
            c.name as customer_name,
            e.starts_at::text as due_at, 
            'high' as priority, 
            80 as priority_score, 
            'Sắp diễn ra trong 2 giờ tới' as reason, 
            'Mở lịch' as action_label, 
            'open_calendar' as action_type,
            '/calendar?event=' || e.id as deep_link
        FROM public.calendar_events e
        LEFT JOIN public.customers c ON c.id = e.customer_id
        WHERE e.status = 'pending' AND e.starts_at >= NOW() AND e.starts_at <= NOW() + INTERVAL '2 hours'
          AND (v_is_admin OR e.assigned_sale_id = v_user_id)
          
        UNION ALL
        
        -- Stale Customers (Score 65)
        SELECT 
            c.id::text as id, 
            'stale_customer' as type, 
            'Khách hàng ngủ đông' as title, 
            'Không có tương tác gần đây' as subtitle,
            c.id::text as customer_id, 
            c.name as customer_name,
            c.last_activity_at::text as due_at, 
            'medium' as priority, 
            65 as priority_score, 
            '7 ngày chưa có log hoạt động' as reason, 
            'Gọi ngay' as action_label, 
            'call' as action_type,
            '/customers?id=' || c.id as deep_link
        FROM public.customers c
        WHERE (c.last_activity_at < NOW() - INTERVAL '7 days' OR c.last_activity_at IS NULL) AND c.deleted_at IS NULL
          AND (v_is_admin OR c.owner_sale_id = v_user_id)
    )
    SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) INTO v_today_priorities
    FROM (
        SELECT * FROM priorities 
        ORDER BY priority_score DESC, due_at ASC NULLS LAST
        LIMIT 10
    ) p;

    -- 4. Upcoming Timeline (P1C)
    WITH timeline AS (
        SELECT 
            id::text,
            title,
            event_type,
            starts_at::text,
            ends_at::text,
            customer_id::text,
            visibility
        FROM public.calendar_events
        WHERE starts_at::date = CURRENT_DATE
          AND (v_is_admin OR assigned_sale_id = v_user_id OR owner_user_id = v_user_id OR visibility = 'company')
        ORDER BY starts_at ASC
    )
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_upcoming_timeline FROM timeline t;

    -- 5. Team Risks (P1B - Chỉ dành cho Admin)
    IF v_is_admin THEN
        WITH risks AS (
            -- Sale có nhiều follow-up quá hạn
            SELECT 
                gen_random_uuid()::text as id,
                '⚠️ Sale ' || p.display_name || ' có ' || COUNT(*)::text || ' khách hàng quá hạn follow-up!' as message,
                'high' as risk_level,
                'overdue_followup' as type
            FROM public.customers c
            JOIN public.profiles p ON p.id = c.owner_sale_id
            WHERE c.next_follow_up_at::date < CURRENT_DATE AND c.deleted_at IS NULL
            GROUP BY p.display_name
            HAVING COUNT(*) >= 5

            UNION ALL

            -- Duplicate Phone risk
            SELECT 
                gen_random_uuid()::text as id,
                '⚠️ Cảnh báo: Số điện thoại ' || ch.value || ' đang bị trùng ở ' || COUNT(DISTINCT ch.customer_id)::text || ' khách hàng!' as message,
                'medium' as risk_level,
                'duplicate_channel' as type
            FROM public.customer_contact_channels ch
            WHERE ch.channel_type = 'phone'
            GROUP BY ch.value
            HAVING COUNT(DISTINCT ch.customer_id) > 1
        )
        SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_team_risks FROM risks r;
    END IF;

    -- 6. Trả về JSONB structure chuẩn
    RETURN jsonb_build_object(
        'counters', jsonb_build_object(
            'lead_to_call_count', v_lead_to_call_count,
            'follow_up_today_count', v_follow_up_today_count,
            'check_in_today_count', v_check_in_today_count,
            'quotation_pending_count', v_quotation_pending_count,
            'draft_order_count', v_draft_order_count,
            'overdue_count', v_overdue_count
        ),
        'today_priorities', v_today_priorities,
        'upcoming_timeline', v_upcoming_timeline,
        'smart_alerts', jsonb_build_object(
            'stale_customers_count', v_stale_customers_count,
            'customers_missing_social_count', v_missing_social_count,
            'duplicate_channel_risk_count', v_duplicate_risk_count,
            'overdue_followups_count', v_overdue_followups_count
        ),
        'team_risks', v_team_risks
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Làm mới schema cache
NOTIFY pgrst, 'reload schema';
