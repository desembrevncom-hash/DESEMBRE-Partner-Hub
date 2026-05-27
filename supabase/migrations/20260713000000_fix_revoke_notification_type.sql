-- Fix notification type in revoke_customer_assignment to bypass check constraint

CREATE OR REPLACE FUNCTION public.revoke_customer_assignment(
    p_customer_ids uuid[],
    p_reason text
) RETURNS jsonb AS $$
DECLARE
    v_admin_id uuid;
    v_is_manager boolean;
    v_customer_id uuid;
    v_admin_email text := 'Quản trị viên';
    v_old_sale_id uuid;
    v_old_tele_id uuid;
BEGIN
    v_admin_id := auth.uid();
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_is_manager := public.is_admin_or_sub_admin(v_admin_id);
    IF NOT v_is_manager THEN
        RAISE EXCEPTION 'Permission denied. Only Admin or SubAdmin can revoke assignment.';
    END IF;

    -- Lấy thông tin email quản lý
    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

    -- Duyệt từng khách hàng
    FOREACH v_customer_id IN ARRAY p_customer_ids
    LOOP
        -- Lấy thông tin sale/tele cũ trước khi revoke
        SELECT owner_sale_id, owner_tele_id INTO v_old_sale_id, v_old_tele_id 
        FROM public.customers WHERE id = v_customer_id;
        
        -- 1. Cập nhật bảng customers
        UPDATE public.customers
        SET owner_sale_id = NULL,
            owner_tele_id = NULL,
            lifecycle_stage = CASE 
                WHEN lifecycle_stage = 'assigned' THEN 'new_lead' 
                ELSE lifecycle_stage 
            END,
            updated_by = v_admin_id,
            updated_at = now()
        WHERE id = v_customer_id;

        -- 2. Ghi log hoạt động
        INSERT INTO public.customer_activities (
            customer_id,
            created_by,
            activity_type,
            title,
            content
        ) VALUES (
            v_customer_id,
            v_admin_id,
            'handoff',
            'Thu hồi quyền phụ trách',
            'Đã thu hồi toàn bộ Sale và Tele.' || CHR(10) || 
            'Người thực hiện: ' || v_admin_email || CHR(10) ||
            'Lý do: ' || p_reason
        );
        
        -- 3. Tạo Notification thu hồi cho Sale cũ (Dùng loại 'system' thay vì 'lead_revoked' để khớp constraint)
        IF v_old_sale_id IS NOT NULL AND v_old_sale_id != v_admin_id THEN
            PERFORM public.create_notification_safe(
                p_recipient_user_id := v_old_sale_id,
                p_notification_type := 'system',
                p_title := '🚨 Báo động: Thu hồi khách hàng',
                p_message := 'Quản lý ' || v_admin_email || ' đã thu hồi quyền phụ trách của bạn đối với khách hàng này. Lý do: ' || p_reason,
                p_customer_id := v_customer_id,
                p_actor_user_id := v_admin_id,
                p_deep_link := '/customers?id=' || v_customer_id,
                p_priority := 'high'
            );
        END IF;
        
        -- 4. Tạo Notification thu hồi cho Tele cũ (Dùng loại 'system')
        IF v_old_tele_id IS NOT NULL AND v_old_tele_id != v_admin_id AND v_old_tele_id != v_old_sale_id THEN
            PERFORM public.create_notification_safe(
                p_recipient_user_id := v_old_tele_id,
                p_notification_type := 'system',
                p_title := '🚨 Báo động: Thu hồi khách hàng',
                p_message := 'Quản lý ' || v_admin_email || ' đã thu hồi quyền hỗ trợ của bạn đối với khách hàng này. Lý do: ' || p_reason,
                p_customer_id := v_customer_id,
                p_actor_user_id := v_admin_id,
                p_deep_link := '/customers?id=' || v_customer_id,
                p_priority := 'high'
            );
        END IF;

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'revoked_count', array_length(p_customer_ids, 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
