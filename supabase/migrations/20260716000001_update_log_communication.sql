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
    v_weight integer;
    v_quality text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Calculate weight/quality based on user requirements
    v_weight := 1;
    v_quality := 'low';
    
    IF p_platform = 'zalo' OR p_platform = 'facebook' THEN
        IF p_result = 'copied' THEN
            v_weight := 2;
            v_quality := 'low';
        ELSE
            v_weight := 3;
            v_quality := 'medium';
        END IF;
    ELSIF p_platform = 'email' THEN
        IF p_result = 'copied' THEN
            v_weight := 1;
            v_quality := 'low';
        ELSE
            v_weight := 2;
            v_quality := 'low';
        END IF;
    ELSE
        IF p_result = 'copied' THEN
            v_weight := 0;
            v_quality := 'system';
        ELSE
            v_weight := 1;
            v_quality := 'low';
        END IF;
    END IF;

    IF p_account_id IS NOT NULL THEN
        SELECT * INTO v_account FROM public.user_communication_accounts WHERE id = p_account_id;
        IF v_account IS NOT NULL THEN
            UPDATE public.user_communication_accounts 
            SET last_used_at = now() 
            WHERE id = p_account_id;
        END IF;
    END IF;

    UPDATE public.customers 
    SET updated_at = now() 
    WHERE id = p_customer_id;

    v_metadata := jsonb_build_object(
        'platform', p_platform,
        'account_id', p_account_id,
        'template_id', p_template_id,
        'result', p_result
    );

    INSERT INTO public.customer_interactions (
        customer_id, user_id, account_id, contact_channel_id, platform, 
        interaction_type, direction, result, template_id, template_title, 
        content_preview, metadata, interaction_weight, interaction_quality
    ) VALUES (
        p_customer_id, v_user_id, p_account_id, p_contact_channel_id, p_platform,
        p_interaction_type, 'outbound', p_result, p_template_id, p_template_title,
        p_content_preview, v_metadata, v_weight, v_quality
    ) RETURNING id INTO v_interaction_id;

    IF p_template_id IS NOT NULL THEN
        IF p_template_title IS NOT NULL THEN
            v_title := 'Đã mở ' || UPPER(p_platform) || ' + copy mẫu "' || p_template_title || '"';
        ELSE
            v_title := 'Đã mở ' || UPPER(p_platform) || ' + copy mẫu';
        END IF;
    ELSE
        v_title := 'Liên lạc qua ' || UPPER(p_platform);
    END IF;

    INSERT INTO public.customer_activities (
        customer_id,
        activity_type,
        title,
        content,
        created_by,
        metadata,
        interaction_weight,
        interaction_quality
    ) VALUES (
        p_customer_id,
        'communication_launch',
        v_title,
        CASE 
            WHEN v_account IS NOT NULL THEN 'Sale đã sử dụng tài khoản: ' || v_account.account_name 
            ELSE 'Sale đã sử dụng ứng dụng ' || UPPER(p_platform) 
        END,
        v_user_id,
        v_metadata,
        v_weight,
        v_quality
    );

    RETURN jsonb_build_object(
        'success', true, 
        'interaction_id', v_interaction_id,
        'weight', v_weight,
        'quality', v_quality
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
