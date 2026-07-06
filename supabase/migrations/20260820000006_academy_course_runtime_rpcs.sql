CREATE OR REPLACE FUNCTION private.get_course_access_decision(p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_can_view boolean;
  v_can_enroll boolean;
  v_can_learn boolean;
  v_reason text := 'COURSE_UNAVAILABLE';
  v_required_tier jsonb := null;
  
  v_catalog_vis text;
  v_enroll_policy text;
  v_pricing text;
  
  v_active_count int;
  v_enrollment_status text;
  
  v_rule_decision text;
  v_rule_tier_code text;
  v_rule_tier_name text;
  v_rule_tier_rank int;
BEGIN
  SELECT id INTO v_student_id FROM public.student_accounts WHERE user_id = v_uid;
  
  v_can_view := private.can_access_course(p_course_id, 'catalog');
  v_can_enroll := private.can_access_course(p_course_id, 'enroll');
  v_can_learn := private.can_access_course(p_course_id, 'full');
  
  SELECT catalog_visibility, enrollment_policy, pricing_model
  INTO v_catalog_vis, v_enroll_policy, v_pricing
  FROM public.courses WHERE id = p_course_id;
  
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('can_view', v_can_view, 'can_enroll', false, 'can_learn', false, 'reason', 'NO_STUDENT_ACCOUNT', 'required_tier', null);
  END IF;
  
  SELECT status INTO v_enrollment_status
  FROM public.enrollments 
  WHERE course_id = p_course_id AND student_id = v_student_id;
  
  IF v_enrollment_status IN ('active', 'completed') THEN
    RETURN jsonb_build_object('can_view', true, 'can_enroll', false, 'can_learn', true, 'reason', 'ALREADY_ENROLLED', 'required_tier', null);
  END IF;
  
  IF NOT v_can_view THEN
    IF v_catalog_vis = 'private' THEN v_reason := 'COURSE_PRIVATE'; END IF;
    RETURN jsonb_build_object('can_view', false, 'can_enroll', false, 'can_learn', false, 'reason', v_reason, 'required_tier', null);
  END IF;
  
  IF NOT v_can_enroll THEN
    IF v_pricing = 'paid' THEN
      v_reason := 'PAYMENT_REQUIRED';
    ELSIF v_enroll_policy = 'closed' THEN
      v_reason := 'ENROLLMENT_CLOSED';
    ELSIF v_enroll_policy = 'assigned' THEN
      v_reason := 'ASSIGNMENT_REQUIRED';
    ELSE
      SELECT r.decision, t.code, t.name, t.rank
      INTO v_rule_decision, v_rule_tier_code, v_rule_tier_name, v_rule_tier_rank
      FROM public.course_access_rules r
      JOIN public.customer_tiers t ON t.id = r.tier_id
      WHERE r.course_id = p_course_id 
        AND r.decision = 'allow'
        AND r.starts_at <= now() AND (r.ends_at IS NULL OR r.ends_at > now())
        AND (CASE r.access_scope WHEN 'catalog' THEN 10 WHEN 'enroll' THEN 20 WHEN 'full' THEN 30 ELSE 0 END) >= 20
      ORDER BY t.rank DESC LIMIT 1;
      
      IF v_rule_decision = 'allow' THEN
         v_required_tier := jsonb_build_object('code', v_rule_tier_code, 'name', v_rule_tier_name, 'rank', v_rule_tier_rank);
         
         SELECT COUNT(*) INTO v_active_count
         FROM public.customer_tier_memberships m
         JOIN public.student_accounts sa ON sa.customer_id = m.customer_id
         WHERE sa.id = v_student_id AND m.starts_at <= now() AND (m.ends_at IS NULL OR m.ends_at > now());
         
         IF v_active_count = 0 THEN
           v_reason := 'MEMBERSHIP_REQUIRED';
         ELSE
           v_reason := 'TIER_REQUIRED';
         END IF;
      ELSE
         v_reason := 'COURSE_UNAVAILABLE';
      END IF;
    END IF;
  ELSE
    IF v_enroll_policy = 'approval' THEN
      v_reason := 'ENROLLMENT_APPROVAL_REQUIRED';
    ELSE
      v_reason := 'AVAILABLE';
    END IF;
    
    IF v_pricing = 'paid' THEN
      v_can_enroll := false;
      v_reason := 'PAYMENT_REQUIRED';
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'can_view', v_can_view,
    'can_enroll', v_can_enroll,
    'can_learn', v_can_learn,
    'reason', v_reason,
    'required_tier', v_required_tier
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_academy_course_catalog()
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
      'id', c.id,
      'slug', c.slug,
      'title', c.title,
      'description', c.description,
      'status', c.status,
      'catalog_visibility', c.catalog_visibility,
      'enrollment_policy', c.enrollment_policy,
      'access_policy', c.access_policy,
      'pricing_model', c.pricing_model,
      'category', jsonb_build_object('id', cat.id, 'slug', cat.slug, 'name', cat.name),
      'access_decision', private.get_course_access_decision(c.id),
      'current_enrollment_summary', (
         SELECT jsonb_build_object('status', e.status, 'source', e.source, 'created_at', e.created_at)
         FROM public.enrollments e
         JOIN public.student_accounts sa ON sa.id = e.student_id
         WHERE e.course_id = c.id AND sa.user_id = v_uid
      ),
      'current_progress_summary', (
         SELECT jsonb_build_object(
           'completed_lessons', COUNT(lp.id) FILTER (WHERE lp.status = 'completed'),
           'total_lessons', (SELECT COUNT(*) FROM public.lessons l JOIN public.course_modules m ON m.id = l.module_id WHERE m.course_id = c.id AND l.status = 'published'),
           'progress_percent', COALESCE(AVG(lp.progress_percent), 0)
         )
         FROM public.enrollments e
         JOIN public.student_accounts sa ON sa.id = e.student_id
         LEFT JOIN public.lesson_progress lp ON lp.enrollment_id = e.id
         WHERE e.course_id = c.id AND sa.user_id = v_uid AND e.status IN ('active', 'completed')
      )
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM public.courses c
  LEFT JOIN public.course_categories cat ON cat.id = c.category_id
  WHERE c.status = 'published' AND private.can_access_course(c.id, 'catalog');
  
  RETURN v_result;
END;
$$;

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
      'last_accessed_lesson', (SELECT lp.lesson_id FROM public.lesson_progress lp WHERE lp.enrollment_id = e.id ORDER BY lp.updated_at DESC LIMIT 1)
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

CREATE OR REPLACE FUNCTION public.get_academy_course_outline(p_course_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course record;
  v_decision jsonb;
  v_can_learn boolean;
  v_enrollment_id uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN null; END IF;
  
  SELECT c.id, c.slug, c.title, c.description, c.status, c.catalog_visibility,
         c.enrollment_policy, c.access_policy, c.pricing_model,
         jsonb_build_object('id', cat.id, 'slug', cat.slug, 'name', cat.name) as category
  INTO v_course
  FROM public.courses c
  LEFT JOIN public.course_categories cat ON cat.id = c.category_id
  WHERE c.slug = p_course_slug AND c.status = 'published';
  
  IF v_course IS NULL THEN RETURN null; END IF;
  
  v_decision := private.get_course_access_decision(v_course.id);
  IF NOT (v_decision->>'can_view')::boolean THEN
    RETURN null;
  END IF;
  
  v_can_learn := (v_decision->>'can_learn')::boolean;
  
  SELECT e.id INTO v_enrollment_id
  FROM public.enrollments e
  JOIN public.student_accounts sa ON sa.id = e.student_id
  WHERE e.course_id = v_course.id AND sa.user_id = v_uid AND e.status IN ('active', 'completed');
  
  SELECT jsonb_build_object(
    'course', row_to_json(v_course),
    'access_decision', v_decision,
    'modules', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'title', m.title,
          'position', m.position,
          'lessons', COALESCE(
            (SELECT jsonb_agg(
              jsonb_build_object(
                'id', l.id,
                'title', l.title,
                'description', CASE WHEN v_can_learn OR l.is_preview THEN l.description ELSE null END,
                'type', CASE WHEN v_can_learn OR l.is_preview THEN l.type ELSE null END,
                'position', l.position,
                'duration', l.duration,
                'is_preview', l.is_preview,
                'is_locked', NOT (v_can_learn OR l.is_preview),
                'progress', CASE WHEN v_enrollment_id IS NOT NULL THEN
                  (SELECT jsonb_build_object('status', lp.status, 'progress_percent', lp.progress_percent, 'last_position_seconds', lp.last_position_seconds)
                   FROM public.lesson_progress lp WHERE lp.lesson_id = l.id AND lp.enrollment_id = v_enrollment_id)
                ELSE null END
              ) ORDER BY l.position
            ) FROM public.lessons l WHERE l.module_id = m.id AND l.status = 'published'),
            '[]'::jsonb
          )
        ) ORDER BY m.position
      ) FROM public.course_modules m WHERE m.course_id = v_course.id),
      '[]'::jsonb
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.enroll_current_student_in_course(p_course_slug text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_course_id uuid;
  v_decision jsonb;
  v_existing_id uuid;
  v_existing_status text;
  v_new_status text;
  v_enroll_policy text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT id INTO v_student_id FROM public.student_accounts WHERE user_id = v_uid;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'No student account'; END IF;
  
  SELECT id, enrollment_policy INTO v_course_id, v_enroll_policy FROM public.courses WHERE slug = p_course_slug AND status = 'published';
  IF v_course_id IS NULL THEN RAISE EXCEPTION 'Course not found or unpublished'; END IF;
  
  v_decision := private.get_course_access_decision(v_course_id);
  
  SELECT id, status INTO v_existing_id, v_existing_status
  FROM public.enrollments
  WHERE course_id = v_course_id AND student_id = v_student_id;
  
  IF v_existing_id IS NOT NULL THEN
    IF v_existing_status IN ('active', 'pending', 'completed') THEN
      RETURN jsonb_build_object('success', true, 'enrollment_id', v_existing_id, 'status', v_existing_status, 'message', 'Already enrolled');
    ELSE
      RAISE EXCEPTION 'Existing enrollment has incompatible status: %', v_existing_status;
    END IF;
  END IF;
  
  IF NOT (v_decision->>'can_enroll')::boolean THEN
    RAISE EXCEPTION 'Cannot enroll: %', v_decision->>'reason';
  END IF;
  
  IF v_enroll_policy = 'open' THEN
    v_new_status := 'active';
  ELSIF v_enroll_policy = 'approval' THEN
    v_new_status := 'pending';
  ELSE
    RAISE EXCEPTION 'Cannot self-enroll with policy %', v_enroll_policy;
  END IF;
  
  INSERT INTO public.enrollments (student_id, course_id, status, source)
  VALUES (v_student_id, v_course_id, v_new_status, 'self')
  RETURNING id INTO v_existing_id;
  
  RETURN jsonb_build_object('success', true, 'enrollment_id', v_existing_id, 'status', v_new_status, 'message', 'Enrolled successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.save_current_lesson_progress(
  p_lesson_id uuid,
  p_status text,
  p_progress_percent numeric
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_enrollment_id uuid;
  v_enrollment_status text;
  v_course_id uuid;
  v_can_learn boolean;
  v_updated jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  IF p_status NOT IN ('not_started', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  
  IF p_progress_percent < 0 OR p_progress_percent > 100 THEN
    RAISE EXCEPTION 'Invalid progress_percent';
  END IF;
  
  SELECT id INTO v_student_id FROM public.student_accounts WHERE user_id = v_uid;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'No student account'; END IF;
  
  SELECT c.id INTO v_course_id
  FROM public.lessons l
  JOIN public.course_modules m ON m.id = l.module_id
  JOIN public.courses c ON c.id = m.course_id
  WHERE l.id = p_lesson_id AND l.status = 'published';
  
  IF v_course_id IS NULL THEN RAISE EXCEPTION 'Lesson not found or inaccessible'; END IF;
  
  SELECT id, status INTO v_enrollment_id, v_enrollment_status
  FROM public.enrollments
  WHERE course_id = v_course_id AND student_id = v_student_id;
  
  IF v_enrollment_id IS NULL OR v_enrollment_status != 'active' THEN
    RAISE EXCEPTION 'Active enrollment required';
  END IF;
  
  v_can_learn := private.can_access_course(v_course_id, 'full');
  IF NOT v_can_learn THEN
    RAISE EXCEPTION 'Cannot access course content';
  END IF;
  
  INSERT INTO public.lesson_progress (enrollment_id, lesson_id, status, progress_percent)
  VALUES (v_enrollment_id, p_lesson_id, p_status, p_progress_percent)
  ON CONFLICT (enrollment_id, lesson_id) DO UPDATE
  SET status = EXCLUDED.status,
      progress_percent = EXCLUDED.progress_percent,
      updated_at = now()
  RETURNING row_to_json(lesson_progress.*) INTO v_updated;
  
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.get_academy_course_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_academy_course_catalog() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_academy_course_catalog() TO authenticated;

REVOKE ALL ON FUNCTION public.get_current_student_courses() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_student_courses() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_student_courses() TO authenticated;

REVOKE ALL ON FUNCTION public.get_academy_course_outline(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_academy_course_outline(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_academy_course_outline(text) TO authenticated;

REVOKE ALL ON FUNCTION public.enroll_current_student_in_course(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enroll_current_student_in_course(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.enroll_current_student_in_course(text) TO authenticated;

REVOKE ALL ON FUNCTION public.save_current_lesson_progress(uuid, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_current_lesson_progress(uuid, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_current_lesson_progress(uuid, text, numeric) TO authenticated;
