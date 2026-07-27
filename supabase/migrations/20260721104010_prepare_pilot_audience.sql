-- 6H.2B Prepare Limited Pilot Audience RPCs

-- 1. Helper RPC to check eligibility of a single customer for the UI
CREATE OR REPLACE FUNCTION public.admin_check_pilot_eligibility(
    p_campaign_id UUID,
    p_customer_id UUID
) RETURNS JSON 
SET search_path = public, auth
AS $$
DECLARE
    v_campaign RECORD;
    v_customer RECORD;
    v_has_consent BOOLEAN := false;
    v_has_suppression BOOLEAN := false;
    v_has_duplicate BOOLEAN := false;
    v_is_active BOOLEAN := false;
    v_has_valid_email BOOLEAN := false;
BEGIN
    -- Auth Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text IN ('admin', 'sub_admin')
    ) THEN
        RAISE EXCEPTION 'Forbidden: Only admin/sub_admin can perform this action';
    END IF;

    -- Get Campaign
    SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign not found';
    END IF;

    -- Get Customer
    SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    -- 1. Determine active status safely
    v_is_active := true;
    
    -- If is_active exists, use it
    IF (to_jsonb(v_customer) ? 'is_active') THEN
        v_is_active := (to_jsonb(v_customer)->>'is_active')::boolean;
    END IF;

    -- If status exists, block only explicitly inactive states
    IF v_is_active AND (to_jsonb(v_customer) ? 'status') THEN
        IF (to_jsonb(v_customer)->>'status') IN ('inactive', 'blocked', 'archived', 'deleted', 'disabled') THEN
            v_is_active := false;
        END IF;
    END IF;

    -- 2. Check Valid Email
    IF v_customer.email IS NOT NULL AND v_customer.email != '' AND v_customer.email LIKE '%@%' THEN
        v_has_valid_email := true;
    END IF;

    -- 2. Check Consent (Source of Truth)
    -- Must have an explicit opt-in record in customer_consents for the matched channel (assumed email/zalo based on campaign)
    SELECT EXISTS (
        SELECT 1 FROM public.customer_consents 
        WHERE customer_id = p_customer_id 
          AND (
            (COALESCE(v_campaign.channel, 'email') LIKE '%email%' AND channel LIKE '%email%') OR
            (COALESCE(v_campaign.channel, 'email') LIKE '%zalo%' AND channel LIKE '%zalo%')
          )
          AND is_opt_in = true 
          AND opt_out_at IS NULL
    ) INTO v_has_consent;

    -- 3. Check Suppression
    IF v_has_valid_email THEN
        SELECT EXISTS (
            SELECT 1 FROM public.marketing_suppression_list 
            WHERE normalized_contact_value = LOWER(TRIM(v_customer.email)) 
              AND is_active = true
        ) INTO v_has_suppression;
    END IF;

    -- 4. Check Duplicate
    SELECT EXISTS (
        SELECT 1 FROM public.marketing_delivery_logs 
        WHERE campaign_id = p_campaign_id 
          AND customer_id = p_customer_id
          AND status IN ('sent', 'queued', 'provider_sent', 'delivered')
    ) INTO v_has_duplicate;

    RETURN json_build_object(
        'is_active', v_is_active,
        'has_valid_email', v_has_valid_email,
        'has_consent', v_has_consent,
        'has_suppression', v_has_suppression,
        'has_duplicate', v_has_duplicate
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Main RPC to prepare audience
CREATE OR REPLACE FUNCTION public.admin_prepare_limited_pilot_audience(
    p_campaign_id UUID,
    p_customer_ids UUID[]
) RETURNS JSON 
SET search_path = public, auth
AS $$
DECLARE
    v_campaign RECORD;
    v_segment_id UUID;
    v_customer_id UUID;
    v_eligibility JSON;
    v_success_count INT := 0;
BEGIN
    -- Auth Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text IN ('admin', 'sub_admin')
    ) THEN
        RAISE EXCEPTION 'Forbidden: Only admin/sub_admin can perform this action';
    END IF;

    -- Array bounds check
    IF array_length(p_customer_ids, 1) < 5 OR array_length(p_customer_ids, 1) > 10 THEN
        RAISE EXCEPTION 'Audience size must be between 5 and 10 for limited pilot';
    END IF;

    -- Campaign Check
    SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign not found';
    END IF;

    IF v_campaign.approval_status != 'approved' THEN
        RAISE EXCEPTION 'Campaign must be approved';
    END IF;

    IF v_campaign.final_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Campaign must be final confirmed';
    END IF;

    -- Loop to validate ALL chosen customers
    FOREACH v_customer_id IN ARRAY p_customer_ids
    LOOP
        v_eligibility := public.admin_check_pilot_eligibility(p_campaign_id, v_customer_id);
        
        IF (v_eligibility->>'is_active')::boolean = false THEN
            RAISE EXCEPTION 'Customer % is inactive', v_customer_id;
        END IF;
        
        IF (v_eligibility->>'has_valid_email')::boolean = false THEN
            RAISE EXCEPTION 'Customer % has invalid email', v_customer_id;
        END IF;

        IF (v_eligibility->>'has_consent')::boolean = false THEN
            RAISE EXCEPTION 'Customer % lacks explicit consent proof', v_customer_id;
        END IF;

        IF (v_eligibility->>'has_suppression')::boolean = true THEN
            RAISE EXCEPTION 'Customer % is in suppression list', v_customer_id;
        END IF;

        IF (v_eligibility->>'has_duplicate')::boolean = true THEN
            RAISE EXCEPTION 'Customer % already has delivery log for this campaign', v_customer_id;
        END IF;
    END LOOP;

    -- SỬA: Map đúng cột segment_type VÀ thỏa mãn 2 FK khác nhau bằng cùng 1 ID
    v_segment_id := gen_random_uuid();

    -- Bảng này để thỏa mãn FK của customer_segments_map và để Edge Function đọc
    INSERT INTO public.customer_segments (id, name, description, segment_type)
    VALUES (
        v_segment_id,
        'Pilot Audience for Campaign ' || p_campaign_id,
        'Auto-generated static pilot segment',
        'static'
    );

    -- Bảng này để thỏa mãn FK của marketing_campaigns.segment_id
    INSERT INTO public.marketing_segments (id, name, description, filter_rules_json, visibility, created_by)
    VALUES (
        v_segment_id,
        'Pilot Audience for Campaign ' || p_campaign_id,
        'Auto-generated static pilot segment',
        '{}'::jsonb,
        'private',
        auth.uid()
    );

    FOREACH v_customer_id IN ARRAY p_customer_ids
    LOOP
        INSERT INTO public.customer_segments_map (segment_id, customer_id)
        VALUES (v_segment_id, v_customer_id);
        v_success_count := v_success_count + 1;
    END LOOP;

    -- SỬA: Map đúng cột audience_count
    UPDATE public.marketing_campaigns 
    SET segment_id = v_segment_id, audience_count = v_success_count, updated_at = now()
    WHERE id = p_campaign_id;

    RETURN json_build_object(
        'success', true,
        'prepared_count', v_success_count,
        'segment_id', v_segment_id,
        'message', 'Limited pilot audience prepared successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
