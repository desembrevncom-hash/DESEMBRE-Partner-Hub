-- Fix column name in customer_tasks insert

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
        -- 1. Cập nhật bảng customers, tự động chuyển sang assigned nếu đang là lead mới
        UPDATE public.customers
        SET owner_sale_id = CASE WHEN p_update_sale THEN p_sale_id ELSE owner_sale_id END,
            owner_tele_id = CASE WHEN p_update_tele THEN p_tele_id ELSE owner_tele_id END,
            lifecycle_stage = CASE 
                WHEN ((p_update_sale AND p_sale_id IS NOT NULL) OR (p_update_tele AND p_tele_id IS NOT NULL)) 
                     AND (lifecycle_stage IS NULL OR lifecycle_stage IN ('new_lead', 'lead')) 
                THEN 'assigned' 
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
            'Cập nhật phân công khách hàng',
            'Phân công mới:' || CHR(10) || 
            CASE WHEN p_update_sale THEN '- Sale: ' || v_sale_email || CHR(10) ELSE '' END || 
            CASE WHEN p_update_tele THEN '- Tele: ' || v_tele_email || CHR(10) ELSE '' END || 
            'Người thực hiện: ' || v_admin_email || CHR(10) ||
            'Lý do: ' || p_reason
        );

        -- 3. Tạo Task gọi điện (sử dụng assigned_by thay vì created_by)
        IF p_update_sale AND p_sale_id IS NOT NULL THEN
            INSERT INTO public.customer_tasks (
                customer_id,
                assigned_to,
                title,
                task_type,
                priority,
                due_at,
                status,
                assigned_by
            ) VALUES (
                v_customer_id,
                p_sale_id,
                'Gọi điện tư vấn khách hàng mới',
                'call',
                'high',
                now() + interval '24 hours',
                'pending',
                v_admin_id
            );
        END IF;

        IF p_update_tele AND p_tele_id IS NOT NULL THEN
            INSERT INTO public.customer_tasks (
                customer_id,
                assigned_to,
                title,
                task_type,
                priority,
                due_at,
                status,
                assigned_by
            ) VALUES (
                v_customer_id,
                p_tele_id,
                'Gọi điện hỗ trợ khách hàng mới',
                'call',
                'high',
                now() + interval '24 hours',
                'pending',
                v_admin_id
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
