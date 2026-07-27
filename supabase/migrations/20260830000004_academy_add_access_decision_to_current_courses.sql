-- Add access_decision to get_current_student_courses
CREATE OR REPLACE FUNCTION public.get_current_student_courses()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN v_result; END IF;
  
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'course', jsonb_build_object(
        'id', c.id,
        'slug', c.slug,
        'title', c.title,
        'description', c.description,
        'status', c.status,
        'catalog_visibility', c.catalog_visibility,
        'enrollment_policy', c.enrollment_policy,
        'access_policy', c.access_policy,
        'pricing_model', c.pricing_model,
        'category', jsonb_build_object('id', cat.id, 'slug', cat.slug, 'name', cat.name)
      ),
      'enrollment', jsonb_build_object(
        'id', e.id,
        'status', e.status,
        'source', e.source,
        'created_at', e.created_at,
        'expires_at', e.expires_at
      ),
      'completed_lessons', (SELECT COUNT(*) FROM public.lesson_progress lp WHERE lp.enrollment_id = e.id AND lp.status = 'completed'),
      'total_lessons', (SELECT COUNT(*) FROM public.lessons l JOIN public.course_modules m ON m.id = l.module_id WHERE m.course_id = c.id AND l.status = 'published'),
      'progress_percent', (SELECT COALESCE(AVG(lp.progress_percent), 0) FROM public.lesson_progress lp WHERE lp.enrollment_id = e.id),
      'last_accessed_lesson', (SELECT lp.lesson_id FROM public.lesson_progress lp WHERE lp.enrollment_id = e.id ORDER BY lp.updated_at DESC LIMIT 1),
      'access_decision', private.get_course_access_decision(c.id),
      'is_blocked', (private.get_course_access_decision(c.id)->>'reason') = 'ACCESS_BLOCKED'
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM public.enrollments e
  JOIN public.student_accounts sa ON sa.id = e.student_id
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN public.course_categories cat ON cat.id = c.category_id
  WHERE sa.user_id = v_uid;
  
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_student_courses() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_student_courses() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_student_courses() TO authenticated;

NOTIFY pgrst, 'reload schema';
