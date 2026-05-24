-- ============================================================================
-- MIGRATION: Phase D - Interaction Tracking
-- ============================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.customer_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    account_id uuid REFERENCES public.user_communication_accounts(id),
    contact_channel_id uuid REFERENCES public.customer_contact_channels(id),
    platform text CHECK (platform in ('zalo','facebook','email','phone','tiktok')),
    interaction_type text CHECK (interaction_type in ('launch','copy_template','call','message','email','profile_open')),
    direction text DEFAULT 'outbound' CHECK (direction in ('outbound','inbound')),
    result text DEFAULT 'launched' CHECK (result in ('launched','copied','failed','completed')),
    template_id uuid REFERENCES public.message_templates(id),
    template_title text,
    content_preview text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS customer_interactions_customer_id_idx ON public.customer_interactions(customer_id);
CREATE INDEX IF NOT EXISTS customer_interactions_user_id_idx ON public.customer_interactions(user_id);
CREATE INDEX IF NOT EXISTS customer_interactions_platform_idx ON public.customer_interactions(platform);
CREATE INDEX IF NOT EXISTS customer_interactions_created_at_idx ON public.customer_interactions(created_at);
CREATE INDEX IF NOT EXISTS customer_interactions_account_id_idx ON public.customer_interactions(account_id);
CREATE INDEX IF NOT EXISTS customer_interactions_channel_id_idx ON public.customer_interactions(contact_channel_id);

-- RLS
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin view all interactions" ON public.customer_interactions;
CREATE POLICY "Admin view all interactions" 
ON public.customer_interactions FOR SELECT 
TO authenticated 
USING (
    public.is_admin_or_sub_admin(auth.uid()) 
    OR user_id = auth.uid() 
    OR public.can_view_customer(customer_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own interactions" ON public.customer_interactions;
CREATE POLICY "Users can insert own interactions" 
ON public.customer_interactions FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

-- (No UPDATE/DELETE policies for Sales, so only Admin could theoretically delete, but we just leave it append-only for sales)

-- 2. Update log_communication_interaction
DROP FUNCTION IF EXISTS public.log_communication_interaction(uuid, text, uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.log_communication_interaction(uuid, text, uuid, text, uuid, text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.log_communication_interaction(
    p_customer_id uuid,
    p_platform text,
    p_account_id uuid DEFAULT NULL,
    p_interaction_type text DEFAULT 'launch',
    p_template_id uuid DEFAULT NULL,
    p_template_title text DEFAULT NULL,
    p_contact_channel_id uuid DEFAULT NULL,
    p_result text DEFAULT 'launched',
    p_content_preview text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_account record;
    v_title text;
    v_metadata jsonb;
    v_interaction_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Update account last used
    IF p_account_id IS NOT NULL THEN
        SELECT * INTO v_account FROM public.user_communication_accounts WHERE id = p_account_id;
        IF v_account IS NOT NULL THEN
            UPDATE public.user_communication_accounts 
            SET last_used_at = now() 
            WHERE id = p_account_id;
        END IF;
    END IF;

    -- Update channel last contacted (if we had the column, skip if not implemented. We will assume not implemented unless requested)
    -- Update customer last activity
    UPDATE public.customers 
    SET updated_at = now() 
    WHERE id = p_customer_id;

    -- Insert interaction
    v_metadata := jsonb_build_object(
        'platform', p_platform,
        'account_id', p_account_id,
        'template_id', p_template_id,
        'result', p_result
    );

    INSERT INTO public.customer_interactions (
        customer_id, user_id, account_id, contact_channel_id, platform, 
        interaction_type, direction, result, template_id, template_title, 
        content_preview, metadata
    ) VALUES (
        p_customer_id, v_user_id, p_account_id, p_contact_channel_id, p_platform,
        p_interaction_type, 'outbound', p_result, p_template_id, p_template_title,
        p_content_preview, v_metadata
    ) RETURNING id INTO v_interaction_id;

    -- Generate title for activity backward compatibility
    IF p_template_id IS NOT NULL THEN
        IF p_template_title IS NOT NULL THEN
            v_title := 'Đã mở ' || UPPER(p_platform) || ' + copy mẫu "' || p_template_title || '"';
        ELSE
            v_title := 'Đã mở ' || UPPER(p_platform) || ' + copy mẫu';
        END IF;
    ELSE
        v_title := 'Liên lạc qua ' || UPPER(p_platform);
    END IF;

    -- Insert backward compatibility activity
    INSERT INTO public.customer_activities (
        customer_id,
        activity_type,
        title,
        content,
        created_by,
        metadata
    ) VALUES (
        p_customer_id,
        'communication_launch',
        v_title,
        CASE 
            WHEN v_account IS NOT NULL THEN 'Sale đã sử dụng tài khoản: ' || v_account.account_name 
            ELSE 'Sale đã sử dụng ứng dụng ' || UPPER(p_platform) 
        END,
        v_user_id,
        v_metadata
    );

    RETURN jsonb_build_object('success', true, 'interaction_id', v_interaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Update get_customer_timeline to UNION interactions and filter activities
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
        -- 1. Activities (exclude old communication activities since they are handled by interactions now, or just exclude 'communication_launch', 'outbound_message', 'outbound_call')
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
            NULL as status,
            a.metadata
        FROM public.customer_activities a
        LEFT JOIN public.profiles p ON p.id = a.created_by
        WHERE a.customer_id = p_customer_id
          AND a.activity_type NOT IN ('outbound_message', 'outbound_call', 'communication_launch', 'template_copied')

        UNION ALL

        -- 1b. Interactions
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

        -- 2. Calendar Events
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

        -- 3. Tasks
        SELECT 
            t.id::text as id,
            'task' as source,
            t.task_type as type,
            t.title as title,
            t.description as description,
            COALESCE(t.completed_at, t.created_at) as occurred_at,
            t.created_by::text as created_by,
            p.display_name as created_by_name,
            t.customer_id::text as customer_id,
            t.id::text as related_id,
            t.status as status,
            jsonb_build_object('due_at', t.due_at, 'assigned_to', t.assigned_to) as metadata
        FROM public.customer_tasks t
        LEFT JOIN public.profiles p ON p.id = t.created_by
        WHERE t.customer_id = p_customer_id

        UNION ALL

        -- 4. Orders
        SELECT 
            o.id::text as id,
            'order' as source,
            'order_created' as type,
            'Tạo đơn hàng ' || COALESCE(o.order_no, '') as title,
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

        -- 5. Channels
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


-- 4. Create summary RPC
CREATE OR REPLACE FUNCTION public.get_customer_interaction_summary(p_customer_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_has_access boolean;
    v_total int;
    v_last_interaction timestamptz;
    v_last_platform text;
    v_most_used_platform text;
    v_last_template text;
    v_platform_counts jsonb;
BEGIN
    v_user_id := auth.uid();
    
    IF public.is_admin_or_sub_admin(v_user_id) THEN
        v_has_access := true;
    ELSE
        v_has_access := public.can_view_customer(p_customer_id, v_user_id);
    END IF;

    IF NOT v_has_access THEN
        RETURN NULL;
    END IF;

    SELECT count(*) INTO v_total FROM public.customer_interactions WHERE customer_id = p_customer_id;
    
    IF v_total = 0 THEN
        RETURN jsonb_build_object('total_interactions', 0);
    END IF;

    SELECT created_at, platform INTO v_last_interaction, v_last_platform 
    FROM public.customer_interactions 
    WHERE customer_id = p_customer_id 
    ORDER BY created_at DESC LIMIT 1;

    SELECT template_title INTO v_last_template 
    FROM public.customer_interactions 
    WHERE customer_id = p_customer_id AND template_id IS NOT NULL 
    ORDER BY created_at DESC LIMIT 1;

    SELECT platform INTO v_most_used_platform
    FROM public.customer_interactions
    WHERE customer_id = p_customer_id
    GROUP BY platform
    ORDER BY count(*) DESC LIMIT 1;

    SELECT jsonb_object_agg(platform, count) INTO v_platform_counts
    FROM (
        SELECT platform, count(*) as count
        FROM public.customer_interactions
        WHERE customer_id = p_customer_id
        GROUP BY platform
    ) t;

    RETURN jsonb_build_object(
        'total_interactions', v_total,
        'last_interaction_at', v_last_interaction,
        'last_platform', v_last_platform,
        'most_used_platform', v_most_used_platform,
        'last_template_used', v_last_template,
        'platform_counts', v_platform_counts
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Làm mới schema cache
NOTIFY pgrst, 'reload schema';
