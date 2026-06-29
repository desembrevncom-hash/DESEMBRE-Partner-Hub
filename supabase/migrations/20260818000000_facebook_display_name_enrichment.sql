-- Add Facebook display name columns to customer_social_profiles
ALTER TABLE public.customer_social_profiles
ADD COLUMN IF NOT EXISTS facebook_display_name text,
ADD COLUMN IF NOT EXISTS display_name_source text,
ADD COLUMN IF NOT EXISTS display_name_confidence_score int,
ADD COLUMN IF NOT EXISTS display_name_updated_at timestamptz;

-- Ensure facebook_uid_resolver_results has returned_name
ALTER TABLE public.facebook_uid_resolver_results
ADD COLUMN IF NOT EXISTS returned_name text;

-- Update the resolve_facebook_identity_manual_review RPC to accept facebook_display_name
CREATE OR REPLACE FUNCTION public.resolve_facebook_identity_manual_review(
    p_job_id uuid,
    p_numeric_uid text DEFAULT NULL,
    p_status public.fb_resolution_job_status DEFAULT 'resolved',
    p_note text DEFAULT NULL,
    p_facebook_display_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_customer_id uuid;
    v_raw_url text;
    v_social_profile_id uuid;
    v_existing_profile_id uuid;
BEGIN
    -- Authorization check: Must be Admin or Sub-admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Must be Admin or Sub-admin.';
    END IF;

    -- Fetch the job details
    SELECT customer_id, raw_url INTO v_customer_id, v_raw_url
    FROM public.facebook_identity_resolution_jobs
    WHERE id = p_job_id AND status IN ('manual_review_required', 'duplicate_candidate');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found or not in a reviewable status.';
    END IF;

    -- Validate status input against allowed values
    IF p_status NOT IN ('resolved', 'failed', 'ignored', 'duplicate_candidate') THEN
        RAISE EXCEPTION 'Invalid status. Must be resolved, failed, ignored, or duplicate_candidate.';
    END IF;

    -- Try to find the matching social profile
    SELECT id INTO v_social_profile_id
    FROM public.customer_social_profiles
    WHERE customer_id = v_customer_id AND platform = 'facebook' AND raw_url = v_raw_url
    ORDER BY created_at DESC LIMIT 1;

    IF v_social_profile_id IS NULL THEN
        SELECT id INTO v_social_profile_id
        FROM public.customer_social_profiles
        WHERE customer_id = v_customer_id AND platform = 'facebook'
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Handle Resolved
    IF p_status = 'resolved' THEN
        IF p_numeric_uid IS NULL THEN
            RAISE EXCEPTION 'numeric_uid is required when status is resolved.';
        END IF;

        -- Check if this UID is already assigned to another profile
        SELECT id INTO v_existing_profile_id
        FROM public.customer_social_profiles
        WHERE facebook_uid = p_numeric_uid AND id != COALESCE(v_social_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
        LIMIT 1;

        IF v_existing_profile_id IS NOT NULL THEN
            -- Cannot resolve manually to a duplicate. Mark as duplicate_candidate.
            UPDATE public.facebook_identity_resolution_jobs
            SET status = 'duplicate_candidate',
                duplicate_social_profile_id = v_existing_profile_id,
                reviewer_id = auth.uid(),
                reviewed_at = now(),
                last_auto_resolve_error = 'Manual UID entry conflicts with existing profile: ' || v_existing_profile_id
            WHERE id = p_job_id;

            RETURN FALSE; -- Indicate it was not resolved as requested
        END IF;

        -- Update the social profile
        IF v_social_profile_id IS NOT NULL THEN
            UPDATE public.customer_social_profiles
            SET facebook_uid = p_numeric_uid,
                resolver_status = 'resolved',
                resolver_method = 'manual_admin',
                confidence_score = 100,
                facebook_display_name = COALESCE(p_facebook_display_name, facebook_display_name),
                display_name_source = CASE WHEN p_facebook_display_name IS NOT NULL THEN 'manual_admin' ELSE display_name_source END,
                display_name_confidence_score = CASE WHEN p_facebook_display_name IS NOT NULL THEN 90 ELSE display_name_confidence_score END,
                display_name_updated_at = CASE WHEN p_facebook_display_name IS NOT NULL THEN now() ELSE display_name_updated_at END,
                updated_at = now()
            WHERE id = v_social_profile_id;
        END IF;

        -- Update the job
        UPDATE public.facebook_identity_resolution_jobs
        SET status = 'resolved',
            reviewer_id = auth.uid(),
            reviewed_at = now(),
            reviewer_note = p_note,
            last_auto_resolve_error = NULL
        WHERE id = p_job_id;

        RETURN TRUE;
    END IF;

    -- Handle Failed or Ignored
    IF p_status IN ('failed', 'ignored') THEN
        IF v_social_profile_id IS NOT NULL THEN
            UPDATE public.customer_social_profiles
            SET resolver_status = p_status,
                resolver_method = 'manual_admin',
                updated_at = now()
            WHERE id = v_social_profile_id AND facebook_uid IS NULL;
        END IF;

        UPDATE public.facebook_identity_resolution_jobs
        SET status = p_status,
            reviewer_id = auth.uid(),
            reviewed_at = now(),
            reviewer_note = p_note
        WHERE id = p_job_id;

        RETURN TRUE;
    END IF;

    -- Handle duplicate_candidate (e.g. admin confirming it IS a duplicate)
    IF p_status = 'duplicate_candidate' THEN
        UPDATE public.facebook_identity_resolution_jobs
        SET status = 'duplicate_candidate',
            reviewer_id = auth.uid(),
            reviewed_at = now(),
            reviewer_note = p_note
        WHERE id = p_job_id;
        
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;
