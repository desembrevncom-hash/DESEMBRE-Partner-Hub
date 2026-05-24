-- ============================================================================
-- MIGRATION: Phase P4.5 - Automation Governance Layer
-- ============================================================================

-- ============================================================================
-- 1. System Settings Hardening
-- ============================================================================

-- Thêm các cột governance vào bảng system_settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS pilot_mode_enabled boolean DEFAULT true;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS automation_enabled boolean DEFAULT false;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS notification_enabled boolean DEFAULT true;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS due_generator_enabled boolean DEFAULT false;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS automation_daily_limit int DEFAULT 200;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS notification_daily_limit int DEFAULT 500;

-- Cập nhật giá trị default nếu đang NULL (Idempotent)
UPDATE public.system_settings
SET 
    pilot_mode_enabled = COALESCE(pilot_mode_enabled, true),
    automation_enabled = COALESCE(automation_enabled, false),
    notification_enabled = COALESCE(notification_enabled, true),
    due_generator_enabled = COALESCE(due_generator_enabled, false),
    automation_daily_limit = COALESCE(automation_daily_limit, 200),
    notification_daily_limit = COALESCE(notification_daily_limit, 500);

-- ============================================================================
-- 2. Execution Locks Table & Helpers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_execution_locks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lock_key text UNIQUE NOT NULL,
    locked_by uuid REFERENCES auth.users(id),
    locked_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- RLS for locks (Only Admins can see/manage)
ALTER TABLE public.system_execution_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view locks" ON public.system_execution_locks;
CREATE POLICY "Admins can view locks" 
ON public.system_execution_locks FOR SELECT 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Lock Helper: Acquire
DROP FUNCTION IF EXISTS public.acquire_execution_lock(text, int);
CREATE OR REPLACE FUNCTION public.acquire_execution_lock(p_lock_key text, p_ttl_seconds int DEFAULT 300)
RETURNS boolean AS $$
DECLARE
    v_now timestamptz := now();
    v_locked boolean := false;
BEGIN
    -- Delete expired lock first
    DELETE FROM public.system_execution_locks 
    WHERE lock_key = p_lock_key AND expires_at <= v_now;

    -- Try to insert new lock
    BEGIN
        INSERT INTO public.system_execution_locks (lock_key, locked_by, locked_at, expires_at)
        VALUES (p_lock_key, auth.uid(), v_now, v_now + (p_ttl_seconds || ' seconds')::interval);
        v_locked := true;
    EXCEPTION WHEN unique_violation THEN
        v_locked := false;
    END;

    RETURN v_locked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lock Helper: Release
DROP FUNCTION IF EXISTS public.release_execution_lock(text);
CREATE OR REPLACE FUNCTION public.release_execution_lock(p_lock_key text)
RETURNS void AS $$
BEGIN
    DELETE FROM public.system_execution_locks WHERE lock_key = p_lock_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 3. Harden RPC: create_notification_safe
-- ============================================================================
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
) RETURNS uuid AS $$
DECLARE
    v_existing_id uuid;
    v_notif_enabled boolean;
    v_daily_limit int;
    v_today_count int;
BEGIN
    -- 1. Governance Checks
    SELECT notification_enabled, notification_daily_limit 
    INTO v_notif_enabled, v_daily_limit 
    FROM public.system_settings LIMIT 1;

    IF NOT COALESCE(v_notif_enabled, true) THEN
        RETURN NULL; -- No-op
    END IF;

    -- Check daily limit
    SELECT count(*) INTO v_today_count 
    FROM public.notifications 
    WHERE created_at >= current_date;

    IF v_today_count >= COALESCE(v_daily_limit, 500) THEN
        RETURN NULL; -- Limit reached, safe drop
    END IF;

    -- 2. Deduplicate check
    SELECT id INTO v_existing_id
    FROM public.notifications
    WHERE recipient_user_id = p_recipient_user_id
      AND notification_type = p_notification_type
      AND related_id IS NOT DISTINCT FROM p_related_id
      AND status = 'unread'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Update message and created_at instead of inserting new
        UPDATE public.notifications
        SET message = COALESCE(p_message, message),
            created_at = now()
        WHERE id = v_existing_id;
        
        RETURN v_existing_id;
    END IF;

    -- 3. Insert new notification
    INSERT INTO public.notifications (
        recipient_user_id, notification_type, title, message, priority, actor_user_id, customer_id, related_id, related_type, deep_link, metadata
    ) VALUES (
        p_recipient_user_id, p_notification_type, p_title, p_message, p_priority, p_actor_user_id, p_customer_id, p_related_id, p_related_type, p_deep_link, p_metadata
    ) RETURNING id INTO v_existing_id;

    RETURN v_existing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 4. Harden RPC: run_automation_rule
-- ============================================================================
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
    -- Security check
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Permission denied.';
    END IF;

    -- Governance Checks
    SELECT automation_enabled, pilot_mode_enabled, automation_daily_limit 
    INTO v_auto_enabled, v_pilot_enabled, v_daily_limit 
    FROM public.system_settings LIMIT 1;

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
                LOOP
                    v_matched_count := v_matched_count + 1;
                    IF v_rule.action_type IN ('create_notification', 'create_task_and_notification') THEN
                        PERFORM public.create_notification_safe(v_task.assigned_to, 'followup_overdue', 'Cảnh báo: Việc chăm sóc quá hạn', 'Việc "' || v_task.title || '" của ' || COALESCE(v_task.full_name, 'Khách hàng') || ' đã quá hạn ' || v_days_overdue || ' ngày.', 'high', NULL, v_task.customer_id, v_task.id, 'customer_tasks', '/workspace');
                        v_action_count := v_action_count + 1;
                    END IF;
                END LOOP;
            END;

        ELSIF v_rule.trigger_type = 'missing_social' THEN
            FOR v_customer IN 
                SELECT c.id, c.owner_sale_id, c.full_name FROM public.customers c
                WHERE c.owner_sale_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customer_contact_channels ch WHERE ch.customer_id = c.id AND ch.channel_type IN ('zalo', 'facebook'))
            LOOP
                v_matched_count := v_matched_count + 1;
                SELECT id INTO v_existing_task FROM public.customer_tasks WHERE customer_id = v_customer.id AND status != 'completed' AND title = 'Bổ sung Kênh liên hệ Social' AND created_at > now() - interval '24 hours' LIMIT 1;
                IF v_existing_task IS NULL THEN
                    IF v_rule.action_type IN ('create_task', 'create_task_and_notification') THEN
                        INSERT INTO public.customer_tasks (customer_id, assigned_to, title, description, task_type, due_at, created_by)
                        VALUES (v_customer.id, v_customer.owner_sale_id, 'Bổ sung Kênh liên hệ Social', 'Khách hàng ' || v_customer.full_name || ' chưa có Zalo hoặc Facebook. Vui lòng bổ sung.', 'follow_up', now() + interval '2 days', auth.uid());
                        v_action_count := v_action_count + 1;
                    END IF;
                END IF;
            END LOOP;
        ELSE
            v_error_message := 'Trigger type ' || v_rule.trigger_type || ' is not supported.';
        END IF;

        -- Update rule last run
        UPDATE public.automation_rules SET last_run_at = now() WHERE id = p_rule_id;

        -- Log run
        INSERT INTO public.automation_run_logs (rule_id, run_by, status, matched_count, action_count, error_message)
        VALUES (p_rule_id, auth.uid(), 'success', v_matched_count, v_action_count, NULL);

    EXCEPTION WHEN OTHERS THEN
        v_error_message := SQLERRM;
        INSERT INTO public.automation_run_logs (rule_id, run_by, status, matched_count, action_count, error_message)
        VALUES (p_rule_id, auth.uid(), 'failed', v_matched_count, v_action_count, v_error_message);
    END;

    -- Release Lock
    PERFORM public.release_execution_lock(v_lock_key);

    RETURN jsonb_build_object('success', v_error_message IS NULL, 'matched_count', v_matched_count, 'action_count', v_action_count, 'error_message', v_error_message);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 5. Harden RPC: run_active_automation_rules
-- ============================================================================
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


-- ============================================================================
-- 6. Harden RPC: generate_due_notifications
-- ============================================================================
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
    v_notif_enabled boolean;
    v_locked boolean;
    v_lock_key text := 'due_notifications:generator';
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Permission denied.'; END IF;

    -- Governance
    SELECT due_generator_enabled, notification_enabled INTO v_due_enabled, v_notif_enabled FROM public.system_settings LIMIT 1;
    IF NOT COALESCE(v_due_enabled, false) OR NOT COALESCE(v_notif_enabled, true) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Due generator or notifications are disabled globally.');
    END IF;

    -- Lock
    v_locked := public.acquire_execution_lock(v_lock_key, 300);
    IF NOT v_locked THEN
        RETURN jsonb_build_object('success', false, 'message', 'Locked. Generator is already running.');
    END IF;

    -- (Logic quét Tasks Quá hạn, Hôm nay, Events sắp diễn ra - Giữ nguyên như cũ)
    -- ... [Để ngắn gọn script, tôi sẽ copy logic cũ sang đây nhưng đảm bảo nó chạy đúng như P3.1]
    
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


-- ============================================================================
-- 7. Governance Audit RPC: get_automation_governance_summary
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_automation_governance_summary();
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
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Permission denied.'; END IF;

    -- Lấy settings an toàn bằng to_jsonb
    SELECT to_jsonb(t) INTO v_settings FROM (
        SELECT pilot_mode_enabled, automation_enabled, notification_enabled, due_generator_enabled, automation_daily_limit, notification_daily_limit 
        FROM public.system_settings LIMIT 1
    ) t;

    -- Thống kê trong ngày
    SELECT count(*), COALESCE(sum(CASE WHEN status='failed' THEN 1 ELSE 0 END), 0)
    INTO v_runs, v_fails
    FROM public.automation_run_logs WHERE created_at >= current_date;

    SELECT count(*) INTO v_tasks FROM public.customer_tasks WHERE created_at >= current_date AND title IN ('Chăm sóc khách lâu không tương tác', 'Bổ sung Kênh liên hệ Social');
    SELECT count(*) INTO v_notifs FROM public.notifications WHERE created_at >= current_date;

    -- Lấy locks đang chạy
    SELECT COALESCE(jsonb_agg(row_to_json(l)), '[]'::jsonb) INTO v_locks
    FROM (SELECT * FROM public.system_execution_locks ORDER BY expires_at DESC) l;

    -- Lấy runs gần nhất
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_recent
    FROM (
        SELECT log.*, rule.name as rule_name 
        FROM public.automation_run_logs log 
        LEFT JOIN public.automation_rules rule ON rule.id = log.rule_id
        ORDER BY log.created_at DESC LIMIT 10
    ) r;

    RETURN jsonb_build_object(
        'settings', v_settings,
        'today_stats', jsonb_build_object(
            'automation_runs_today', v_runs,
            'tasks_created_today', v_tasks,
            'notifications_created_today', v_notifs,
            'failed_runs_today', v_fails
        ),
        'locks', v_locks,
        'recent_runs', v_recent
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kích hoạt lại cache
NOTIFY pgrst, 'reload schema';
