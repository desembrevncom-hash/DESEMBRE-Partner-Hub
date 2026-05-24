-- Migration: Update Internal Pilot Mode Modules
-- 1. Create Tables

CREATE TABLE IF NOT EXISTS public.pilot_modules (
    module_key text PRIMARY KEY,
    module_category text NOT NULL,
    module_name text NOT NULL,
    rollout_state text NOT NULL DEFAULT 'off' CHECK (rollout_state IN ('off', 'pilot_only', 'admin_only', 'on')),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pilot_users (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.pilot_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_users ENABLE ROW LEVEL SECURITY;

-- Mọi người được xem, nhưng chỉ Admin/SubAdmin được sửa
CREATE POLICY "Anyone can view pilot modules" ON public.pilot_modules FOR SELECT USING (true);
CREATE POLICY "Admin can modify pilot modules" ON public.pilot_modules FOR ALL USING (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Anyone can view pilot users" ON public.pilot_users FOR SELECT USING (true);
CREATE POLICY "Admin can modify pilot users" ON public.pilot_users FOR ALL USING (public.is_admin_or_sub_admin(auth.uid()));


-- 2. Insert Default Data (Idempotent)
INSERT INTO public.pilot_modules (module_key, module_category, module_name, rollout_state)
VALUES 
    ('ai_customer_suggestions', 'AI', 'AI Customer Suggestions', 'pilot_only'),
    ('communication_os', 'Communication OS', 'Communication OS (Quick Launcher)', 'on'),
    ('message_templates', 'Communication OS', 'Message Templates', 'on'),
    ('interaction_tracking', 'Communication OS', 'Interaction Tracking', 'on'),
    ('automation_rules', 'Automation', 'Automation Rules Engine', 'admin_only'),
    ('due_generator', 'Automation', 'Due Notifications Generator', 'off')
ON CONFLICT (module_key) DO UPDATE 
SET rollout_state = EXCLUDED.rollout_state,
    module_category = EXCLUDED.module_category,
    module_name = EXCLUDED.module_name;


-- 3. Core RPC Functions

-- Check Pilot Access Helper
CREATE OR REPLACE FUNCTION public.check_pilot_access(p_module_key text, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
    v_state text;
    v_is_admin boolean;
    v_is_pilot boolean;
BEGIN
    SELECT rollout_state INTO v_state FROM public.pilot_modules WHERE module_key = p_module_key;
    
    IF v_state IS NULL OR v_state = 'off' THEN
        RETURN false;
    END IF;
    
    IF v_state = 'on' THEN
        RETURN true;
    END IF;
    
    v_is_admin := public.is_admin_or_sub_admin(p_user_id);
    IF v_is_admin THEN
        RETURN true; -- Admin gets access to 'admin_only' and 'pilot_only'
    END IF;
    
    IF v_state = 'admin_only' THEN
        RETURN false;
    END IF;
    
    IF v_state = 'pilot_only' THEN
        SELECT EXISTS(SELECT 1 FROM public.pilot_users WHERE user_id = p_user_id) INTO v_is_pilot;
        RETURN v_is_pilot;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Harden Automation RPCs (combine system_settings + pilot_modules)

-- A. run_active_automation_rules
CREATE OR REPLACE FUNCTION public.run_active_automation_rules()
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_rule record;
    v_runs int := 0;
    
    -- Governance
    v_auto_enabled boolean;
    v_locked boolean;
    v_lock_key text := 'automation_rules:run_all';
    
    v_has_pilot_access boolean;
BEGIN
    -- Check system settings (Master Switch)
    SELECT automation_enabled INTO v_auto_enabled FROM public.system_settings LIMIT 1;
    IF NOT COALESCE(v_auto_enabled, false) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Automation is disabled globally.');
    END IF;
    
    -- Check pilot module rollout state
    v_has_pilot_access := public.check_pilot_access('automation_rules', auth.uid());
    IF NOT v_has_pilot_access THEN
         RETURN jsonb_build_object('success', false, 'message', 'Access denied by pilot mode settings (automation_rules).');
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


-- B. generate_due_notifications
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
    
    v_has_pilot_access boolean;
BEGIN
    -- Master Switch
    SELECT due_generator_enabled INTO v_due_enabled FROM public.system_settings LIMIT 1;
    IF NOT COALESCE(v_due_enabled, false) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Due generator is disabled globally.');
    END IF;
    
    -- Check pilot module rollout state
    v_has_pilot_access := public.check_pilot_access('due_generator', auth.uid());
    IF NOT v_has_pilot_access THEN
         RETURN jsonb_build_object('success', false, 'message', 'Access denied by pilot mode settings (due_generator).');
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
