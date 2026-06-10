-- Migration: Manual Facebook Identity Resolution RPC

-- 1. Add missing columns to facebook_identity_resolution_jobs
ALTER TABLE public.facebook_identity_resolution_jobs
ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS resolution_note text;

-- 2. Create the RPC for manual resolution
DROP FUNCTION IF EXISTS public.resolve_facebook_identity_manual_review(uuid, text, public.fb_resolution_job_status, text);

CREATE OR REPLACE FUNCTION public.resolve_facebook_identity_manual_review(
    p_job_id uuid,
    p_numeric_uid text DEFAULT NULL,
    p_status public.fb_resolution_job_status DEFAULT 'resolved',
    p_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_customer_id uuid;
    v_raw_url text;
    v_social_profile_id uuid;
BEGIN
    -- Authorization check: Must be Admin or Sub-admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Must be Admin or Sub-admin.';
    END IF;

    -- Fetch the job details
    SELECT customer_id, raw_url INTO v_customer_id, v_raw_url
    FROM public.facebook_identity_resolution_jobs
    WHERE id = p_job_id AND status = 'manual_review_required';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found or not in manual_review_required status.';
    END IF;

    -- Validate status input against allowed values
    IF p_status NOT IN ('resolved', 'failed') THEN
        RAISE EXCEPTION 'Invalid status. Must be resolved or failed.';
    END IF;

    -- Try to find the matching social profile
    -- 1. Exact raw_url match
    SELECT id INTO v_social_profile_id
    FROM public.customer_social_profiles
    WHERE customer_id = v_customer_id AND platform = 'facebook' AND raw_url = v_raw_url
    ORDER BY created_at DESC LIMIT 1;

    -- 2. Fallback: Any facebook profile for this customer if raw_url doesn't match perfectly
    IF v_social_profile_id IS NULL THEN
        SELECT id INTO v_social_profile_id
        FROM public.customer_social_profiles
        WHERE customer_id = v_customer_id AND platform = 'facebook'
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    IF v_social_profile_id IS NULL THEN
        RAISE EXCEPTION 'No related customer_social_profiles found for this job.';
    END IF;

    IF p_status = 'resolved' THEN
        IF p_numeric_uid IS NULL OR p_numeric_uid !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'numeric_uid is required and must be strictly numeric for resolved status.';
        END IF;

        -- Update customer_social_profiles
        UPDATE public.customer_social_profiles
        SET facebook_uid = p_numeric_uid,
            resolver_status = 'resolved',
            resolver_method = 'manual_admin',
            confidence_score = 90,
            updated_at = NOW()
        WHERE id = v_social_profile_id;

    ELSIF p_status = 'failed' THEN
        -- Update customer_social_profiles
        UPDATE public.customer_social_profiles
        SET resolver_status = 'failed',
            resolver_method = 'manual_admin',
            updated_at = NOW()
        WHERE id = v_social_profile_id;
    END IF;

    -- Update the job status
    UPDATE public.facebook_identity_resolution_jobs
    SET status = p_status,
        processed_by = auth.uid(),
        processed_at = NOW(),
        resolution_note = p_note,
        updated_at = NOW()
    WHERE id = p_job_id;

    RETURN TRUE;
END;
$$;
