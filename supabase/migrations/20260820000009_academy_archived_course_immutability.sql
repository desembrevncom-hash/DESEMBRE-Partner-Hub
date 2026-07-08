-- 20260820000009_academy_archived_course_immutability.sql

-- ==========================================
-- 1. CENTRAL MUTABILITY HELPER
-- ==========================================

CREATE OR REPLACE FUNCTION private.require_mutable_academy_course(
  p_course_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  -- Lock the course row to prevent race conditions during mutation
  SELECT status INTO v_status
  FROM public.courses
  WHERE id = p_course_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  IF v_status = 'archived' THEN
    RAISE EXCEPTION 'COURSE_ARCHIVED';
  END IF;
END;
$$;

-- Protect internal helper from accidental public execution
REVOKE ALL ON FUNCTION private.require_mutable_academy_course(uuid) FROM PUBLIC, anon, authenticated;

-- ==========================================
-- 2. COURSE MUTATION HARDENING
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_update_academy_course(
  p_course_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_category_id uuid,
  p_catalog_visibility text,
  p_enrollment_policy text,
  p_access_policy text,
  p_pricing_model text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(p_course_id);

  IF trim(p_title) = '' THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;

  IF EXISTS (SELECT 1 FROM public.courses WHERE slug = p_slug AND id != p_course_id) THEN
    RAISE EXCEPTION 'DUPLICATE_SLUG';
  END IF;

  UPDATE public.courses SET
    title = p_title,
    slug = p_slug,
    description = p_description,
    category_id = p_category_id,
    catalog_visibility = p_catalog_visibility,
    enrollment_policy = p_enrollment_policy,
    access_policy = p_access_policy,
    pricing_model = p_pricing_model,
    updated_at = now()
  WHERE id = p_course_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'UPDATE_COURSE', 'course', p_course_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_academy_course(uuid, text, text, text, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_academy_course(uuid, text, text, text, uuid, text, text, text, text) TO authenticated;

-- ==========================================
-- 3. MODULE MUTATION HARDENING
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_create_academy_module(
  p_course_id uuid,
  p_title text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_module_id uuid;
  v_position integer;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(p_course_id);

  IF trim(p_title) = '' THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position FROM public.course_modules WHERE course_id = p_course_id;

  INSERT INTO public.course_modules (course_id, title, position)
  VALUES (p_course_id, p_title, v_position)
  RETURNING id INTO v_module_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'CREATE_MODULE', 'module', v_module_id);

  RETURN jsonb_build_object('id', v_module_id, 'position', v_position);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_academy_module(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_academy_module(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_academy_module(
  p_module_id uuid,
  p_title text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_course_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- Resolve canonical course ID
  SELECT course_id INTO v_course_id FROM public.course_modules WHERE id = p_module_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MODULE_NOT_FOUND';
  END IF;

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(v_course_id);

  IF trim(p_title) = '' THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;

  UPDATE public.course_modules SET title = p_title, updated_at = now() WHERE id = p_module_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'UPDATE_MODULE', 'module', p_module_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_academy_module(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_academy_module(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reorder_academy_modules(
  p_course_id uuid,
  p_module_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_existing_ids uuid[];
  v_id uuid;
  v_idx integer;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(p_course_id);

  SELECT array_agg(id) INTO v_existing_ids FROM public.course_modules WHERE course_id = p_course_id;

  IF v_existing_ids IS NULL THEN
    v_existing_ids := ARRAY[]::uuid[];
  END IF;

  IF cardinality(v_existing_ids) <> cardinality(p_module_ids) THEN
    RAISE EXCEPTION 'INVALID_REORDER_COUNT';
  END IF;

  IF NOT (v_existing_ids @> p_module_ids AND p_module_ids @> v_existing_ids) THEN
    RAISE EXCEPTION 'INVALID_REORDER_IDS';
  END IF;

  FOR v_idx IN 1..array_length(p_module_ids, 1) LOOP
    v_id := p_module_ids[v_idx];
    UPDATE public.course_modules SET position = v_idx, updated_at = now() WHERE id = v_id AND course_id = p_course_id;
  END LOOP;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'REORDER_MODULES', 'course', p_course_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reorder_academy_modules(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reorder_academy_modules(uuid, uuid[]) TO authenticated;

-- ==========================================
-- 4. LESSON MUTATION HARDENING
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_create_academy_lesson(
  p_module_id uuid,
  p_title text,
  p_type text,
  p_description text DEFAULT NULL,
  p_is_preview boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_course_id uuid;
  v_lesson_id uuid;
  v_position integer;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- Resolve canonical course ID
  SELECT course_id INTO v_course_id FROM public.course_modules WHERE id = p_module_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MODULE_NOT_FOUND';
  END IF;

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(v_course_id);

  IF trim(p_title) = '' THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;

  IF p_type NOT IN ('article', 'video', 'document', 'external_link') THEN
    RAISE EXCEPTION 'INVALID_LESSON_TYPE';
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position FROM public.lessons WHERE module_id = p_module_id;

  INSERT INTO public.lessons (module_id, title, description, type, position, is_preview, status)
  VALUES (p_module_id, p_title, p_description, p_type, v_position, p_is_preview, 'draft')
  RETURNING id INTO v_lesson_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'CREATE_LESSON', 'lesson', v_lesson_id);

  RETURN jsonb_build_object('id', v_lesson_id, 'position', v_position);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_academy_lesson(uuid, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_academy_lesson(uuid, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_academy_lesson(
  p_lesson_id uuid,
  p_title text,
  p_description text,
  p_is_preview boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_course_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- Resolve canonical course ID
  SELECT m.course_id INTO v_course_id
  FROM public.lessons l
  JOIN public.course_modules m ON l.module_id = m.id
  WHERE l.id = p_lesson_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LESSON_NOT_FOUND';
  END IF;

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(v_course_id);

  IF trim(p_title) = '' THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;

  UPDATE public.lessons SET
    title = p_title,
    description = p_description,
    is_preview = p_is_preview,
    updated_at = now()
  WHERE id = p_lesson_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'UPDATE_LESSON', 'lesson', p_lesson_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_academy_lesson(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_academy_lesson(uuid, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reorder_academy_lessons(
  p_module_id uuid,
  p_lesson_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_course_id uuid;
  v_existing_ids uuid[];
  v_id uuid;
  v_idx integer;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- Resolve canonical course ID
  SELECT course_id INTO v_course_id FROM public.course_modules WHERE id = p_module_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MODULE_NOT_FOUND';
  END IF;

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(v_course_id);

  SELECT array_agg(id) INTO v_existing_ids FROM public.lessons WHERE module_id = p_module_id;

  IF v_existing_ids IS NULL THEN
    v_existing_ids := ARRAY[]::uuid[];
  END IF;

  IF cardinality(v_existing_ids) <> cardinality(p_lesson_ids) THEN
    RAISE EXCEPTION 'INVALID_REORDER_COUNT';
  END IF;

  IF NOT (v_existing_ids @> p_lesson_ids AND p_lesson_ids @> v_existing_ids) THEN
    RAISE EXCEPTION 'INVALID_REORDER_IDS';
  END IF;

  FOR v_idx IN 1..array_length(p_lesson_ids, 1) LOOP
    v_id := p_lesson_ids[v_idx];
    UPDATE public.lessons SET position = v_idx, updated_at = now() WHERE id = v_id AND module_id = p_module_id;
  END LOOP;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'REORDER_LESSONS', 'module', p_module_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reorder_academy_lessons(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reorder_academy_lessons(uuid, uuid[]) TO authenticated;

-- ==========================================
-- 5. CONTENT MUTATION HARDENING
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_set_academy_article_content(
  p_lesson_id uuid,
  p_markdown text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_lesson_type text;
  v_course_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT l.type, m.course_id INTO v_lesson_type, v_course_id
  FROM public.lessons l
  JOIN public.course_modules m ON l.module_id = m.id
  WHERE l.id = p_lesson_id;

  IF v_lesson_type IS NULL THEN
    RAISE EXCEPTION 'LESSON_NOT_FOUND';
  END IF;

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(v_course_id);

  IF v_lesson_type <> 'article' THEN
    RAISE EXCEPTION 'INVALID_CONTENT_TYPE';
  END IF;

  IF length(trim(p_markdown)) = 0 THEN
    RAISE EXCEPTION 'INVALID_ARTICLE_CONTENT';
  END IF;

  INSERT INTO private.lesson_contents (lesson_id, content_type, content_markdown)
  VALUES (p_lesson_id, 'article', p_markdown)
  ON CONFLICT (lesson_id) DO UPDATE SET
    content_type = 'article',
    content_markdown = EXCLUDED.content_markdown,
    provider = NULL,
    storage_bucket = NULL,
    storage_path = NULL,
    external_url = NULL,
    updated_at = now();

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'SET_ARTICLE_CONTENT', 'lesson', p_lesson_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_academy_article_content(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_academy_article_content(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_academy_external_link_content(
  p_lesson_id uuid,
  p_url text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_lesson_type text;
  v_course_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT l.type, m.course_id INTO v_lesson_type, v_course_id
  FROM public.lessons l
  JOIN public.course_modules m ON l.module_id = m.id
  WHERE l.id = p_lesson_id;

  IF v_lesson_type IS NULL THEN
    RAISE EXCEPTION 'LESSON_NOT_FOUND';
  END IF;

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(v_course_id);

  IF v_lesson_type <> 'external_link' THEN
    RAISE EXCEPTION 'INVALID_CONTENT_TYPE';
  END IF;

  IF p_url NOT LIKE 'https://%' OR p_url ILIKE '%@%' OR p_url ILIKE 'javascript:%' THEN
    RAISE EXCEPTION 'INVALID_EXTERNAL_LINK';
  END IF;

  INSERT INTO private.lesson_contents (lesson_id, content_type, provider, external_url)
  VALUES (p_lesson_id, 'external_link', 'external', p_url)
  ON CONFLICT (lesson_id) DO UPDATE SET
    content_type = 'external_link',
    provider = 'external',
    external_url = EXCLUDED.external_url,
    content_markdown = NULL,
    storage_bucket = NULL,
    storage_path = NULL,
    updated_at = now();

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'SET_EXTERNAL_LINK', 'lesson', p_lesson_id, NULL, jsonb_build_object('url', p_url));

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_academy_external_link_content(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_academy_external_link_content(uuid, text) TO authenticated;

-- ==========================================
-- 6. MEDIA LIFECYCLE HARDENING
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_create_academy_media_upload_session(
  p_actor_user_id uuid,
  p_lesson_id uuid,
  p_content_type text,
  p_mime_type text,
  p_size_bytes bigint,
  p_original_filename text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_session_id uuid;
  v_course_id uuid;
  v_path text;
  v_ext text;
  v_expires_in integer := 600; -- 10 minutes
BEGIN
  -- Authenticate via internal helper
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role
  FROM private.require_academy_content_admin_actor(p_actor_user_id);

  IF p_content_type NOT IN ('video', 'document') THEN
    RAISE EXCEPTION 'INVALID_CONTENT_TYPE';
  END IF;

  IF p_content_type = 'video' AND p_mime_type NOT IN ('video/mp4', 'video/webm') THEN
    RAISE EXCEPTION 'INVALID_MIME_TYPE';
  END IF;

  IF p_content_type = 'document' AND p_mime_type <> 'application/pdf' THEN
    RAISE EXCEPTION 'INVALID_MIME_TYPE';
  END IF;

  IF p_size_bytes <= 0 OR (p_content_type = 'video' AND p_size_bytes > 1048576000) OR (p_content_type = 'document' AND p_size_bytes > 52428800) THEN
    RAISE EXCEPTION 'INVALID_FILE_SIZE';
  END IF;

  SELECT m.course_id INTO v_course_id
  FROM public.lessons l
  JOIN public.course_modules m ON l.module_id = m.id
  WHERE l.id = p_lesson_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LESSON_NOT_FOUND';
  END IF;

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(v_course_id);

  v_ext := split_part(p_mime_type, '/', 2);
  v_session_id := gen_random_uuid();
  v_path := 'courses/' || v_course_id || '/lessons/' || p_lesson_id || '/uploads/' || v_session_id || '.' || v_ext;

  INSERT INTO private.academy_media_upload_sessions (
    id, actor_user_id, lesson_id, content_id, content_type, object_path, expected_mime_type, expected_size_bytes, original_filename, status, expires_at
  ) VALUES (
    v_session_id, v_actor_id, p_lesson_id, NULL, p_content_type, v_path, p_mime_type, p_size_bytes, p_original_filename, 'pending', now() + (v_expires_in || ' seconds')::interval
  );

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'CREATE_UPLOAD_SESSION', 'upload_session', v_session_id);

  RETURN jsonb_build_object(
    'uploadSessionId', v_session_id,
    'objectPath', v_path,
    'expiresIn', v_expires_in
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_academy_media_upload_session(uuid, uuid, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_academy_media_upload_session(uuid, uuid, text, text, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_finalize_academy_media_upload_session(
  p_actor_user_id uuid,
  p_upload_session_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_session record;
  v_content_id uuid;
  v_course_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role
  FROM private.require_academy_content_admin_actor(p_actor_user_id);

  SELECT s.*, m.course_id INTO v_session
  FROM private.academy_media_upload_sessions s
  JOIN public.lessons l ON s.lesson_id = l.id
  JOIN public.course_modules m ON l.module_id = m.id
  WHERE s.id = p_upload_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  -- HARDENING: Enforce mutability and lock course row
  PERFORM private.require_mutable_academy_course(v_session.course_id);

  IF v_session.status IN ('finalized', 'cancelled', 'expired', 'failed') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION';
  END IF;

  IF v_session.status = 'pending' THEN
    UPDATE private.academy_media_upload_sessions SET status = 'uploaded', updated_at = now() WHERE id = p_upload_session_id;
  END IF;

  IF v_session.expires_at < now() THEN
    UPDATE private.academy_media_upload_sessions SET status = 'expired', updated_at = now() WHERE id = p_upload_session_id;
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;

  -- Upsert private.lesson_contents
  INSERT INTO private.lesson_contents (lesson_id, content_type, provider, storage_bucket, storage_path, mime_type, original_filename)
  VALUES (v_session.lesson_id, v_session.content_type, 'supabase_storage', 'academy-content', v_session.object_path, v_session.expected_mime_type, v_session.original_filename)
  ON CONFLICT (lesson_id) DO UPDATE SET
    content_type = EXCLUDED.content_type,
    provider = EXCLUDED.provider,
    storage_bucket = EXCLUDED.storage_bucket,
    storage_path = EXCLUDED.storage_path,
    mime_type = EXCLUDED.mime_type,
    original_filename = EXCLUDED.original_filename,
    content_markdown = NULL,
    external_url = NULL,
    updated_at = now()
  RETURNING id INTO v_content_id;

  UPDATE private.academy_media_upload_sessions SET
    status = 'finalized',
    finalized_at = now(),
    content_id = v_content_id,
    updated_at = now()
  WHERE id = p_upload_session_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'FINALIZE_UPLOAD', 'upload_session', p_upload_session_id);

  RETURN jsonb_build_object(
    'success', true,
    'status', 'finalized',
    'content', jsonb_build_object(
      'kind', v_session.content_type,
      'mimeType', v_session.expected_mime_type,
      'originalFilename', v_session.original_filename
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_finalize_academy_media_upload_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_academy_media_upload_session(uuid, uuid) TO service_role;

-- NOTE: admin_cancel_academy_media_upload_session intentionally does NOT enforce require_mutable_academy_course.
-- This allows cancellation to proceed as a cleanup operation for pending upload sessions even if the course has since been archived.

-- ==========================================
-- 7. STATUS TRANSITIONS HARDENING
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_publish_academy_course(
  p_course_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_course record;
  v_validation_errors jsonb := '[]'::jsonb;
  v_mod_count integer;
  v_les_count integer;
  v_invalid_modules boolean;
  v_invalid_lessons boolean;
  v_invalid_contents boolean;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- HARDENING: Lock row and ensure mutable to reject archived -> published
  PERFORM private.require_mutable_academy_course(p_course_id);

  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;

  IF v_course.status = 'published' THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF trim(v_course.title) = '' THEN
    v_validation_errors := v_validation_errors || jsonb_build_object('code', 'MISSING_TITLE', 'message', 'Course title is empty');
  END IF;

  IF trim(v_course.slug) = '' THEN
    v_validation_errors := v_validation_errors || jsonb_build_object('code', 'MISSING_SLUG', 'message', 'Course slug is empty');
  END IF;

  SELECT count(*) INTO v_mod_count FROM public.course_modules WHERE course_id = p_course_id;
  IF v_mod_count = 0 THEN
    v_validation_errors := v_validation_errors || jsonb_build_object('code', 'NO_MODULES', 'message', 'Course has no modules');
  END IF;

  SELECT count(*) INTO v_les_count
  FROM public.lessons l
  JOIN public.course_modules m ON l.module_id = m.id
  WHERE m.course_id = p_course_id;

  IF v_les_count = 0 THEN
    v_validation_errors := v_validation_errors || jsonb_build_object('code', 'NO_LESSONS', 'message', 'Course has no lessons');
  END IF;

  -- Contiguous checks
  SELECT bool_or(position <> row_num) INTO v_invalid_modules
  FROM (
    SELECT position, row_number() over (order by position) as row_num
    FROM public.course_modules WHERE course_id = p_course_id
  ) t;

  IF COALESCE(v_invalid_modules, false) THEN
    v_validation_errors := v_validation_errors || jsonb_build_object('code', 'NON_CONTIGUOUS_MODULES', 'message', 'Module positions are not contiguous starting at 1');
  END IF;

  SELECT bool_or(position <> row_num) INTO v_invalid_lessons
  FROM (
    SELECT l.position, row_number() over (partition by l.module_id order by l.position) as row_num
    FROM public.lessons l JOIN public.course_modules m ON l.module_id = m.id WHERE m.course_id = p_course_id
  ) t;

  IF COALESCE(v_invalid_lessons, false) THEN
    v_validation_errors := v_validation_errors || jsonb_build_object('code', 'NON_CONTIGUOUS_LESSONS', 'message', 'Lesson positions are not contiguous starting at 1');
  END IF;

  -- Content checks
  SELECT bool_or(
    lc.id IS NULL OR
    (l.type = 'article' AND length(trim(COALESCE(lc.content_markdown, ''))) = 0) OR
    (l.type IN ('video', 'document') AND (lc.provider <> 'supabase_storage' OR lc.storage_bucket <> 'academy-content' OR length(trim(COALESCE(lc.storage_path, ''))) = 0)) OR
    (l.type = 'external_link' AND (lc.external_url NOT LIKE 'https://%' OR lc.provider <> 'external')) OR
    (l.type <> lc.content_type)
  ) INTO v_invalid_contents
  FROM public.lessons l
  JOIN public.course_modules m ON l.module_id = m.id
  LEFT JOIN private.lesson_contents lc ON lc.lesson_id = l.id
  WHERE m.course_id = p_course_id;

  IF COALESCE(v_invalid_contents, false) THEN
    v_validation_errors := v_validation_errors || jsonb_build_object('code', 'INVALID_CONTENT', 'message', 'One or more lessons have missing or invalid content');
  END IF;

  IF jsonb_array_length(v_validation_errors) > 0 THEN
    RAISE EXCEPTION 'PUBLISH_VALIDATION_FAILED: %', v_validation_errors::text;
  END IF;

  UPDATE public.courses SET status = 'published', updated_at = now() WHERE id = p_course_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'PUBLISH_COURSE', 'course', p_course_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_publish_academy_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_academy_course(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unpublish_academy_course(
  p_course_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_course record;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- HARDENING: Lock row and ensure mutable to reject archived -> draft
  PERFORM private.require_mutable_academy_course(p_course_id);

  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;

  IF v_course.status <> 'published' THEN
    RAISE EXCEPTION 'COURSE_NOT_PUBLISHED';
  END IF;

  UPDATE public.courses SET status = 'draft', updated_at = now() WHERE id = p_course_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'UNPUBLISH_COURSE', 'course', p_course_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_unpublish_academy_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unpublish_academy_course(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_archive_academy_course(
  p_course_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  -- HARDENING: Lock row and ensure mutable to reject duplicate archive
  PERFORM private.require_mutable_academy_course(p_course_id);

  UPDATE public.courses SET status = 'archived', updated_at = now() WHERE id = p_course_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'ARCHIVE_COURSE', 'course', p_course_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_archive_academy_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_academy_course(uuid) TO authenticated;
