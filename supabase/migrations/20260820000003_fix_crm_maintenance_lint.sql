-- ============================================================================
-- FIX CRM MAINTENANCE LINT ERRORS
-- ============================================================================

-- 1. Fix run_crm_maintenance_tasks (Fix column error & SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.run_crm_maintenance_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_task RECORD;
    v_order RECORD;
    v_lead RECORD;
BEGIN
    -- 1.1 NHẮC NHỞ TASK QUÁ HẠN (Overdue Tasks)
    FOR v_task IN 
        SELECT ct.*, c.facility_name, c.name as customer_name
        FROM public.customer_tasks ct
        LEFT JOIN public.customers c ON ct.customer_id = c.id
        WHERE ct.status = 'pending' 
          AND ct.due_at < now()
          AND ct.due_at > now() - interval '24 hours'
    LOOP
        IF v_task.assigned_to IS NOT NULL THEN
            PERFORM public.create_system_notification(
                v_task.assigned_to,
                '⚠️ CẢNH BÁO: Task quá hạn!',
                'Task "' || v_task.title || '" cho ' || COALESCE(v_task.facility_name, v_task.customer_name) || ' đã quá hạn.',
                'task_overdue',
                'high',
                'task',
                v_task.id,
                '/workspace'
            );
        END IF;
        
        IF v_task.priority IN ('high', 'urgent') AND v_task.owner_tele_id IS NOT NULL THEN
            PERFORM public.create_system_notification(
                v_task.owner_tele_id,
                '🚨 Giám sát: Task của team quá hạn',
                'Nhân sự được gán chưa xử lý task "' || v_task.title || '" đúng hạn.',
                'task_overdue',
                'normal',
                'task',
                v_task.id,
                '/workspace'
            );
        END IF;
    END LOOP;

    -- 1.2 TỰ ĐỘNG TẠO TASK CHECK-IN SAU MUA (Post-Purchase Check-in)
    FOR v_order IN
        SELECT o.id, o.customer_id, c.owner_sale_id, c.facility_name
        FROM public.orders o
        JOIN public.customers c ON o.customer_id = c.id
        WHERE o.status = 'completed'
          AND o.updated_at::date = (now() - interval '7 days')::date
          AND NOT EXISTS (
              SELECT 1 FROM public.customer_tasks 
              WHERE customer_id = o.customer_id 
                AND task_type = 'follow_up' 
                AND created_at > o.updated_at
          )
    LOOP
        INSERT INTO public.customer_tasks (
            customer_id,
            assigned_to,
            task_type,
            title,
            note,
            priority,
            due_at
        ) VALUES (
            v_order.customer_id,
            v_order.owner_sale_id,
            'follow_up',
            '📞 Check-in khách hàng sau 7 ngày mua hàng',
            'Đơn hàng #' || v_order.id || ' đã hoàn thành được 1 tuần. Hãy gọi hỏi thăm trải nghiệm sản phẩm của khách.',
            'normal',
            now() + interval '1 day'
        );
    END LOOP;

    -- 1.3 CẢNH BÁO LEAD TỒN ĐỌNG (Stagnant Unassigned Leads)
    FOR v_lead IN
        SELECT id, facility_name, name
        FROM public.customers
        WHERE owner_tele_id IS NULL
          AND lifecycle_stage = 'new_lead'
          AND created_at < now() - interval '24 hours'
    LOOP
        INSERT INTO public.notifications (
            recipient_user_id, title, message, notification_type, priority, related_type, related_id
        )
        SELECT user_id, '📥 Lead mới chưa được phân phối', 
               'Lead ' || COALESCE(v_lead.facility_name, v_lead.name) || ' đã tồn đọng hơn 24h.',
               'system', 'high', 'customer', v_lead.id
        FROM public.user_roles WHERE role = 'tele_lead';
    END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.run_crm_maintenance_tasks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_crm_maintenance_tasks() FROM anon;

-- 2. Fix get_workspace_execution_dashboard
CREATE OR REPLACE FUNCTION public.get_workspace_execution_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
    v_lead_to_call_count int := 0;
    v_follow_up_today_count int := 0;
    v_check_in_today_count int := 0;
    v_quotation_pending_count int := 0;
    v_draft_order_count int := 0;
    v_overdue_count int := 0;
BEGIN
    v_user_id := auth.uid();
    v_is_admin := public.is_admin_or_sub_admin(v_user_id);

    IF v_is_admin THEN
        SELECT COUNT(*) INTO v_lead_to_call_count FROM public.customer_tasks WHERE task_type = 'call' AND status = 'pending';
        SELECT COUNT(*) INTO v_follow_up_today_count FROM public.customers WHERE next_follow_up_at::date = CURRENT_DATE AND deleted_at IS NULL;
        SELECT COUNT(*) INTO v_check_in_today_count FROM public.customer_tasks WHERE task_type IN ('visit', 'check_in') AND status = 'pending';
        SELECT COUNT(*) INTO v_quotation_pending_count FROM public.customer_tasks WHERE (task_type IN ('quote_follow_up', 'quotation') OR title ILIKE '%báo giá%') AND status = 'pending';
        SELECT COUNT(*) INTO v_draft_order_count FROM public.orders WHERE status IN ('draft', 'pending');
        SELECT COUNT(*) INTO v_overdue_count FROM public.customer_tasks WHERE due_at < NOW() AND status = 'pending';
        
        v_overdue_count := v_overdue_count + COALESCE((SELECT COUNT(*) FROM public.calendar_events WHERE starts_at < NOW() AND status = 'pending'), 0);
    ELSE
        SELECT COUNT(*) INTO v_lead_to_call_count FROM public.customer_tasks WHERE task_type = 'call' AND status = 'pending' AND assigned_to = v_user_id;
        SELECT COUNT(*) INTO v_follow_up_today_count FROM public.customers WHERE next_follow_up_at::date = CURRENT_DATE AND deleted_at IS NULL AND owner_sale_id = v_user_id;
        SELECT COUNT(*) INTO v_check_in_today_count FROM public.customer_tasks WHERE task_type IN ('visit', 'check_in') AND status = 'pending' AND assigned_to = v_user_id;
        SELECT COUNT(*) INTO v_quotation_pending_count FROM public.customer_tasks WHERE (task_type IN ('quote_follow_up', 'quotation') OR title ILIKE '%báo giá%') AND status = 'pending' AND assigned_to = v_user_id;
        SELECT COUNT(*) INTO v_draft_order_count FROM public.orders WHERE status IN ('draft', 'pending') AND sale_user_id = v_user_id;
        SELECT COUNT(*) INTO v_overdue_count FROM public.customer_tasks WHERE due_at < NOW() AND status = 'pending' AND assigned_to = v_user_id;
        
        v_overdue_count := v_overdue_count + COALESCE((SELECT COUNT(*) FROM public.calendar_events WHERE starts_at < NOW() AND status = 'pending' AND assigned_sale_id = v_user_id), 0);
    END IF;

    RETURN jsonb_build_object(
        'counters', jsonb_build_object(
            'lead_to_call_count', v_lead_to_call_count,
            'follow_up_today_count', v_follow_up_today_count,
            'check_in_today_count', v_check_in_today_count,
            'quotation_pending_count', v_quotation_pending_count,
            'draft_order_count', v_draft_order_count,
            'overdue_count', v_overdue_count
        ),
        'today_priorities', '[]'::jsonb,
        'upcoming_timeline', '[]'::jsonb,
        'smart_alerts', '{}'::jsonb,
        'team_risks', '[]'::jsonb
    );
END;
$$;
REVOKE ALL ON FUNCTION public.get_workspace_execution_dashboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_workspace_execution_dashboard() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_execution_dashboard() TO authenticated;

-- 3. Fix run_active_automation_rules
CREATE OR REPLACE FUNCTION public.run_active_automation_rules()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_is_admin boolean;
    v_rule record;
    v_runs int := 0;
    
    -- Governance
    v_auto_enabled boolean;
    v_locked boolean;
    v_lock_key text := 'automation_rules:run_all';
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Permission denied.'; END IF;

    -- Governance (Removed unused v_pilot_enabled)
    SELECT automation_enabled INTO v_auto_enabled FROM public.system_settings LIMIT 1;
    IF NOT COALESCE(v_auto_enabled, false) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Automation is disabled globally.');
    END IF;

    -- Lock
    v_locked := public.acquire_execution_lock(v_lock_key, 600);
    IF NOT v_locked THEN
        RETURN jsonb_build_object('success', false, 'message', 'Locked. Run all is already running.');
    END IF;

    -- Logic
    FOR v_rule IN SELECT id FROM public.automation_rules WHERE is_active = true
    LOOP
        PERFORM public.run_automation_rule(v_rule.id);
        v_runs := v_runs + 1;
    END LOOP;

    -- Release lock
    PERFORM public.release_execution_lock(v_lock_key);

    RETURN jsonb_build_object('success', true, 'rules_run', v_runs);
END;
$$;
REVOKE ALL ON FUNCTION public.run_active_automation_rules() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_active_automation_rules() FROM anon;
GRANT EXECUTE ON FUNCTION public.run_active_automation_rules() TO authenticated;
