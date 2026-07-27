-- Phase 6H.2C: Admin Email Marketing Consent Capture

-- 1. Ensure customer_consents table has source and note columns
ALTER TABLE public.customer_consents 
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS note text;

-- 2. Create the RPC function
CREATE OR REPLACE FUNCTION public.admin_record_email_marketing_consent(
    p_customer_id UUID,
    p_source TEXT,
    p_note TEXT
) RETURNS JSON 
SET search_path = public, auth
AS $$
DECLARE
    v_customer RECORD;
    v_is_suppressed BOOLEAN := false;
BEGIN
    -- Auth check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text IN ('admin', 'sub_admin')
    ) THEN
        RAISE EXCEPTION 'Forbidden: Only admin/sub_admin can perform this action';
    END IF;

    -- Validate input
    IF TRIM(p_source) = '' OR p_source IS NULL THEN
        RAISE EXCEPTION 'Source is required';
    END IF;

    IF TRIM(p_note) = '' OR p_note IS NULL THEN
        RAISE EXCEPTION 'Note is required';
    END IF;

    -- Get customer
    SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    IF v_customer.email IS NULL OR v_customer.email = '' OR v_customer.email NOT LIKE '%@%' THEN
        RAISE EXCEPTION 'Customer does not have a valid email';
    END IF;

    -- Check suppression
    SELECT EXISTS (
        SELECT 1 FROM public.marketing_suppression_list 
        WHERE normalized_contact_value = LOWER(TRIM(v_customer.email)) 
          AND is_active = true
          AND reason IN ('unsubscribe', 'complaint', 'bounce') -- Block if they unsubscribed or complained
    ) INTO v_is_suppressed;

    IF v_is_suppressed THEN
        RAISE EXCEPTION 'Cannot record consent: Customer is actively suppressed (unsubscribe/complaint). Manual override required.';
    END IF;

    -- Safe Upsert without ON CONFLICT (in case no unique constraint on customer_id, channel)
    UPDATE public.customer_consents
    SET 
        is_opt_in = true,
        opt_in_at = now(),
        opt_out_at = NULL,
        source = p_source,
        note = p_note,
        updated_at = now()
    WHERE customer_id = p_customer_id AND channel = 'email';

    IF NOT FOUND THEN
        INSERT INTO public.customer_consents (
            customer_id, 
            channel, 
            is_opt_in, 
            opt_in_at, 
            opt_out_at, 
            source, 
            note
        )
        VALUES (
            p_customer_id,
            'email',
            true,
            now(),
            NULL,
            p_source,
            p_note
        );
    END IF;

    -- Sync legacy flag if column exists
    -- Checking if marketing_opt_in column exists in customers table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'marketing_opt_in'
    ) THEN
        EXECUTE 'UPDATE public.customers SET marketing_opt_in = true WHERE id = $1' USING p_customer_id;
    END IF;

    -- Notify PostgREST to reload schema cache
    NOTIFY pgrst, 'reload schema';

    RETURN json_build_object(
        'success', true,
        'customer_id', p_customer_id,
        'message', 'Email marketing consent successfully recorded'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_record_email_marketing_consent(UUID, TEXT, TEXT) TO authenticated;
