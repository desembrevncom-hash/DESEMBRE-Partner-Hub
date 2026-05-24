-- ============================================================================
-- FIX 3: Customer Timeline Error (t.description does not exist)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_customer_timeline(p_customer_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
    v_has_access boolean;
    v_timeline jsonb := '[]'::jsonb;
BEGIN
    v_user_id := auth.uid();
    v_is_admin := public.is_admin_or_sub_admin(v_user_id);
    
    IF v_is_admin THEN
        v_has_access := true;
    ELSE
        v_has_access := public.can_view_customer(p_customer_id, v_user_id);
    END IF;

    IF NOT v_has_access THEN
        RETURN '[]'::jsonb;
    END IF;

    WITH timeline_data AS (
        SELECT 
            a.id::text as id,
            'activity' as source,
            a.activity_type as type,
            a.title as title,
            a.content as description,
            a.created_at as occurred_at,
            a.created_by::text as created_by,
            p.display_name as created_by_name,
            a.customer_id::text as customer_id,
            a.id::text as related_id,
            NULL::text as status,
            a.metadata
        FROM public.customer_activities a
        LEFT JOIN public.profiles p ON p.id = a.created_by
        WHERE a.customer_id = p_customer_id
          AND a.activity_type NOT IN ('outbound_message', 'outbound_call', 'communication_launch', 'template_copied')

        UNION ALL

        SELECT 
            i.id::text as id,
            'interaction' as source,
            i.interaction_type as type,
            CASE 
                WHEN i.template_id IS NOT NULL THEN p.display_name || ' copy mẫu "' || COALESCE(i.template_title, '') || '"'
                ELSE p.display_name || ' mở ' || UPPER(i.platform) || COALESCE(' bằng ' || uca.account_name, '')
            END as title,
            i.content_preview as description,
            i.created_at as occurred_at,
            i.user_id::text as created_by,
            p.display_name as created_by_name,
            i.customer_id::text as customer_id,
            i.id::text as related_id,
            i.result as status,
            i.metadata
        FROM public.customer_interactions i
        LEFT JOIN public.profiles p ON p.id = i.user_id
        LEFT JOIN public.user_communication_accounts uca ON uca.id = i.account_id
        WHERE i.customer_id = p_customer_id
          AND (v_is_admin OR i.user_id = v_user_id OR public.can_view_customer(i.customer_id, v_user_id))

        UNION ALL

        SELECT 
            e.id::text as id,
            'calendar' as source,
            e.event_type as type,
            e.title as title,
            e.description as description,
            e.starts_at as occurred_at,
            e.created_by::text as created_by,
            p.display_name as created_by_name,
            e.customer_id::text as customer_id,
            e.id::text as related_id,
            e.status as status,
            jsonb_build_object('visibility', e.visibility, 'ends_at', e.ends_at) as metadata
        FROM public.calendar_events e
        LEFT JOIN public.profiles p ON p.id = e.created_by
        WHERE e.customer_id = p_customer_id

        UNION ALL

        -- ĐÃ SỬA: Dùng assigned_by thay vì created_by, dùng note thay vì description
        SELECT 
            t.id::text as id,
            'task' as source,
            t.task_type as type,
            t.title as title,
            t.note as description,
            COALESCE(t.completed_at, t.created_at) as occurred_at,
            t.assigned_by::text as created_by,
            p.display_name as created_by_name,
            t.customer_id::text as customer_id,
            t.id::text as related_id,
            t.status as status,
            jsonb_build_object('due_at', t.due_at, 'assigned_to', t.assigned_to) as metadata
        FROM public.customer_tasks t
        LEFT JOIN public.profiles p ON p.id = t.assigned_by
        WHERE t.customer_id = p_customer_id

        UNION ALL

        SELECT 
            o.id::text as id,
            'order' as source,
            'order_created' as type,
            'Tạo đơn hàng ' || COALESCE(o.order_no::text, '') as title,
            'Tổng giá trị: ' || COALESCE(o.total::text, '0') as description,
            o.created_at as occurred_at,
            o.sale_user_id::text as created_by,
            p.display_name as created_by_name,
            o.customer_id::text as customer_id,
            o.id::text as related_id,
            o.status as status,
            jsonb_build_object('total', o.total) as metadata
        FROM public.orders o
        LEFT JOIN public.profiles p ON p.id = o.sale_user_id
        WHERE o.customer_id = p_customer_id

        UNION ALL

        SELECT 
            ch.id::text as id,
            'channel' as source,
            'channel_added' as type,
            'Thêm kênh liên hệ' as title,
            ch.channel_type || ': ' || COALESCE(ch.channel_value, '') as description,
            ch.created_at as occurred_at,
            ch.created_by::text as created_by,
            p.display_name as created_by_name,
            ch.customer_id::text as customer_id,
            ch.id::text as related_id,
            ch.resolve_status as status,
            jsonb_build_object('channel_type', ch.channel_type, 'scope', ch.scope, 'is_primary', ch.is_primary) as metadata
        FROM public.customer_contact_channels ch
        LEFT JOIN public.profiles p ON p.id = ch.created_by
        WHERE ch.customer_id = p_customer_id
          AND (
            v_is_admin 
            OR ch.scope = 'official' 
            OR (ch.scope = 'private' AND ch.created_by = v_user_id)
            OR (ch.scope = 'private' AND ch.owner_user_id = v_user_id)
          )
    )
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_timeline
    FROM (
        SELECT * FROM timeline_data 
        ORDER BY occurred_at DESC
        LIMIT 100
    ) t;

    RETURN v_timeline;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
