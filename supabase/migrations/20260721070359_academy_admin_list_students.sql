-- admin_list_academy_students
CREATE OR REPLACE FUNCTION public.admin_list_academy_students(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  customer_id uuid,
  status text,
  created_at timestamptz,
  email text,
  display_name text,
  phone text,
  enrollment_count bigint
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'sub_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    sa.id,
    sa.user_id,
    sa.customer_id,
    sa.status,
    sa.created_at,
    u.email::text,
    (u.raw_user_meta_data->>'display_name')::text AS display_name,
    u.phone::text,
    (SELECT COUNT(*) FROM public.enrollments e WHERE e.student_id = sa.id) AS enrollment_count
  FROM public.student_accounts sa
  LEFT JOIN auth.users u ON sa.user_id = u.id
  WHERE (p_status IS NULL OR sa.status = p_status)
    AND (
      p_search IS NULL 
      OR u.email ILIKE '%' || p_search || '%'
      OR u.phone ILIKE '%' || p_search || '%'
      OR (u.raw_user_meta_data->>'display_name') ILIKE '%' || p_search || '%'
    )
  ORDER BY sa.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_academy_students(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_academy_students(text, text) TO authenticated;

-- admin_get_academy_student_details
CREATE OR REPLACE FUNCTION public.admin_get_academy_student_details(
  p_student_id uuid
)
RETURNS json
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_student json;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'sub_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_build_object(
    'id', sa.id,
    'user_id', sa.user_id,
    'customer_id', sa.customer_id,
    'status', sa.status,
    'created_at', sa.created_at,
    'email', u.email,
    'phone', u.phone,
    'display_name', u.raw_user_meta_data->>'display_name',
    'enrollments', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', e.id,
          'course_id', e.course_id,
          'status', e.status,
          'created_at', e.created_at
        )
      ), '[]'::json)
      FROM public.enrollments e
      WHERE e.student_id = sa.id
    )
  ) INTO v_student
  FROM public.student_accounts sa
  LEFT JOIN auth.users u ON sa.user_id = u.id
  WHERE sa.id = p_student_id;

  RETURN v_student;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_academy_student_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_academy_student_details(uuid) TO authenticated;

-- admin_update_academy_student_status
CREATE OR REPLACE FUNCTION public.admin_update_academy_student_status(
  p_student_id uuid,
  p_status text
)
RETURNS json
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $body
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'sub_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  IF p_status NOT IN ('active', 'pending_review', 'blocked') THEN
    RAISE EXCEPTION 'Invalid status value.';
  END IF;

  UPDATE public.student_accounts
  SET status = p_status,
      updated_at = now()
  WHERE id = p_student_id;

  RETURN json_build_object('success', true);
END;
$body;

REVOKE ALL ON FUNCTION public.admin_update_academy_student_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_academy_student_status(uuid, text) TO authenticated;
