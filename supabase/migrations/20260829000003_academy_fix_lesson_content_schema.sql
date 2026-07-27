-- Fix get_academy_lesson_content to explicitly check ACCESS_BLOCKED and match schema

CREATE OR REPLACE FUNCTION public.get_academy_lesson_content(
  p_course_slug text,
  p_lesson_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course record;
  v_lesson record;
  v_content record;
  v_progress_status text;
  v_progress_percent numeric;
  v_last_position_seconds integer;
  v_decision jsonb;
  v_can_learn boolean;
  v_enrollment_id uuid;
  v_state text := 'NOT_FOUND';
  v_content_payload jsonb := null;
BEGIN
  IF v_uid IS NULL THEN 
    RETURN jsonb_build_object('state', 'ACCESS_DENIED'); 
  END IF;

  SELECT c.id, c.slug, c.title
  INTO v_course
  FROM public.courses c
  WHERE c.slug = p_course_slug AND c.status = 'published';

  IF v_course IS NULL THEN 
    RETURN jsonb_build_object('state', 'NOT_FOUND'); 
  END IF;

  SELECT l.id, l.title, l.description, l.type, l.duration, l.is_preview
  INTO v_lesson
  FROM public.lessons l
  JOIN public.course_modules m ON m.id = l.module_id
  WHERE l.id = p_lesson_id AND m.course_id = v_course.id AND l.status = 'published';

  IF v_lesson IS NULL THEN 
    RETURN jsonb_build_object('state', 'NOT_FOUND'); 
  END IF;

  v_decision := private.get_course_access_decision(v_course.id);
  
  IF NOT (v_decision->>'can_view')::boolean OR v_decision->>'reason' = 'ACCESS_BLOCKED' OR NOT (v_decision->>'can_learn')::boolean THEN
    RETURN jsonb_build_object('state', 'ACCESS_DENIED');
  END IF;

  v_can_learn := (v_decision->>'can_learn')::boolean;

  SELECT e.id INTO v_enrollment_id
  FROM public.enrollments e
  JOIN public.student_accounts sa ON sa.id = e.student_id
  WHERE e.course_id = v_course.id AND sa.user_id = v_uid AND e.status IN ('active', 'completed');

  IF NOT (v_can_learn OR v_lesson.is_preview) THEN
    RETURN jsonb_build_object(
      'state', 'ACCESS_DENIED',
      'course', jsonb_build_object('id', v_course.id, 'slug', v_course.slug, 'title', v_course.title),
      'lesson', jsonb_build_object('id', v_lesson.id, 'title', v_lesson.title, 'description', null, 'type', null, 'duration', v_lesson.duration, 'is_preview', v_lesson.is_preview),
      'access', jsonb_build_object('can_learn', v_can_learn, 'is_preview', v_lesson.is_preview),
      'content', null,
      'progress', null
    );
  END IF;

  v_state := 'AVAILABLE';

  SELECT id, content_type, content_markdown, provider, storage_bucket, storage_path, mime_type, original_filename
  INTO v_content
  FROM private.lesson_contents
  WHERE lesson_id = v_lesson.id;

  IF v_content IS NOT NULL THEN
    IF v_content.content_type IN ('video', 'document') THEN
      v_content_payload := jsonb_build_object(
        'kind', v_content.content_type,
        'media_ref', v_content.id
      );
    ELSE
      v_content_payload := jsonb_build_object(
        'kind', v_content.content_type,
        'body', v_content.content_markdown
      );
    END IF;
  END IF;

  IF v_enrollment_id IS NOT NULL THEN
    SELECT status, progress_percent, last_position_seconds
    INTO v_progress_status, v_progress_percent, v_last_position_seconds
    FROM public.lesson_progress
    WHERE enrollment_id = v_enrollment_id AND lesson_id = v_lesson.id;
  END IF;

  RETURN jsonb_build_object(
    'state', v_state,
    'course', jsonb_build_object('id', v_course.id, 'slug', v_course.slug, 'title', v_course.title),
    'lesson', jsonb_build_object('id', v_lesson.id, 'title', v_lesson.title, 'description', v_lesson.description, 'type', v_lesson.type, 'duration', v_lesson.duration, 'is_preview', v_lesson.is_preview),
    'access', jsonb_build_object('can_learn', v_can_learn, 'is_preview', v_lesson.is_preview),
    'content', v_content_payload,
    'progress', jsonb_build_object('status', COALESCE(v_progress_status, 'not_started'), 'percent', COALESCE(v_progress_percent, 0), 'last_position', COALESCE(v_last_position_seconds, 0))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_academy_lesson_content(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_academy_lesson_content(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_academy_lesson_content(text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
