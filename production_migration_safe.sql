-- Section A: pre-check comments
-- Ensure you have backed up the database before running this script.

-- Section B: customer_audit_logs table
CREATE TABLE IF NOT EXISTS public.customer_audit_logs (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.customers(id) on delete cascade,
    action text not null,
    field_name text,
    old_value text,
    new_value text,
    actor_user_id uuid references auth.users(id) on delete set null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

ALTER TABLE public.customer_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customer_audit_logs' AND policyname = 'Admins can view all customer audit logs'
    ) THEN
        CREATE POLICY "Admins can view all customer audit logs"
            ON public.customer_audit_logs
            FOR SELECT
            TO authenticated
            USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sub_admin'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customer_audit_logs' AND policyname = 'Users view audit logs of assigned customers'
    ) THEN
        CREATE POLICY "Users view audit logs of assigned customers"
            ON public.customer_audit_logs
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.customers c
                    WHERE c.id = customer_audit_logs.customer_id
                    AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid() OR c.user_id = auth.uid())
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_audit_logs_customer_id ON public.customer_audit_logs(customer_id);

-- Section C: apply_facebook_name_to_customer RPC
CREATE OR REPLACE FUNCTION public.is_replaceable_name(p_val text)
RETURNS boolean
LANGUAGE plpgsql
AS $func$
BEGIN
    IF p_val IS NULL OR trim(p_val) = '' THEN
        RETURN true;
    END IF;
    IF p_val ILIKE 'http://%' OR p_val ILIKE 'https://%' THEN
        RETURN true;
    END IF;
    IF p_val ILIKE '%facebook.com%' OR p_val ILIKE '%fb.com%' THEN
        RETURN true;
    END IF;
    IF p_val ~ '^\d+$' THEN
        RETURN true;
    END IF;
    RETURN false;
END;
$func$;

DROP FUNCTION IF EXISTS public.apply_facebook_name_to_customer(uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION public.apply_facebook_name_to_customer(
    p_customer_id uuid,
    p_social_profile_id uuid,
    p_force_overwrite boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE
    v_user_id uuid := auth.uid();
    v_role text;
    v_is_admin boolean := false;
    v_customer public.customers%ROWTYPE;
    v_profile public.customer_social_profiles%ROWTYPE;
    v_clean_fb_name text;
    v_has_permission boolean := false;
    v_updated_fields text[] := '{}';
    v_old_values jsonb := '{}'::jsonb;
    v_target_field text;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'unauthorized', 'message', 'You must be logged in.');
    END IF;

    SELECT role INTO v_role FROM public.user_roles WHERE user_id = v_user_id;
    IF v_role IN ('admin', 'sub_admin', 'manager') THEN
        v_is_admin := true;
    END IF;

    SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'customer_not_found', 'message', 'Không tìm thấy khách hàng.');
    END IF;

    IF v_is_admin THEN
        v_has_permission := true;
    ELSIF v_customer.owner_sale_id = v_user_id THEN
        v_has_permission := true;
    ELSIF v_customer.created_by = v_user_id AND v_customer.owner_sale_id IS NULL THEN
        v_has_permission := true;
    END IF;

    IF NOT v_has_permission THEN
        RETURN jsonb_build_object('success', false, 'code', 'access_denied', 'message', 'Bạn không có quyền sửa tên khách hàng này.');
    END IF;

    SELECT * INTO v_profile FROM public.customer_social_profiles 
    WHERE id = p_social_profile_id AND customer_id = p_customer_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'profile_not_found', 'message', 'Hồ sơ Facebook không thuộc khách hàng này.');
    END IF;

    IF v_profile.facebook_display_name IS NULL OR trim(v_profile.facebook_display_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'missing_facebook_display_name', 'message', 'Chưa có tên Facebook để áp dụng.');
    END IF;

    v_clean_fb_name := regexp_replace(v_profile.facebook_display_name, '<[^>]*>', '', 'g');
    v_clean_fb_name := regexp_replace(v_clean_fb_name, '[\x00-\x1F\x7F]', '', 'g');
    v_clean_fb_name := trim(v_clean_fb_name);
    v_clean_fb_name := substring(v_clean_fb_name from 1 for 120);

    IF v_clean_fb_name = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'invalid_name', 'message', 'Tên Facebook không hợp lệ sau khi làm sạch.');
    END IF;

    IF public.is_replaceable_name(v_customer.name) THEN
        v_target_field := 'name';
    ELSIF public.is_replaceable_name(v_customer.contact_name) THEN
        v_target_field := 'contact_name';
    ELSE
        IF p_force_overwrite THEN
            v_target_field := 'name';
        ELSE
            RETURN jsonb_build_object('success', false, 'code', 'confirmation_required', 'message', 'Tên hiện tại đã là tên thật, cần xác nhận ghi đè.');
        END IF;
    END IF;

    IF v_target_field = 'name' THEN
        v_old_values := jsonb_build_object('name', v_customer.name);
        UPDATE public.customers SET name = v_clean_fb_name, updated_at = now() WHERE id = p_customer_id;
        v_updated_fields := array_append(v_updated_fields, 'name');
    ELSE
        v_old_values := jsonb_build_object('contact_name', v_customer.contact_name);
        UPDATE public.customers SET contact_name = v_clean_fb_name, updated_at = now() WHERE id = p_customer_id;
        v_updated_fields := array_append(v_updated_fields, 'contact_name');
    END IF;

    INSERT INTO public.customer_audit_logs (
        customer_id, action, field_name, old_value, new_value, actor_user_id, metadata
    ) VALUES (
        p_customer_id, 
        'apply_facebook_name', 
        v_target_field, 
        v_old_values->>v_target_field, 
        v_clean_fb_name, 
        v_user_id,
        jsonb_build_object(
            'social_profile_id', p_social_profile_id,
            'facebook_uid', v_profile.facebook_uid,
            'facebook_display_name', v_profile.facebook_display_name,
            'source', 'facebook_display_name'
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'code', 'ok', 
        'message', 'Đã cập nhật tên thành công', 
        'updated_fields', v_updated_fields, 
        'old_values', v_old_values, 
        'new_value', v_clean_fb_name
    );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.apply_facebook_name_to_customer(uuid, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_facebook_name_to_customer(uuid, uuid, boolean) TO authenticated;

-- Section D: reviewer columns
ALTER TABLE public.facebook_identity_resolution_jobs
ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS reviewer_note text;

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
AS $func$
DECLARE
    v_customer_id uuid;
    v_raw_url text;
    v_social_profile_id uuid;
    v_existing_profile_id uuid;
BEGIN
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Must be Admin or Sub-admin.';
    END IF;

    SELECT customer_id, raw_url INTO v_customer_id, v_raw_url
    FROM public.facebook_identity_resolution_jobs
    WHERE id = p_job_id AND status IN ('manual_review_required', 'duplicate_candidate', 'failed');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found or not in a reviewable status.';
    END IF;

    IF p_status NOT IN ('resolved', 'failed', 'ignored', 'duplicate_candidate') THEN
        RAISE EXCEPTION 'Invalid status. Must be resolved, failed, ignored, or duplicate_candidate.';
    END IF;

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

    IF p_status = 'resolved' THEN
        IF p_numeric_uid IS NULL THEN
            RAISE EXCEPTION 'numeric_uid is required when status is resolved.';
        END IF;

        SELECT id INTO v_existing_profile_id
        FROM public.customer_social_profiles
        WHERE facebook_uid = p_numeric_uid AND id != COALESCE(v_social_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
        LIMIT 1;

        IF v_existing_profile_id IS NOT NULL THEN
            UPDATE public.facebook_identity_resolution_jobs
            SET status = 'duplicate_candidate',
                duplicate_social_profile_id = v_existing_profile_id,
                reviewer_id = auth.uid(),
                reviewed_at = now(),
                last_auto_resolve_error = 'Manual UID entry conflicts with existing profile: ' || v_existing_profile_id
            WHERE id = p_job_id;
            RETURN FALSE;
        END IF;

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

        UPDATE public.facebook_identity_resolution_jobs
        SET status = 'resolved',
            reviewer_id = auth.uid(),
            reviewed_at = now(),
            reviewer_note = p_note,
            last_auto_resolve_error = NULL
        WHERE id = p_job_id;

        RETURN TRUE;
    END IF;

    IF p_status IN ('failed', 'ignored') THEN
        IF v_social_profile_id IS NOT NULL THEN
            UPDATE public.customer_social_profiles
            SET resolver_status = p_status::text::public.resolver_status,
                resolver_method = 'manual_admin',
                updated_at = now()
            WHERE id = v_social_profile_id;
        END IF;

        UPDATE public.facebook_identity_resolution_jobs
        SET status = p_status,
            reviewer_id = auth.uid(),
            reviewed_at = now(),
            reviewer_note = p_note
        WHERE id = p_job_id;

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$func$;

-- Section E: post-check queries
-- Copy and run these to verify:
-- SELECT * FROM pg_policies WHERE tablename = 'customer_audit_logs';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'facebook_identity_resolution_jobs' AND column_name = 'reviewer_id';
