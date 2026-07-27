-- ==========================================
-- Phase C: Academy Admin Course Access Ops
-- ==========================================

-- 1. ADMIN SEARCH STUDENTS FOR ACCESS
CREATE OR REPLACE FUNCTION public.admin_search_academy_students_for_access(
  p_query text,
  p_limit int DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_result jsonb;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sa.id,
      'user_id', sa.user_id,
      'status', sa.status,
      'display_name', p.display_name,
      'email', p.email,
      'phone', cust.phone,
      'customer_id', sa.customer_id
    ) ORDER BY sa.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.student_accounts sa
  LEFT JOIN public.profiles p ON p.id = sa.user_id
  LEFT JOIN public.customers cust ON cust.id = sa.customer_id
  WHERE p_query IS NULL 
     OR p_query = ''
     OR sa.id::text ILIKE '%' || p_query || '%'
     OR p.display_name ILIKE '%' || p_query || '%'
     OR p.email ILIKE '%' || p_query || '%'
     OR cust.phone ILIKE '%' || p_query || '%'
  LIMIT COALESCE(p_limit, 20);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_academy_students_for_access(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_academy_students_for_access(text, int) TO authenticated;


-- 2. ADMIN LIST STUDENT COURSE ACCESS
CREATE OR REPLACE FUNCTION public.admin_list_student_course_access(
  p_student_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_result jsonb;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'course_id', o.course_id,
      'course_title', c.title,
      'decision', o.decision,
      'access_scope', o.access_scope,
      'reason', o.reason,
      'starts_at', o.starts_at,
      'expires_at', o.expires_at,
      'created_at', o.created_at,
      'is_active', (o.decision = 'allow' AND o.starts_at <= now() AND (o.expires_at IS NULL OR o.expires_at > now()))
    ) ORDER BY o.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.course_access_overrides o
  JOIN public.courses c ON c.id = o.course_id
  WHERE o.student_id = p_student_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_student_course_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_student_course_access(uuid) TO authenticated;


-- 3. ADMIN GRANT STUDENT COURSE ACCESS
CREATE OR REPLACE FUNCTION public.admin_grant_student_course_access(
  p_student_id uuid,
  p_course_id uuid,
  p_access_scopes text[],
  p_expires_at timestamptz,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_student_status text;
  v_course_exists boolean;
  v_scope text;
  v_inserted_ids uuid[] := '{}';
  v_new_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  IF p_expires_at IS NULL THEN
    RAISE EXCEPTION 'Expiry date is required';
  END IF;
  
  IF p_expires_at > now() + interval '91 days' THEN
    RAISE EXCEPTION 'Expiry cannot exceed 90 days';
  END IF;

  IF length(COALESCE(p_reason, '')) < 10 THEN
    RAISE EXCEPTION 'Reason is required and must be at least 10 characters';
  END IF;

  SELECT status INTO v_student_status FROM public.student_accounts WHERE id = p_student_id;
  IF v_student_status IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  IF v_student_status != 'active' THEN
    RAISE EXCEPTION 'Student must be active to grant access';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.courses WHERE id = p_course_id) INTO v_course_exists;
  IF NOT v_course_exists THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  IF array_length(p_access_scopes, 1) IS NULL OR array_length(p_access_scopes, 1) = 0 THEN
    RAISE EXCEPTION 'At least one access scope must be provided';
  END IF;

  FOREACH v_scope IN ARRAY p_access_scopes
  LOOP
    IF v_scope NOT IN ('catalog', 'enroll', 'full') THEN
      RAISE EXCEPTION 'Invalid access scope: %', v_scope;
    END IF;

    -- Prevent duplicate active allow
    IF EXISTS (
      SELECT 1 FROM public.course_access_overrides
      WHERE student_id = p_student_id 
        AND course_id = p_course_id 
        AND access_scope = v_scope 
        AND decision = 'allow'
        AND starts_at <= now() 
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN
      CONTINUE; -- Skip if already active
    END IF;

    INSERT INTO public.course_access_overrides (
      student_id, course_id, decision, access_scope, reason, starts_at, expires_at, created_by
    ) VALUES (
      p_student_id, p_course_id, 'allow', v_scope, p_reason, now(), p_expires_at, v_actor_id
    ) RETURNING id INTO v_new_id;

    v_inserted_ids := array_append(v_inserted_ids, v_new_id);
  END LOOP;

  NOTIFY pgrst, 'reload schema';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Granted access scopes',
    'inserted_ids', v_inserted_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_student_course_access(uuid, uuid, text[], timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_student_course_access(uuid, uuid, text[], timestamptz, text) TO authenticated;


-- 4. ADMIN REVOKE STUDENT COURSE ACCESS
CREATE OR REPLACE FUNCTION public.admin_revoke_student_course_access(
  p_override_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_exists boolean;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  IF length(COALESCE(p_reason, '')) < 10 THEN
    RAISE EXCEPTION 'Revocation reason is required and must be at least 10 characters';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.course_access_overrides WHERE id = p_override_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Override not found';
  END IF;

  UPDATE public.course_access_overrides
  SET 
    expires_at = now(),
    reason = reason || ' | Revoked by admin: ' || p_reason
  WHERE id = p_override_id;

  NOTIFY pgrst, 'reload schema';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Override revoked'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_student_course_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_student_course_access(uuid, text) TO authenticated;
