-- 1. Add CHECK constraint on public.lessons.type
ALTER TABLE public.lessons 
  ADD CONSTRAINT chk_lesson_type 
  CHECK (type IN ('article', 'video', 'document', 'external_link'));

-- 2. Create private.lesson_contents
CREATE TABLE private.lesson_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('article', 'video', 'document', 'external_link')),
  content_markdown text,
  provider text CHECK (provider IN ('supabase_storage', 'external')),
  storage_bucket text,
  storage_path text,
  external_url text,
  mime_type text,
  original_filename text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_article_content CHECK (
    content_type != 'article' OR (
      content_markdown IS NOT NULL AND
      provider IS NULL AND
      storage_bucket IS NULL AND
      storage_path IS NULL AND
      external_url IS NULL
    )
  ),
  CONSTRAINT chk_video_document_content CHECK (
    content_type NOT IN ('video', 'document') OR (
      provider = 'supabase_storage' AND
      storage_bucket = 'academy-content' AND
      storage_path IS NOT NULL AND
      content_markdown IS NULL AND
      external_url IS NULL
    )
  ),
  CONSTRAINT chk_external_link_content CHECK (
    content_type != 'external_link' OR (
      provider = 'external' AND
      external_url IS NOT NULL AND
      external_url LIKE 'https://%' AND
      storage_bucket IS NULL AND
      storage_path IS NULL AND
      content_markdown IS NULL
    )
  )
);

CREATE OR REPLACE FUNCTION private.check_lesson_content_type_match()
RETURNS trigger AS $$
DECLARE
  v_lesson_type text;
BEGIN
  SELECT type INTO v_lesson_type FROM public.lessons WHERE id = NEW.lesson_id;
  IF v_lesson_type IS NULL THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  IF NEW.content_type != v_lesson_type THEN
    RAISE EXCEPTION 'private.lesson_contents.content_type must match public.lessons.type';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_check_lesson_content_type_match
  BEFORE INSERT OR UPDATE ON private.lesson_contents
  FOR EACH ROW EXECUTE FUNCTION private.check_lesson_content_type_match();

CREATE OR REPLACE FUNCTION public.check_lesson_type_update()
RETURNS trigger AS $$
DECLARE
  v_content_type text;
BEGIN
  IF OLD.type != NEW.type THEN
    SELECT content_type INTO v_content_type FROM private.lesson_contents WHERE lesson_id = NEW.id;
    IF v_content_type IS NOT NULL AND v_content_type != NEW.type THEN
      RAISE EXCEPTION 'Cannot change public.lessons.type while inconsistent content exists';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_check_lesson_type_update
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.check_lesson_type_update();

-- 3. Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academy-content',
  'academy-content',
  false,
  1048576000,
  ARRAY['video/mp4', 'video/webm', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 4. PUBLIC LESSON CONTENT RPC
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
  
  IF NOT (v_decision->>'can_view')::boolean THEN
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

  SELECT * INTO v_content FROM private.lesson_contents WHERE lesson_id = v_lesson.id;
  
  IF v_content IS NULL THEN
    v_state := 'CONTENT_NOT_CONFIGURED';
  ELSE
    IF v_content.content_type = 'article' THEN
      v_content_payload := jsonb_build_object(
        'kind', 'article',
        'markdown', v_content.content_markdown
      );
    ELSIF v_content.content_type IN ('video', 'document') THEN
      v_content_payload := jsonb_build_object(
        'kind', v_content.content_type,
        'media_ref', v_content.id,
        'mime_type', v_content.mime_type,
        'original_filename', v_content.original_filename
      );
    ELSIF v_content.content_type = 'external_link' THEN
      v_content_payload := jsonb_build_object(
        'kind', 'external_link',
        'url', v_content.external_url
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
    'course', jsonb_build_object(
      'id', v_course.id,
      'slug', v_course.slug,
      'title', v_course.title
    ),
    'lesson', jsonb_build_object(
      'id', v_lesson.id,
      'title', v_lesson.title,
      'description', v_lesson.description,
      'type', v_lesson.type,
      'duration', v_lesson.duration,
      'is_preview', v_lesson.is_preview
    ),
    'access', jsonb_build_object(
      'can_learn', v_can_learn,
      'is_preview', v_lesson.is_preview
    ),
    'content', v_content_payload,
    'progress', CASE WHEN v_progress_status IS NOT NULL THEN
      jsonb_build_object(
        'status', v_progress_status,
        'progress_percent', v_progress_percent,
        'last_position_seconds', v_last_position_seconds
      )
    ELSE null END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_academy_lesson_content(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_academy_lesson_content(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_academy_lesson_content(text, uuid) TO authenticated;

-- 5. SERVICE-ROLE MEDIA LOCATOR RPC
CREATE OR REPLACE FUNCTION public.get_academy_lesson_media_locator(
  p_content_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_content record;
BEGIN
  SELECT * INTO v_content FROM private.lesson_contents WHERE id = p_content_id;
  
  IF v_content IS NULL OR v_content.content_type NOT IN ('video', 'document') THEN
    RETURN null;
  END IF;

  RETURN jsonb_build_object(
    'content_id', v_content.id,
    'bucket', v_content.storage_bucket,
    'path', v_content.storage_path,
    'mime_type', v_content.mime_type,
    'original_filename', v_content.original_filename
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_academy_lesson_media_locator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_academy_lesson_media_locator(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_academy_lesson_media_locator(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_academy_lesson_media_locator(uuid) TO service_role;

-- 7. PROGRESS BACKWARD COMPATIBILITY
CREATE OR REPLACE FUNCTION public.save_current_lesson_progress(
  p_lesson_id uuid,
  p_status text,
  p_progress_percent numeric,
  p_last_position_seconds integer
) RETURNS jsonb
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
  v_duration integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  IF p_status NOT IN ('not_started', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  
  IF p_progress_percent < 0 OR p_progress_percent > 100 THEN
    RAISE EXCEPTION 'Invalid progress_percent';
  END IF;

  IF p_status = 'completed' AND p_progress_percent != 100 THEN
    RAISE EXCEPTION 'Completed status requires 100%% progress';
  END IF;

  IF p_last_position_seconds < 0 THEN
    RAISE EXCEPTION 'last_position_seconds must be positive';
  END IF;
  
  SELECT id INTO v_student_id FROM public.student_accounts WHERE user_id = v_uid;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'No student account'; END IF;
  
  SELECT c.id, l.duration INTO v_course_id, v_duration
  FROM public.lessons l
  JOIN public.course_modules m ON m.id = l.module_id
  JOIN public.courses c ON c.id = m.course_id
  WHERE l.id = p_lesson_id AND l.status = 'published';
  
  IF v_course_id IS NULL THEN RAISE EXCEPTION 'Lesson not found or inaccessible'; END IF;

  IF v_duration IS NOT NULL AND p_last_position_seconds > v_duration THEN
    RAISE EXCEPTION 'last_position_seconds cannot exceed lesson duration';
  END IF;
  
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
  
  INSERT INTO public.lesson_progress (enrollment_id, lesson_id, status, progress_percent, last_position_seconds)
  VALUES (v_enrollment_id, p_lesson_id, p_status, p_progress_percent, p_last_position_seconds)
  ON CONFLICT (enrollment_id, lesson_id) DO UPDATE
  SET status = EXCLUDED.status,
      progress_percent = EXCLUDED.progress_percent,
      last_position_seconds = EXCLUDED.last_position_seconds,
      updated_at = now()
  RETURNING row_to_json(lesson_progress.*) INTO v_updated;
  
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_current_lesson_progress(
  p_lesson_id uuid,
  p_status text,
  p_progress_percent numeric
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_existing_pos numeric := 0;
BEGIN
  SELECT last_position_seconds INTO v_existing_pos
  FROM public.lesson_progress lp
  JOIN public.enrollments e ON e.id = lp.enrollment_id
  JOIN public.student_accounts sa ON sa.id = e.student_id
  WHERE lp.lesson_id = p_lesson_id AND sa.user_id = auth.uid();

  RETURN public.save_current_lesson_progress(p_lesson_id, p_status, p_progress_percent, COALESCE(v_existing_pos::integer, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.save_current_lesson_progress(uuid, text, numeric, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_current_lesson_progress(uuid, text, numeric, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_current_lesson_progress(uuid, text, numeric, integer) TO authenticated;
