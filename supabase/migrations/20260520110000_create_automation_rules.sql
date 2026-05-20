-- Migration: Create automation_rules table, add rule_id to automation_logs, and seed 11 rules.

-- 1. Ensure public.is_admin_or_sub_admin helper function exists
DROP FUNCTION IF EXISTS public.is_admin_or_sub_admin(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin_or_sub_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = $1
        AND role IN ('admin', 'sub_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create public.automation_rules table
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    is_configurable boolean NOT NULL DEFAULT false,
    threshold_value numeric,
    threshold_unit text,
    metadata jsonb DEFAULT '{}'::jsonb,
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_is_enabled ON public.automation_rules (is_enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_category ON public.automation_rules (category);

-- 4. Setup Row Level Security (RLS)
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and Sub Admin can manage automation rules" ON public.automation_rules;
CREATE POLICY "Admin and Sub Admin can manage automation rules"
ON public.automation_rules
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- 5. Alter public.automation_logs table if it exists to add rule_id column
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'automation_logs') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automation_logs' AND column_name = 'rule_id') THEN
            ALTER TABLE public.automation_logs 
            ADD COLUMN rule_id text REFERENCES public.automation_rules(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 6. Seed 11 automation rules
INSERT INTO public.automation_rules (id, name, category, is_enabled, is_configurable, description, threshold_value, threshold_unit)
VALUES
('lead_assigned', 'Tự động giao Lead cho Sale', 'app_flow', true, true, 'Tạo công việc gọi điện và gửi thông báo khi Lead mới được phân bổ cho nhân viên.', 4, 'hours'),
('quote_follow_up', 'Tự động nhắc chăm sóc báo giá', 'app_flow', true, true, 'Nhắc nhở nhân viên Sale gọi điện chốt đơn sau một số ngày kể từ khi tạo báo giá.', 3, 'days'),
('post_purchase_checkin', 'Tự động gọi chăm sóc sau mua', 'app_flow', true, true, 'Tạo công việc hỏi thăm trải nghiệm khách hàng sau khi đơn hàng thành công.', 7, 'days'),
('event_follow_up', 'Tự động chăm sóc sau sự kiện', 'app_flow', true, false, 'Tạo công việc tương tác sau khi khách hàng tham gia sự kiện thương hiệu.', 1, 'days'),
('customer_at_risk', 'Cảnh báo thu hồi khách hàng', 'app_flow', true, false, 'Thông báo và tạo công việc khẩn cấp khi khách hàng có nguy cơ bị thu hồi về kho chung.', NULL, NULL),
('reorder_reminder', 'Tự động nhắc nhở tái đặt hàng', 'app_flow', true, true, 'Nhắc nhở Sale liên hệ khi Spa đã dùng hết chu kỳ mỹ phẩm mặc định.', 60, 'days'),
('task_overdue_notification', 'Cảnh báo công việc quá hạn', 'app_flow', true, false, 'Gửi thông báo nhắc nhở Sale khi công việc chưa hoàn thành quá hạn chót.', 24, 'hours'),
('task_assigned', 'Thông báo công việc mới được giao', 'db_trigger', true, false, 'Tự động gửi thông báo tức thời cho nhân viên khi được gán việc mới.', NULL, NULL),
('customer_ownership_assigned', 'Thông báo nhận bàn giao khách hàng', 'db_trigger', true, false, 'Tự động gửi thông báo cho Sale/Tele khi được phân quyền sở hữu khách hàng mới.', NULL, NULL),
('stagnant_lead_warning', 'Cảnh báo Lead mới tồn đọng', 'db_cron', true, true, 'Quét ngầm mỗi 6 giờ và cảnh báo cho Tele Lead nếu Lead mới > 24h chưa được phân phối.', 24, 'hours'),
('team_overdue_task_escalation', 'Leo thang giám sát Task quá hạn', 'db_cron', true, false, 'Quét ngầm mỗi 6 giờ và gửi thông báo cho Trưởng nhóm nếu Task VIP quá hạn.', 24, 'hours')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    is_enabled = EXCLUDED.is_enabled,
    is_configurable = EXCLUDED.is_configurable,
    description = EXCLUDED.description,
    threshold_value = EXCLUDED.threshold_value,
    threshold_unit = EXCLUDED.threshold_unit,
    updated_at = now();

-- 7. Add public.automation_rules to realtime publication if not already added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'automation_rules'
    ) THEN
        -- Already exists
    ELSE
        ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_rules;
    END IF;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
