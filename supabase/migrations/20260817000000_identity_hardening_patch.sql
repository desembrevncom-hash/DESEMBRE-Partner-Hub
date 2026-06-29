-- Migration: Identity Hardening Patch

-- 1. Add social_profile_id to customer_contact_channels
ALTER TABLE public.customer_contact_channels
ADD COLUMN IF NOT EXISTS social_profile_id uuid REFERENCES public.customer_social_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contact_channels_social_profile_id ON public.customer_contact_channels(social_profile_id);

-- 2. Add duplicate_social_profile_id to facebook_identity_resolution_jobs
ALTER TABLE public.facebook_identity_resolution_jobs
ADD COLUMN IF NOT EXISTS duplicate_social_profile_id uuid REFERENCES public.customer_social_profiles(id) ON DELETE SET NULL;

-- 3. Update job status enum
-- ALTER TYPE cannot be run inside a transaction block if it has a default, but we can just use IF NOT EXISTS workaround or standard ADD VALUE.
ALTER TYPE public.fb_resolution_job_status ADD VALUE IF NOT EXISTS 'ignored';
ALTER TYPE public.fb_resolution_job_status ADD VALUE IF NOT EXISTS 'duplicate_candidate';

-- 4. Update auto_resolve_status check constraint
-- Drop old constraint first
ALTER TABLE public.facebook_identity_resolution_jobs
DROP CONSTRAINT IF EXISTS facebook_identity_resolution_jobs_auto_resolve_status_check;

-- Re-add constraint with new values
ALTER TABLE public.facebook_identity_resolution_jobs
ADD CONSTRAINT facebook_identity_resolution_jobs_auto_resolve_status_check
CHECK (auto_resolve_status IN ('not_attempted', 'queued', 'resolving', 'resolved', 'failed', 'timeout', 'rate_limited', 'disabled', 'cached', 'skipped_invalid_type', 'duplicate_detected'));

-- 5. Data Backfill: Link existing contact_channels to social_profiles
-- Try to match by customer_id and normalized_url first, then by raw_url
UPDATE public.customer_contact_channels c
SET social_profile_id = p.id
FROM public.customer_social_profiles p
WHERE c.customer_id = p.customer_id
  AND c.social_profile_id IS NULL
  AND c.channel_type = 'facebook'
  AND (c.normalized_value = p.normalized_url OR c.channel_value = p.raw_url OR c.normalized_value = p.facebook_username);

-- 6. Update manual resolution RPC to handle duplicates safely
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

    IF v_social_profile_id IS NULL THEN
        RAISE EXCEPTION 'No related customer_social_profiles found for this job.';
    END IF;

    IF p_status = 'resolved' THEN
        IF p_numeric_uid IS NULL OR p_numeric_uid !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'numeric_uid is required and must be strictly numeric for resolved status.';
        END IF;

        -- Check for duplicate
        SELECT id INTO v_existing_profile_id
        FROM public.customer_social_profiles
        WHERE facebook_uid = p_numeric_uid AND id != v_social_profile_id
        LIMIT 1;

        IF v_existing_profile_id IS NOT NULL THEN
            -- Duplicate detected! Do not crash. Instead return a clear exception or handle it.
            -- According to spec: "return clear error or mark duplicate_candidate"
            RAISE EXCEPTION 'Duplicate detected. This UID is already registered to another social profile.';
        END IF;

        -- Update customer_social_profiles
        UPDATE public.customer_social_profiles
        SET facebook_uid = p_numeric_uid,
            resolver_status = 'resolved',
            resolver_method = 'manual_admin',
            confidence_score = 90,
            updated_at = NOW()
        WHERE id = v_social_profile_id;

    ELSIF p_status IN ('failed', 'ignored') THEN
        -- Update customer_social_profiles
        UPDATE public.customer_social_profiles
        SET resolver_status = p_status::text,
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
