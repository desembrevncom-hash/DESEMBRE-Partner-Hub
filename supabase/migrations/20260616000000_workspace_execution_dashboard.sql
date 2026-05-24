-- ============================================================================
-- MIGRATION: Phase P1A - Workspace Execution Dashboard
-- ============================================================================

-- 1. Thêm cột last_activity_at vào bảng customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- 2. Hàm trigger chung cập nhật last_activity_at
CREATE OR REPLACE FUNCTION public.touch_customer_last_activity()
RETURNS TRIGGER AS $$
DECLARE
    target_customer_id uuid;
BEGIN
    -- Xác định customer_id dựa vào tên bảng
    IF TG_TABLE_NAME = 'customer_activities' THEN
        target_customer_id := NEW.customer_id;
    ELSIF TG_TABLE_NAME = 'customer_contact_channels' THEN
        target_customer_id := NEW.customer_id;
    ELSIF TG_TABLE_NAME = 'calendar_events' THEN
        target_customer_id := NEW.customer_id;
    ELSIF TG_TABLE_NAME = 'customer_tasks' THEN
        target_customer_id := NEW.customer_id;
    END IF;

    -- Nếu có customer_id, update last_activity_at
    IF target_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET last_activity_at = NOW()
        WHERE id = target_customer_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Tạo các Triggers (nhẹ nhàng, có điều kiện)

-- 3.1 Trigger cho customer_activities
DROP TRIGGER IF EXISTS trg_customer_activities_touch_activity ON public.customer_activities;
CREATE TRIGGER trg_customer_activities_touch_activity
    AFTER INSERT OR UPDATE ON public.customer_activities
    FOR EACH ROW EXECUTE FUNCTION public.touch_customer_last_activity();

-- 3.2 Trigger cho customer_contact_channels
DROP TRIGGER IF EXISTS trg_customer_contact_channels_touch_activity ON public.customer_contact_channels;
CREATE TRIGGER trg_customer_contact_channels_touch_activity
    AFTER INSERT OR UPDATE ON public.customer_contact_channels
    FOR EACH ROW EXECUTE FUNCTION public.touch_customer_last_activity();

-- 3.3 Trigger cho calendar_events (chỉ khi có customer_id)
DROP TRIGGER IF EXISTS trg_calendar_events_touch_activity ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_touch_activity
    AFTER INSERT OR UPDATE ON public.calendar_events
    FOR EACH ROW 
    WHEN (NEW.customer_id IS NOT NULL)
    EXECUTE FUNCTION public.touch_customer_last_activity();

-- 3.4 Trigger cho customer_tasks (chỉ khi có customer_id)
DROP TRIGGER IF EXISTS trg_customer_tasks_touch_activity ON public.customer_tasks;
CREATE TRIGGER trg_customer_tasks_touch_activity
    AFTER INSERT OR UPDATE ON public.customer_tasks
    FOR EACH ROW 
    WHEN (NEW.customer_id IS NOT NULL)
    EXECUTE FUNCTION public.touch_customer_last_activity();


-- 4. RPC get_workspace_execution_dashboard()
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
BEGIN
    v_user_id := auth.uid();
    v_is_admin := public.is_admin_or_sub_admin(v_user_id);

    -- Tính toán Counters
    IF v_is_admin THEN
        -- Admin: Đếm toàn hệ thống
        SELECT COUNT(*) INTO v_lead_to_call_count 
        FROM public.customer_tasks 
        WHERE task_type = 'call' AND status = 'pending';

        SELECT COUNT(*) INTO v_follow_up_today_count 
        FROM public.customers 
        WHERE next_follow_up_at::date = CURRENT_DATE AND deleted_at IS NULL;

        SELECT COUNT(*) INTO v_check_in_today_count 
        FROM public.customer_tasks 
        WHERE task_type IN ('visit', 'check_in') AND status = 'pending';

        SELECT COUNT(*) INTO v_quotation_pending_count 
        FROM public.customer_tasks 
        WHERE (task_type IN ('quote_follow_up', 'quotation') OR title ILIKE '%báo giá%') AND status = 'pending';

        SELECT COUNT(*) INTO v_draft_order_count 
        FROM public.orders 
        WHERE status IN ('draft', 'pending');

        SELECT COUNT(*) INTO v_overdue_count 
        FROM public.customer_tasks 
        WHERE due_at < NOW() AND status = 'pending';

        -- Cộng thêm lịch calendar_events bị quá hạn (pending)
        v_overdue_count := v_overdue_count + (
            SELECT COUNT(*) FROM public.calendar_events 
            WHERE starts_at < NOW() AND status = 'pending'
        );

    ELSE
        -- Sale/Tele: Đếm theo phân quyền
        SELECT COUNT(*) INTO v_lead_to_call_count 
        FROM public.customer_tasks 
        WHERE task_type = 'call' AND status = 'pending' AND assigned_to = v_user_id;

        SELECT COUNT(*) INTO v_follow_up_today_count 
        FROM public.customers 
        WHERE next_follow_up_at::date = CURRENT_DATE AND deleted_at IS NULL AND owner_sale_id = v_user_id;

        SELECT COUNT(*) INTO v_check_in_today_count 
        FROM public.customer_tasks 
        WHERE task_type IN ('visit', 'check_in') AND status = 'pending' AND assigned_to = v_user_id;

        SELECT COUNT(*) INTO v_quotation_pending_count 
        FROM public.customer_tasks 
        WHERE (task_type IN ('quote_follow_up', 'quotation') OR title ILIKE '%báo giá%') AND status = 'pending' AND assigned_to = v_user_id;

        SELECT COUNT(*) INTO v_draft_order_count 
        FROM public.orders 
        WHERE status IN ('draft', 'pending') AND created_by = v_user_id;

        SELECT COUNT(*) INTO v_overdue_count 
        FROM public.customer_tasks 
        WHERE due_at < NOW() AND status = 'pending' AND assigned_to = v_user_id;

        v_overdue_count := v_overdue_count + (
            SELECT COUNT(*) FROM public.calendar_events 
            WHERE starts_at < NOW() AND status = 'pending' AND assigned_sale_id = v_user_id
        );
    END IF;

    -- Trả về JSONB structure chuẩn
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Làm mới schema cache
NOTIFY pgrst, 'reload schema';
