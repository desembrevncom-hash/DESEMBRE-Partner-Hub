-- Auto revert lifecycle_stage to 'new_lead' when revoking an 'assigned' customer

CREATE OR REPLACE FUNCTION public.revoke_customer_assignment(
    p_customer_ids uuid[],
    p_reason text
) RETURNS jsonb AS $$
DECLARE
    v_admin_id uuid;
    v_is_manager boolean;
    v_customer_id uuid;
    v_admin_email text := 'Quản trị viên';
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

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'revoked_count', array_length(p_customer_ids, 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
