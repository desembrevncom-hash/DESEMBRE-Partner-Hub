-- 20260826000000_academy_enrollment_operations.sql

-- 1. ADD REJECTION FIELDS TO ENROLLMENTS
ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- 2. ADMIN LIST ACADEMY ENROLLMENTS
CREATE OR REPLACE FUNCTION public.admin_list_academy_enrollments(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_course_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_result jsonb;
BEGIN
  -- Verify authorization using existing helper
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'status', e.status,
      'source', e.source,
      'created_at', e.created_at,
      'student', jsonb_build_object(
        'id', sa.id,
        'user_id', sa.user_id,
        'customer_id', sa.customer_id
      ),
      'course', jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'slug', c.slug
      )
    ) ORDER BY e.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.enrollments e
  JOIN public.student_accounts sa ON sa.id = e.student_id
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN public.customers cust ON cust.id = sa.customer_id
  LEFT JOIN public.profiles p ON p.id = sa.user_id
  WHERE (p_status IS NULL OR e.status = p_status)
    AND (p_course_id IS NULL OR e.course_id = p_course_id)
    AND (
      p_search IS NULL 
      OR c.title ILIKE '%' || p_search || '%'
      OR p.display_name ILIKE '%' || p_search || '%'
      OR p.email ILIKE '%' || p_search || '%'
      OR cust.phone ILIKE '%' || p_search || '%'
    );

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_academy_enrollments(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_academy_enrollments(text, text, uuid) TO authenticated;

-- 3. ADMIN GET ACADEMY ENROLLMENT
CREATE OR REPLACE FUNCTION public.admin_get_academy_enrollment(
  p_enrollment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_result jsonb;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT jsonb_build_object(
    'id', e.id,
    'status', e.status,
    'source', e.source,
    'created_at', e.created_at,
    'approved_at', e.approved_at,
    'approved_by', e.approved_by,
    'rejected_at', e.rejected_at,
    'rejected_by', e.rejected_by,
    'rejection_reason', e.rejection_reason,
    'expires_at', e.expires_at,
    'student', jsonb_build_object(
      'id', sa.id,
      'user_id', sa.user_id,
      'customer_id', sa.customer_id,
      'status', sa.status,
      'email', p.email,
      'display_name', p.display_name,
      'phone', cust.phone
    ),
    'course', jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'slug', c.slug,
      'status', c.status
    )
  ) INTO v_result
  FROM public.enrollments e
  JOIN public.student_accounts sa ON sa.id = e.student_id
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN public.customers cust ON cust.id = sa.customer_id
  LEFT JOIN public.profiles p ON p.id = sa.user_id
  WHERE e.id = p_enrollment_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_NOT_FOUND';
  END IF;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_academy_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_academy_enrollment(uuid) TO authenticated;

-- 4. ADMIN APPROVE ACADEMY ENROLLMENT
CREATE OR REPLACE FUNCTION public.admin_approve_academy_enrollment(
  p_enrollment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_enrollment public.enrollments;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF v_enrollment.id IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_NOT_FOUND';
  END IF;

  -- Idempotent check
  IF v_enrollment.status = 'active' THEN
    RETURN jsonb_build_object('success', true, 'status', 'active');
  END IF;

  IF v_enrollment.status != 'pending' THEN
    RAISE EXCEPTION 'INVALID_ENROLLMENT_STATUS';
  END IF;

  UPDATE public.enrollments
  SET status = 'active',
      approved_by = v_actor_id,
      approved_at = now(),
      updated_at = now()
  WHERE id = p_enrollment_id;

  PERFORM private.write_academy_admin_audit(
    v_actor_id, v_actor_role, 'APPROVE_ENROLLMENT', 'enrollment', p_enrollment_id,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'active')
  );

  RETURN jsonb_build_object('success', true, 'status', 'active');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_approve_academy_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_academy_enrollment(uuid) TO authenticated;

-- 5. ADMIN REJECT ACADEMY ENROLLMENT
CREATE OR REPLACE FUNCTION public.admin_reject_academy_enrollment(
  p_enrollment_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_enrollment public.enrollments;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF v_enrollment.id IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_NOT_FOUND';
  END IF;

  IF v_enrollment.status = 'rejected' THEN
    RETURN jsonb_build_object('success', true, 'status', 'rejected');
  END IF;

  IF v_enrollment.status != 'pending' THEN
    RAISE EXCEPTION 'INVALID_ENROLLMENT_STATUS';
  END IF;

  UPDATE public.enrollments
  SET status = 'rejected',
      rejected_by = v_actor_id,
      rejected_at = now(),
      rejection_reason = p_reason,
      updated_at = now()
  WHERE id = p_enrollment_id;

  PERFORM private.write_academy_admin_audit(
    v_actor_id, v_actor_role, 'REJECT_ENROLLMENT', 'enrollment', p_enrollment_id,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'rejected', 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'status', 'rejected');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reject_academy_enrollment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_academy_enrollment(uuid, text) TO authenticated;

-- 6. ADMIN ASSIGN ACADEMY COURSE TO STUDENT
CREATE OR REPLACE FUNCTION public.admin_assign_academy_course_to_student(
  p_student_id uuid,
  p_course_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_course public.courses;
  v_student public.student_accounts;
  v_enrollment_id uuid;
  v_existing_status text;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT * INTO v_student FROM public.student_accounts WHERE id = p_student_id;
  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'STUDENT_NOT_FOUND';
  END IF;

  IF v_student.status != 'active' THEN
    RAISE EXCEPTION 'STUDENT_NOT_ACTIVE';
  END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;
  IF v_course.id IS NULL THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  IF v_course.status != 'published' THEN
    RAISE EXCEPTION 'COURSE_NOT_PUBLISHED';
  END IF;

  SELECT id, status INTO v_enrollment_id, v_existing_status FROM public.enrollments WHERE student_id = p_student_id AND course_id = p_course_id;

  IF v_enrollment_id IS NOT NULL THEN
    IF v_existing_status IN ('active', 'completed') THEN
      RETURN jsonb_build_object('success', true, 'status', v_existing_status, 'enrollment_id', v_enrollment_id);
    ELSIF v_existing_status IN ('pending', 'rejected', 'cancelled', 'expired') THEN
      UPDATE public.enrollments
      SET status = 'active',
          source = 'admin',
          approved_by = v_actor_id,
          approved_at = now(),
          updated_at = now()
      WHERE id = v_enrollment_id;
      
      PERFORM private.write_academy_admin_audit(
        v_actor_id, v_actor_role, 'ASSIGN_COURSE_UPDATE', 'enrollment', v_enrollment_id,
        jsonb_build_object('status', v_existing_status), jsonb_build_object('status', 'active', 'source', 'admin')
      );
      RETURN jsonb_build_object('success', true, 'status', 'active', 'enrollment_id', v_enrollment_id);
    END IF;
  END IF;

  INSERT INTO public.enrollments (student_id, course_id, status, source, approved_by, approved_at)
  VALUES (p_student_id, p_course_id, 'active', 'admin', v_actor_id, now())
  RETURNING id INTO v_enrollment_id;

  PERFORM private.write_academy_admin_audit(
    v_actor_id, v_actor_role, 'ASSIGN_COURSE_INSERT', 'enrollment', v_enrollment_id,
    NULL, jsonb_build_object('status', 'active', 'source', 'admin')
  );

  RETURN jsonb_build_object('success', true, 'status', 'active', 'enrollment_id', v_enrollment_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_assign_academy_course_to_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_academy_course_to_student(uuid, uuid) TO authenticated;

-- 7. ADMIN LIST ACADEMY STUDENT ACCOUNTS
CREATE OR REPLACE FUNCTION public.admin_list_academy_student_accounts(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL
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
      'customer_id', sa.customer_id,
      'status', sa.status,
      'created_at', sa.created_at,
      'email', p.email,
      'display_name', p.display_name,
      'phone', cust.phone,
      'enrollment_count', (SELECT count(*) FROM public.enrollments WHERE student_id = sa.id)
    ) ORDER BY sa.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.student_accounts sa
  LEFT JOIN public.customers cust ON cust.id = sa.customer_id
  LEFT JOIN public.profiles p ON p.id = sa.user_id
  WHERE (p_status IS NULL OR sa.status = p_status)
    AND (
      p_search IS NULL 
      OR p.display_name ILIKE '%' || p_search || '%'
      OR p.email ILIKE '%' || p_search || '%'
      OR cust.phone ILIKE '%' || p_search || '%'
    );

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_academy_student_accounts(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_academy_student_accounts(text, text) TO authenticated;

-- 8. ADMIN GET ACADEMY STUDENT SUMMARY
CREATE OR REPLACE FUNCTION public.admin_get_academy_student_summary(
  p_student_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_result jsonb;
  v_student jsonb;
  v_enrollments jsonb;
  v_progress_summary jsonb;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT jsonb_build_object(
    'id', sa.id,
    'user_id', sa.user_id,
    'customer_id', sa.customer_id,
    'status', sa.status,
    'created_at', sa.created_at,
    'email', p.email,
    'display_name', p.display_name,
    'phone', cust.phone
  ) INTO v_student
  FROM public.student_accounts sa
  LEFT JOIN public.customers cust ON cust.id = sa.customer_id
  LEFT JOIN public.profiles p ON p.id = sa.user_id
  WHERE sa.id = p_student_id;

  IF v_student IS NULL THEN
    RAISE EXCEPTION 'STUDENT_NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'status', e.status,
      'source', e.source,
      'created_at', e.created_at,
      'course', jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'slug', c.slug,
        'status', c.status
      )
    ) ORDER BY e.created_at DESC
  ), '[]'::jsonb) INTO v_enrollments
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id
  WHERE e.student_id = p_student_id;

  SELECT jsonb_build_object(
    'active_courses_count', (SELECT count(*) FROM public.enrollments WHERE student_id = p_student_id AND status = 'active'),
    'completed_courses_count', (SELECT count(*) FROM public.enrollments WHERE student_id = p_student_id AND status = 'completed'),
    'completed_lessons_count', (SELECT count(*) FROM public.lesson_progress lp JOIN public.enrollments e ON e.id = lp.enrollment_id WHERE e.student_id = p_student_id AND lp.status = 'completed')
  ) INTO v_progress_summary;

  RETURN jsonb_build_object(
    'student', v_student,
    'enrollments', v_enrollments,
    'progress_summary', v_progress_summary
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_academy_student_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_academy_student_summary(uuid) TO authenticated;
