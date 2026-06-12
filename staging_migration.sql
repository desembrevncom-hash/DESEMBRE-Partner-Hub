-- 1. Create Audit Logs Table
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

CREATE POLICY "Admins can view all customer audit logs"
    ON public.customer_audit_logs FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sub_admin'));

CREATE POLICY "Users view audit logs of assigned customers"
    ON public.customer_audit_logs FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_audit_logs.customer_id
        AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid() OR c.user_id = auth.uid())
    ));

CREATE INDEX IF NOT EXISTS idx_customer_audit_logs_customer_id ON public.customer_audit_logs(customer_id);

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.is_replaceable_name(p_val text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_val IS NULL OR trim(p_val) = '' THEN RETURN true; END IF;
    IF p_val ILIKE 'http://%' OR p_val ILIKE 'https://%' THEN RETURN true; END IF;
    IF p_val ILIKE '%facebook.com%' OR p_val ILIKE '%fb.com%' THEN RETURN true; END IF;
    IF p_val ~ '^\d+$' THEN RETURN true; END IF;
    RETURN false;
END;
$$;

-- 3. The RPC
DROP FUNCTION IF EXISTS public.apply_facebook_name_to_customer(uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION public.apply_facebook_name_to_customer(
    p_customer_id uuid,
    p_social_profile_id uuid,
    p_force_overwrite boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
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

    SELECT role INTO v_role FROM public.users_roles WHERE user_id = v_user_id;
    IF v_role IN ('admin', 'sub_admin', 'manager') THEN v_is_admin := true; END IF;

    SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'customer_not_found', 'message', 'Không tìm thấy khách hàng.');
    END IF;

    IF v_is_admin THEN v_has_permission := true;
    ELSIF v_customer.owner_sale_id = v_user_id THEN v_has_permission := true;
    ELSIF v_customer.created_by = v_user_id AND v_customer.owner_sale_id IS NULL THEN v_has_permission := true;
    END IF;

    IF NOT v_has_permission THEN
        RETURN jsonb_build_object('success', false, 'code', 'access_denied', 'message', 'Bạn không có quyền sửa tên khách hàng này.');
    END IF;

    SELECT * INTO v_profile FROM public.customer_social_profiles WHERE id = p_social_profile_id AND customer_id = p_customer_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'profile_not_found', 'message', 'Hồ sơ Facebook không thuộc khách hàng này.');
    END IF;

    IF v_profile.facebook_display_name IS NULL OR trim(v_profile.facebook_display_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'missing_facebook_display_name', 'message', 'Chưa có tên Facebook để áp dụng.');
    END IF;

    v_clean_fb_name := regexp_replace(v_profile.facebook_display_name, '<[^>]*>', '', 'g');
    v_clean_fb_name := regexp_replace(v_clean_fb_name, '[\x00-\x1F\x7F]', '', 'g');
    v_clean_fb_name := substring(trim(v_clean_fb_name) from 1 for 120);

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
        p_customer_id, 'apply_facebook_name', v_target_field, v_old_values->>v_target_field, v_clean_fb_name, v_user_id,
        jsonb_build_object('social_profile_id', p_social_profile_id, 'facebook_uid', v_profile.facebook_uid, 'facebook_display_name', v_profile.facebook_display_name, 'source', 'facebook_display_name')
    );

    RETURN jsonb_build_object('success', true, 'code', 'ok', 'message', 'Đã cập nhật tên thành công', 'updated_fields', v_updated_fields, 'old_values', v_old_values, 'new_value', v_clean_fb_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_facebook_name_to_customer(uuid, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_facebook_name_to_customer(uuid, uuid, boolean) TO authenticated;
