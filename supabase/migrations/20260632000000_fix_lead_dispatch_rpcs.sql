-- ============================================================================
-- MIGRATION: Phase F3 - Fix Lead Dispatch RPCs
-- ============================================================================

DROP FUNCTION IF EXISTS public.bulk_assign_customers;

CREATE OR REPLACE FUNCTION public.bulk_assign_customers(
    p_customer_ids uuid[],
    p_sale_id uuid,
    p_update_sale boolean,
    p_tele_id uuid,
    p_update_tele boolean,
    p_reason text
) RETURNS jsonb AS $$
DECLARE
    v_admin_id uuid;
    v_is_manager boolean;
    v_customer_id uuid;
    v_sale_email text := 'Không phân công';
    v_tele_email text := 'Không phân công';
    v_admin_email text := 'Quản trị viên';
BEGIN
    v_admin_id := auth.uid();
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_is_manager := public.is_admin_or_sub_admin(v_admin_id);
    IF NOT v_is_manager THEN
        RAISE EXCEPTION 'Permission denied. Only Admin or SubAdmin can bulk assign.';
    END IF;

    -- Lấy thông tin email
    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;
    IF p_update_sale AND p_sale_id IS NOT NULL THEN
        SELECT email INTO v_sale_email FROM auth.users WHERE id = p_sale_id;
    END IF;
    IF p_update_tele AND p_tele_id IS NOT NULL THEN
        SELECT email INTO v_tele_email FROM auth.users WHERE id = p_tele_id;
    END IF;

    -- Duyệt từng khách hàng
    FOREACH v_customer_id IN ARRAY p_customer_ids
    LOOP
        -- 1. Cập nhật bảng customers
        UPDATE public.customers
        SET owner_sale_id = CASE WHEN p_update_sale THEN p_sale_id ELSE owner_sale_id END,
            owner_tele_id = CASE WHEN p_update_tele THEN p_tele_id ELSE owner_tele_id END,
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
            'assignment_changed',
            'Cập nhật phân công khách hàng',
            'Phân công mới:' || CHR(10) || 
            CASE WHEN p_update_sale THEN '- Sale: ' || v_sale_email || CHR(10) ELSE '' END || 
            CASE WHEN p_update_tele THEN '- Tele: ' || v_tele_email || CHR(10) ELSE '' END || 
            'Người thực hiện: ' || v_admin_email || CHR(10) ||
            'Lý do: ' || p_reason
        );

        -- 3. Tạo Notification cho Sale/Tele được gán
        IF p_update_sale AND p_sale_id IS NOT NULL AND p_sale_id != v_admin_id THEN
            PERFORM public.create_notification_safe(
                p_sale_id,
                'lead_assigned',
                'Bạn được phân công khách hàng mới',
                'Quản lý ' || v_admin_email || ' đã phân công bạn làm Sale phụ trách cho khách hàng này. Lý do: ' || p_reason,
                v_customer_id,
                v_admin_id,
                '/customers?id=' || v_customer_id
            );
        END IF;

        IF p_update_tele AND p_tele_id IS NOT NULL AND p_tele_id != v_admin_id AND p_tele_id != p_sale_id THEN
            PERFORM public.create_notification_safe(
                p_tele_id,
                'lead_assigned',
                'Bạn được phân công hỗ trợ khách hàng',
                'Quản lý ' || v_admin_email || ' đã phân công bạn làm Tele hỗ trợ cho khách hàng này. Lý do: ' || p_reason,
                v_customer_id,
                v_admin_id,
                '/customers?id=' || v_customer_id
            );
        END IF;

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'assigned_count', array_length(p_customer_ids, 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
