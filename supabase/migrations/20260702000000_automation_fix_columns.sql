-- Migration: Automation Safe Defaults
-- Đảm bảo hệ thống ở trạng thái an toàn (SAFE MODE) trước khi deploy

-- 1. Đảm bảo các cột settings tồn tại (Idempotent)
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS pilot_mode_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS due_generator_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS automation_daily_limit INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS notification_daily_limit INTEGER DEFAULT 500;

-- Set Default Production-Safe Values (Đảm bảo giá trị an toàn)
UPDATE public.system_settings
SET pilot_mode_enabled = true,
    automation_enabled = false,
    due_generator_enabled = false,
    notification_enabled = true,
    automation_daily_limit = 100,
    notification_daily_limit = 500
WHERE id = (SELECT id FROM public.system_settings LIMIT 1);


-- 2. Harden Core RPCs

-- A & D. run_automation_rule
CREATE OR REPLACE FUNCTION public.run_automation_rule(p_rule_id text)
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_rule record;
    v_matched_count int := 0;
    v_action_count int := 0;
    v_error_message text := NULL;
    v_customer record;
    v_task record;
    v_existing_task uuid;
    
    -- Governance
    v_auto_enabled boolean;
    v_pilot_enabled boolean;
    v_daily_limit int;
    v_today_runs int;
    v_lock_key text := 'automation_rule:' || p_rule_id;
    v_locked boolean;
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Permission denied.'; END IF;

    -- Governance Checks
    SELECT automation_enabled, pilot_mode_enabled, automation_daily_limit 
    INTO v_auto_enabled, v_pilot_enabled, v_daily_limit 
    FROM public.system_settings LIMIT 1;

    -- Nếu tắt automation toàn cục
    IF NOT COALESCE(v_auto_enabled, false) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Automation is disabled globally.');
    END IF;

    -- Check Daily Limit
    SELECT count(*) INTO v_today_runs FROM public.automation_run_logs WHERE created_at >= current_date;
    IF v_today_runs >= COALESCE(v_daily_limit, 200) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Daily automation run limit reached.');
    END IF;

    -- Execution Lock
    v_locked := public.acquire_execution_lock(v_lock_key, 300);
    IF NOT v_locked THEN
        RETURN jsonb_build_object('success', false, 'message', 'Locked. Rule is already running.');
    END IF;

    -- Logic bắt đầu
    BEGIN
        SELECT * INTO v_rule FROM public.automation_rules WHERE id = p_rule_id;
        IF v_rule IS NULL OR NOT v_rule.is_active THEN
            v_error_message := 'Rule is inactive or not found.';
            RAISE EXCEPTION '%', v_error_message;
        END IF;

        IF v_rule.trigger_type = 'customer_stale' THEN
            DECLARE v_days int := COALESCE((v_rule.condition_json->>'days')::int, 7);
            BEGIN
                FOR v_customer IN 
                    SELECT c.id, c.owner_sale_id, c.full_name
                    FROM public.customers c
                    WHERE c.owner_sale_id IS NOT NULL
                      -- PILOT CHECK: Chỉ cho pilot user hoặc tất cả
                      AND (v_pilot_enabled = false OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = c.owner_sale_id AND ur.role IN ('admin', 'sub_admin', 'tele_lead')))
                      AND NOT EXISTS (
                          SELECT 1 FROM public.customer_activities a 
                          WHERE a.customer_id = c.id AND a.created_at > (now() - (v_days || ' days')::interval)
                      )
                LOOP
                    v_matched_count := v_matched_count + 1;
                    SELECT id INTO v_existing_task FROM public.customer_tasks 
                    WHERE customer_id = v_customer.id AND status != 'completed' AND title = 'Chăm sóc khách lâu không tương tác' AND created_at > now() - interval '24 hours' LIMIT 1;

                    IF v_existing_task IS NULL THEN
                        IF v_rule.action_type IN ('create_task', 'create_task_and_notification') THEN
                            INSERT INTO public.customer_tasks (customer_id, assigned_to, title, description, task_type, due_at, created_by)
                            VALUES (v_customer.id, v_customer.owner_sale_id, 'Chăm sóc khách lâu không tương tác', 'Khách hàng ' || v_customer.full_name || ' đã ' || v_days || ' ngày chưa có tương tác.', 'follow_up', now() + interval '1 day', auth.uid());
                            v_action_count := v_action_count + 1;
                        END IF;
                        
                        IF v_rule.action_type IN ('create_notification', 'create_task_and_notification') THEN
                            PERFORM public.create_notification_safe(v_customer.owner_sale_id, 'followup_due', 'Khách hàng bị bỏ quên', 'Khách hàng ' || v_customer.full_name || ' đã ' || v_days || ' ngày chưa được chăm sóc.', 'normal', NULL, v_customer.id, NULL, NULL, '/customers?id=' || v_customer.id);
                            v_action_count := v_action_count + 1;
                        END IF;
                    END IF;
                END LOOP;
            END;

        ELSIF v_rule.trigger_type = 'followup_overdue' THEN
            DECLARE v_days_overdue int := COALESCE((v_rule.condition_json->>'days_overdue')::int, 1);
            BEGIN
                FOR v_task IN 
                    SELECT t.id, t.customer_id, t.assigned_to, t.title, c.full_name
                    FROM public.customer_tasks t LEFT JOIN public.customers c ON c.id = t.customer_id
                    WHERE t.status != 'completed' AND t.due_at < (now() - (v_days_overdue || ' days')::interval) AND t.assigned_to IS NOT NULL
                      -- PILOT CHECK: Chỉ cho pilot user hoặc tất cả
                      AND (v_pilot_enabled = false OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = t.assigned_to AND ur.role IN ('admin', 'sub_admin', 'tele_lead')))
                LOOP
                    v_matched_count := v_matched_count + 1;
                    
                    IF v_rule.action_type IN ('create_notification') THEN
                        PERFORM public.create_notification_safe(v_task.assigned_to, 'task_overdue', 'Nhắc nhở Task quá hạn nặng', 'Task "' || v_task.title || '" (Khách: ' || COALESCE(v_task.full_name, 'N/A') || ') đã quá hạn ' || v_days_overdue || ' ngày.', 'high', NULL, v_task.customer_id, v_task.id, 'customer_tasks', '/workspace');
                        v_action_count := v_action_count + 1;
                    END IF;
                END LOOP;
            END;
        END IF;

        -- Log run
        INSERT INTO public.automation_run_logs (rule_id, status, matched_count, action_count)
        VALUES (p_rule_id, 'success', v_matched_count, v_action_count);

    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.automation_run_logs (rule_id, status, error_message)
        VALUES (p_rule_id, 'failed', SQLERRM);
        PERFORM public.release_execution_lock(v_lock_key);
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
    END;

    PERFORM public.release_execution_lock(v_lock_key);
    RETURN jsonb_build_object('success', true, 'matched_count', v_matched_count, 'action_count', v_action_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. run_active_automation_rules
CREATE OR REPLACE FUNCTION public.run_active_automation_rules()
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_rule record;
    v_runs int := 0;
    
    -- Governance
    v_auto_enabled boolean;
    v_pilot_enabled boolean;
    v_locked boolean;
    v_lock_key text := 'automation_rules:run_all';
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Permission denied.'; END IF;

    -- Governance
    SELECT automation_enabled, pilot_mode_enabled INTO v_auto_enabled, v_pilot_enabled FROM public.system_settings LIMIT 1;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. generate_due_notifications
CREATE OR REPLACE FUNCTION public.generate_due_notifications()
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_created_overdue int := 0;
    v_created_due_today int := 0;
    v_created_upcoming int := 0;
    rec record;
    
    -- Governance
    v_due_enabled boolean;
    v_locked boolean;
    v_lock_key text := 'due_notifications:generator';
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Permission denied.'; END IF;

    -- Governance
    SELECT due_generator_enabled INTO v_due_enabled FROM public.system_settings LIMIT 1;
    IF NOT COALESCE(v_due_enabled, false) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Due generator is disabled globally.');
    END IF;

    -- Lock
    v_locked := public.acquire_execution_lock(v_lock_key, 300);
    IF NOT v_locked THEN
        RETURN jsonb_build_object('success', false, 'message', 'Locked. Generator is already running.');
    END IF;

    -- Task quá hạn
    FOR rec IN SELECT id, customer_id, title, task_type, due_at, assigned_to FROM public.customer_tasks WHERE status != 'completed' AND due_at < now() AND assigned_to IS NOT NULL
    LOOP
        PERFORM public.create_notification_safe(rec.assigned_to, CASE WHEN rec.task_type = 'follow_up' THEN 'followup_overdue' ELSE 'task_overdue' END, 'Công việc đã quá hạn', 'Công việc "' || rec.title || '" đã quá hạn.', 'high', NULL, rec.customer_id, rec.id, 'customer_tasks', '/workspace');
        v_created_overdue := v_created_overdue + 1;
    END LOOP;

    -- Task hôm nay
    FOR rec IN SELECT id, customer_id, title, task_type, due_at, assigned_to FROM public.customer_tasks WHERE status != 'completed' AND due_at >= current_date AND due_at < current_date + interval '1 day' AND assigned_to IS NOT NULL
    LOOP
        PERFORM public.create_notification_safe(rec.assigned_to, CASE WHEN rec.task_type = 'follow_up' THEN 'followup_due' ELSE 'system' END, 'Công việc đến hạn hôm nay', 'Cần xử lý: "' || rec.title || '".', 'normal', NULL, rec.customer_id, rec.id, 'customer_tasks', '/workspace');
        v_created_due_today := v_created_due_today + 1;
    END LOOP;

    -- Event sắp tới
    FOR rec IN SELECT id, customer_id, title, starts_at, owner_user_id, assigned_user_ids FROM public.calendar_events WHERE starts_at > now() AND starts_at <= now() + interval '2 hours'
    LOOP
        DECLARE
            v_recs uuid[] := ARRAY[]::uuid[];
            v_r uuid;
        BEGIN
            IF rec.owner_user_id IS NOT NULL THEN v_recs := array_append(v_recs, rec.owner_user_id); END IF;
            IF rec.assigned_user_ids IS NOT NULL THEN
                SELECT array_agg(DISTINCT x) INTO v_recs FROM (SELECT unnest(v_recs) AS x UNION SELECT unnest(rec.assigned_user_ids) AS x) t;
            END IF;
            IF v_recs IS NOT NULL THEN
                FOREACH v_r IN ARRAY v_recs
                LOOP
                    PERFORM public.create_notification_safe(v_r, 'event_upcoming', 'Sự kiện sắp diễn ra', 'Lịch "' || rec.title || '" sắp bắt đầu.', 'high', NULL, rec.customer_id, rec.id, 'calendar_events', '/workspace');
                    v_created_upcoming := v_created_upcoming + 1;
                END LOOP;
            END IF;
        END;
    END LOOP;

    -- Release Lock
    PERFORM public.release_execution_lock(v_lock_key);

    RETURN jsonb_build_object('success', true, 'notifications_processed', jsonb_build_object('overdue_tasks', v_created_overdue, 'due_today_tasks', v_created_due_today, 'upcoming_events', v_created_upcoming, 'total', v_created_overdue + v_created_due_today + v_created_upcoming));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- D. create_notification_safe
-- Trả về JSON theo yêu cầu: { "success": false, "reason": "notifications_disabled" } hoặc ID của notification
DROP FUNCTION IF EXISTS public.create_notification_safe;
CREATE OR REPLACE FUNCTION public.create_notification_safe(
    p_recipient_user_id uuid,
    p_notification_type text,
    p_title text,
    p_message text DEFAULT NULL,
    p_priority text DEFAULT 'normal',
    p_actor_user_id uuid DEFAULT NULL,
    p_customer_id uuid DEFAULT NULL,
    p_related_id uuid DEFAULT NULL,
    p_related_type text DEFAULT NULL,
    p_deep_link text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb AS $$
DECLARE
    v_existing_id uuid;
    v_notif_enabled boolean;
BEGIN
    -- Check Governance
    SELECT notification_enabled INTO v_notif_enabled FROM public.system_settings LIMIT 1;
    IF NOT COALESCE(v_notif_enabled, true) THEN
        RETURN jsonb_build_object('success', false, 'reason', 'notifications_disabled');
    END IF;

    -- Deduplicate check
    SELECT id INTO v_existing_id
    FROM public.notifications
    WHERE recipient_user_id = p_recipient_user_id
      AND type = p_notification_type
      AND related_id IS NOT DISTINCT FROM p_related_id
      AND status = 'unread'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.notifications
        SET message = COALESCE(p_message, message),
            created_at = now()
        WHERE id = v_existing_id;
        
        RETURN jsonb_build_object('success', true, 'id', v_existing_id);
    END IF;

    -- Insert new notification
    INSERT INTO public.notifications (
        recipient_user_id,
        type,
        title,
        message,
        priority,
        actor_user_id,
        customer_id,
        related_id,
        related_type,
        deep_link,
        metadata
    ) VALUES (
        p_recipient_user_id,
        p_notification_type,
        p_title,
        p_message,
        p_priority,
        p_actor_user_id,
        p_customer_id,
        p_related_id,
        p_related_type,
        p_deep_link,
        p_metadata
    ) RETURNING id INTO v_existing_id;

    RETURN jsonb_build_object('success', true, 'id', v_existing_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Cập nhật RPC get_automation_governance_summary để trả về đủ timestamp
CREATE OR REPLACE FUNCTION public.get_automation_governance_summary()
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_settings jsonb;
    v_runs int := 0;
    v_tasks int := 0;
    v_notifs int := 0;
    v_fails int := 0;
    v_locks jsonb;
    v_recent jsonb;
    
    v_last_auto TIMESTAMPTZ;
    v_last_due TIMESTAMPTZ;
    v_last_notif TIMESTAMPTZ;
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Permission denied.'; END IF;

    -- Lấy settings an toàn bằng to_jsonb
    SELECT to_jsonb(t) INTO v_settings FROM (
        SELECT pilot_mode_enabled, automation_enabled, notification_enabled, due_generator_enabled, automation_daily_limit, notification_daily_limit 
        FROM public.system_settings LIMIT 1
    ) t;

    -- Thống kê trong ngày
    SELECT count(*), COALESCE(sum(action_count),0), count(*) FILTER (WHERE status='failed')
    INTO v_runs, v_tasks, v_fails
    FROM public.automation_run_logs
    WHERE created_at >= current_date;

    SELECT count(*) INTO v_notifs
    FROM public.notifications
    WHERE created_at >= current_date;

    -- Lock status
    SELECT jsonb_object_agg(lock_key, jsonb_build_object('locked_at', locked_at, 'expires_at', expires_at)) INTO v_locks
    FROM public.execution_locks
    WHERE expires_at > now();
    
    IF v_locks IS NULL THEN v_locks := '{}'::jsonb; END IF;

    -- 10 log gần nhất
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent
    FROM (
        SELECT l.id, l.rule_id, l.status, l.matched_count as matched_records, l.action_count as actions_taken, l.error_message, l.created_at, r.name as rule_name
        FROM public.automation_run_logs l
        LEFT JOIN public.automation_rules r ON r.id = l.rule_id
        ORDER BY l.created_at DESC
        LIMIT 10
    ) t;

    -- Last Runtime Check
    SELECT MAX(created_at) INTO v_last_auto FROM public.automation_run_logs;
    -- Due generator lock
    SELECT MAX(locked_at) INTO v_last_due FROM public.execution_locks WHERE lock_key = 'due_notifications:generator';
    SELECT MAX(created_at) INTO v_last_notif FROM public.notifications;

    RETURN jsonb_build_object(
        'settings', v_settings,
        'stats_today', jsonb_build_object(
            'automation_runs', v_runs,
            'tasks_created', v_tasks,
            'failed_runs', v_fails,
            'notifications_created', v_notifs
        ),
        'active_locks', v_locks,
        'recent_logs', v_recent,
        'last_runtime', jsonb_build_object(
            'last_automation_run', v_last_auto,
            'last_due_generator_run', v_last_due,
            'last_notification_created', v_last_notif
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
