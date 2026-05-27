-- Migration: Create log_quick_call_result RPC
-- Phase F5: Quick Interaction Logging

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
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if customer exists and user has access
    SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id;
    IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    v_is_admin := public.is_admin_or_sub_admin(v_user_id);
    v_has_access := v_is_admin OR v_customer.owner_sale_id = v_user_id OR v_customer.owner_tele_id = v_user_id OR v_customer.user_id = v_user_id;
    
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permission denied. You do not have access to this customer.';
    END IF;

    -- Map result type to label
    v_result_label := CASE p_result_type
        WHEN 'no_answer' THEN 'Không nghe máy'
        WHEN 'interested' THEN 'Quan tâm'
        WHEN 'call_back' THEN 'Hẹn gọi lại'
        WHEN 'sent_quote' THEN 'Đã gửi báo giá'
        WHEN 'wrong_number' THEN 'Sai số'
        WHEN 'unreachable' THEN 'Không liên hệ được'
        ELSE p_result_type
    END;

    -- 1. Insert customer_interactions
    INSERT INTO public.customer_interactions (
        customer_id,
        user_id,
        interaction_type,
        channel,
        content
    ) VALUES (
        p_customer_id,
        v_user_id,
        'outbound',
        'phone',
        'Kết quả gọi: ' || v_result_label || CHR(10) || COALESCE(p_note, '')
    );

    -- 2. Insert customer_activities
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
        content
    ) VALUES (
        p_customer_id,
        v_user_id,
        'status_change',
        'Gọi điện chăm sóc',
        v_activity_content
    );

    -- 3. Update customers table (last_activity_at, last_contacted_at, next_follow_up_at)
    UPDATE public.customers
    SET 
        last_activity_at = NOW(),
        last_contacted_at = NOW(),
        next_follow_up_at = COALESCE(p_next_follow_up_at, next_follow_up_at),
        ownership_status = CASE WHEN p_result_type = 'wrong_number' THEN 'inactive' ELSE ownership_status END,
        updated_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_customer_id;

    -- 4. Auto create follow-up task if next_follow_up_at is provided
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
            v_user_id, -- Auto assign to the caller
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
        'customer_id', p_customer_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
