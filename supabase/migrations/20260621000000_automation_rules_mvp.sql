-- ============================================================================
-- MIGRATION: Phase P4 - Automation Rules MVP
-- ============================================================================

-- 1. Create or Alter automation_rules table
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE
);

ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS trigger_type text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS condition_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS action_type text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS action_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS run_frequency text DEFAULT 'manual';
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

-- Thêm created_by nếu chưa có, bỏ qua lỗi nếu FK conflict bằng cách không set FK cứng ngay lập tức nếu sợ lỗi, 
-- nhưng an toàn nhất là cứ add column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='created_by') THEN
        ALTER TABLE public.automation_rules ADD COLUMN created_by uuid REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='created_at') THEN
        ALTER TABLE public.automation_rules ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='updated_at') THEN
        ALTER TABLE public.automation_rules ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END $$;

-- Checks (Sử dụng NOT VALID để không throw lỗi với các dòng dữ liệu cũ của bảng)
ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_trigger_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_trigger_type_check 
    CHECK (trigger_type IN ('customer_stale', 'followup_overdue', 'missing_social', 'duplicate_risk', 'quotation_pending')) NOT VALID;

ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_action_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_action_type_check 
    CHECK (action_type IN ('create_task', 'create_notification', 'create_task_and_notification')) NOT VALID;

ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_run_frequency_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_run_frequency_check 
    CHECK (run_frequency IN ('manual', 'daily')) NOT VALID;

-- RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/SubAdmin select automation_rules" ON public.automation_rules;
CREATE POLICY "Admin/SubAdmin select automation_rules" 
ON public.automation_rules FOR SELECT 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin/SubAdmin insert automation_rules" ON public.automation_rules;
CREATE POLICY "Admin/SubAdmin insert automation_rules" 
ON public.automation_rules FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin/SubAdmin update automation_rules" ON public.automation_rules;
CREATE POLICY "Admin/SubAdmin update automation_rules" 
ON public.automation_rules FOR UPDATE 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin/SubAdmin delete automation_rules" ON public.automation_rules;
CREATE POLICY "Admin/SubAdmin delete automation_rules" 
ON public.automation_rules FOR DELETE 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

-- 2. Create automation_run_logs table
CREATE TABLE IF NOT EXISTS public.automation_run_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id text REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    run_by uuid REFERENCES auth.users(id),
    status text,
    matched_count int DEFAULT 0,
    action_count int DEFAULT 0,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.automation_run_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/SubAdmin select automation_run_logs" ON public.automation_run_logs;
CREATE POLICY "Admin/SubAdmin select automation_run_logs" 
ON public.automation_run_logs FOR SELECT 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Insert is done via SECURITY DEFINER functions, so we can restrict it or allow admin.
DROP POLICY IF EXISTS "Admin/SubAdmin insert automation_run_logs" ON public.automation_run_logs;
CREATE POLICY "Admin/SubAdmin insert automation_run_logs" 
ON public.automation_run_logs FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));


-- 3. Seed Default Rules (Idempotent)
INSERT INTO public.automation_rules (id, name, description, category, trigger_type, condition_json, action_type, run_frequency)
VALUES 
('customer_stale_7_days', 'Khách 7 ngày chưa chăm', 'Tạo task và thông báo cho nhân viên nếu khách 7 ngày chưa có tương tác.', 'app_flow', 'customer_stale', '{"days": 7}'::jsonb, 'create_task_and_notification', 'manual'),
('followup_overdue_1_day', 'Follow-up quá hạn', 'Cảnh báo tự động nếu lịch hẹn/task chăm sóc quá hạn 1 ngày.', 'app_flow', 'followup_overdue', '{"days_overdue": 1}'::jsonb, 'create_notification', 'manual'),
('missing_social_contact', 'Khách thiếu social', 'Tạo task cập nhật Kênh Liên Hệ nếu thiếu Zalo hoặc Facebook.', 'app_flow', 'missing_social', '{"required": ["facebook", "zalo"]}'::jsonb, 'create_task', 'manual')
ON CONFLICT (id) DO NOTHING;


-- 4. RPCs

-- Hàm: public.run_automation_rule
DROP FUNCTION IF EXISTS public.run_automation_rule(text);
CREATE OR REPLACE FUNCTION public.run_automation_rule(p_rule_id text)
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_rule record;
    v_matched_count int := 0;
    v_action_count int := 0;
    v_error_message text := NULL;
    
    -- Variables cho loop
    v_customer record;
    v_task record;
    
    -- Variables xử lý dedupe
    v_existing_task uuid;
BEGIN
    -- Security check
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Permission denied.';
    END IF;

    -- Load rule
    SELECT * INTO v_rule FROM public.automation_rules WHERE id = p_rule_id;
    IF v_rule IS NULL OR NOT v_rule.is_active THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rule is inactive or not found.');
    END IF;

    -- Logic xử lý theo Trigger Type
    BEGIN
        IF v_rule.trigger_type = 'customer_stale' THEN
            -- Tìm khách hàng lâu không có log
            -- condition_json->>'days'
            DECLARE
                v_days int := COALESCE((v_rule.condition_json->>'days')::int, 7);
            BEGIN
                FOR v_customer IN 
                    SELECT c.id, c.owner_sale_id, c.full_name
                    FROM public.customers c
                    WHERE c.owner_sale_id IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1 FROM public.customer_activities a 
                          WHERE a.customer_id = c.id 
                            AND a.created_at > (now() - (v_days || ' days')::interval)
                      )
                      -- check last_interaction if we have it? Let's use simple check.
                LOOP
                    v_matched_count := v_matched_count + 1;
                    
                    -- Check Dedupe Task: không tạo task 'Khách lâu chưa chăm' nếu có task mở
                    SELECT id INTO v_existing_task 
                    FROM public.customer_tasks 
                    WHERE customer_id = v_customer.id 
                      AND status != 'completed' 
                      AND title = 'Chăm sóc khách lâu không tương tác' 
                      AND created_at > now() - interval '24 hours'
                    LIMIT 1;

                    IF v_existing_task IS NULL THEN
                        IF v_rule.action_type IN ('create_task', 'create_task_and_notification') THEN
                            INSERT INTO public.customer_tasks (customer_id, assigned_to, title, description, task_type, due_at, created_by)
                            VALUES (v_customer.id, v_customer.owner_sale_id, 'Chăm sóc khách lâu không tương tác', 'Khách hàng ' || v_customer.full_name || ' đã ' || v_days || ' ngày chưa có tương tác.', 'follow_up', now() + interval '1 day', auth.uid());
                            v_action_count := v_action_count + 1;
                        END IF;
                        
                        IF v_rule.action_type IN ('create_notification', 'create_task_and_notification') THEN
                            PERFORM public.create_notification_safe(
                                p_recipient_user_id := v_customer.owner_sale_id,
                                p_notification_type := 'followup_due',
                                p_title := 'Khách hàng bị bỏ quên',
                                p_message := 'Khách hàng ' || v_customer.full_name || ' đã ' || v_days || ' ngày chưa được chăm sóc.',
                                p_customer_id := v_customer.id,
                                p_deep_link := '/customers?id=' || v_customer.id
                            );
                            v_action_count := v_action_count + 1;
                        END IF;
                    END IF;
                END LOOP;
            END;

        ELSIF v_rule.trigger_type = 'followup_overdue' THEN
            -- Tìm follow-up tasks quá hạn N ngày
            DECLARE
                v_days_overdue int := COALESCE((v_rule.condition_json->>'days_overdue')::int, 1);
            BEGIN
                FOR v_task IN 
                    SELECT t.id, t.customer_id, t.assigned_to, t.title, c.full_name
                    FROM public.customer_tasks t
                    LEFT JOIN public.customers c ON c.id = t.customer_id
                    WHERE t.status != 'completed'
                      AND t.due_at < (now() - (v_days_overdue || ' days')::interval)
                      AND t.assigned_to IS NOT NULL
                LOOP
                    v_matched_count := v_matched_count + 1;
                    
                    IF v_rule.action_type IN ('create_notification', 'create_task_and_notification') THEN
                        PERFORM public.create_notification_safe(
                            p_recipient_user_id := v_task.assigned_to,
                            p_notification_type := 'followup_overdue',
                            p_title := 'Cảnh báo: Việc chăm sóc quá hạn nghiêm trọng',
                            p_message := 'Việc "' || v_task.title || '" của ' || COALESCE(v_task.full_name, 'Khách hàng') || ' đã quá hạn ' || v_days_overdue || ' ngày.',
                            p_customer_id := v_task.customer_id,
                            p_related_id := v_task.id,
                            p_related_type := 'customer_tasks',
                            p_deep_link := '/workspace',
                            p_priority := 'high'
                        );
                        v_action_count := v_action_count + 1;
                    END IF;
                END LOOP;
            END;

        ELSIF v_rule.trigger_type = 'missing_social' THEN
            -- Tìm khách thiếu Zalo / Facebook
            FOR v_customer IN 
                SELECT c.id, c.owner_sale_id, c.full_name
                FROM public.customers c
                WHERE c.owner_sale_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM public.customer_contact_channels ch 
                      WHERE ch.customer_id = c.id 
                        AND ch.channel_type IN ('zalo', 'facebook')
                  )
            LOOP
                v_matched_count := v_matched_count + 1;

                -- Check dedupe task
                SELECT id INTO v_existing_task 
                FROM public.customer_tasks 
                WHERE customer_id = v_customer.id 
                  AND status != 'completed' 
                  AND title = 'Bổ sung Kênh liên hệ Social' 
                  AND created_at > now() - interval '24 hours'
                LIMIT 1;

                IF v_existing_task IS NULL THEN
                    IF v_rule.action_type IN ('create_task', 'create_task_and_notification') THEN
                        INSERT INTO public.customer_tasks (customer_id, assigned_to, title, description, task_type, due_at, created_by)
                        VALUES (v_customer.id, v_customer.owner_sale_id, 'Bổ sung Kênh liên hệ Social', 'Khách hàng ' || v_customer.full_name || ' chưa có Zalo hoặc Facebook. Vui lòng bổ sung.', 'follow_up', now() + interval '2 days', auth.uid());
                        v_action_count := v_action_count + 1;
                    END IF;
                END IF;
            END LOOP;

        ELSE
            -- Unknown trigger
            v_error_message := 'Trigger type ' || v_rule.trigger_type || ' is not supported yet.';
        END IF;

    EXCEPTION WHEN OTHERS THEN
        v_error_message := SQLERRM;
    END;

    -- Update rule last run
    UPDATE public.automation_rules 
    SET last_run_at = now() 
    WHERE id = p_rule_id;

    -- Log run
    INSERT INTO public.automation_run_logs (rule_id, run_by, status, matched_count, action_count, error_message)
    VALUES (p_rule_id, auth.uid(), CASE WHEN v_error_message IS NULL THEN 'success' ELSE 'failed' END, v_matched_count, v_action_count, v_error_message);

    RETURN jsonb_build_object(
        'success', v_error_message IS NULL,
        'matched_count', v_matched_count,
        'action_count', v_action_count,
        'error_message', v_error_message
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Hàm: public.run_active_automation_rules
DROP FUNCTION IF EXISTS public.run_active_automation_rules();
CREATE OR REPLACE FUNCTION public.run_active_automation_rules()
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_rule record;
    v_runs int := 0;
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Permission denied.';
    END IF;

    FOR v_rule IN 
        SELECT id FROM public.automation_rules WHERE is_active = true
    LOOP
        PERFORM public.run_automation_rule(v_rule.id);
        v_runs := v_runs + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'rules_run', v_runs);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Hàm: public.get_automation_rules_summary
DROP FUNCTION IF EXISTS public.get_automation_rules_summary();
CREATE OR REPLACE FUNCTION public.get_automation_rules_summary()
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_result jsonb;
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Permission denied.';
    END IF;

    WITH rule_logs AS (
        SELECT DISTINCT ON (rule_id) rule_id, status as last_status, matched_count as last_matched, action_count as last_action, error_message
        FROM public.automation_run_logs
        ORDER BY rule_id, created_at DESC
    ),
    summary AS (
        SELECT r.*, 
               l.last_status, 
               l.last_matched, 
               l.last_action,
               l.error_message
        FROM public.automation_rules r
        LEFT JOIN rule_logs l ON l.rule_id = r.id
        ORDER BY r.created_at ASC
    )
    SELECT COALESCE(jsonb_agg(row_to_json(summary)), '[]'::jsonb) INTO v_result
    FROM summary;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kích hoạt tải lại schema cho PostgREST
NOTIFY pgrst, 'reload schema';
