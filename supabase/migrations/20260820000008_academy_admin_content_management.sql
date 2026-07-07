-- 20260820000008_academy_admin_content_management.sql

-- ==========================================
-- 1. PRIVATE ADMIN AUDIT LOGS
-- ==========================================

CREATE TABLE private.academy_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_role public.app_role NOT NULL,
  action text NOT NULL CHECK (trim(action) <> ''),
  entity_type text NOT NULL CHECK (trim(entity_type) <> ''),
  entity_id uuid,
  before_snapshot jsonb,
  after_snapshot jsonb,
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_academy_admin_audit_actor ON private.academy_admin_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_academy_admin_audit_entity ON private.academy_admin_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_academy_admin_audit_action ON private.academy_admin_audit_logs(action, created_at DESC);

-- Enable RLS and deny all direct access
ALTER TABLE private.academy_admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.academy_admin_audit_logs FORCE ROW LEVEL SECURITY;
-- No policies defined means default deny all

-- Private helper to write audit logs
CREATE OR REPLACE FUNCTION private.write_academy_admin_audit(
  p_actor_user_id uuid,
  p_actor_role public.app_role,
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_before_snapshot jsonb DEFAULT NULL,
  p_after_snapshot jsonb DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.academy_admin_audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, before_snapshot, after_snapshot, request_id
  ) VALUES (
    p_actor_user_id, p_actor_role, p_action, p_entity_type, p_entity_id, p_before_snapshot, p_after_snapshot, p_request_id
  );
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'AUDIT_WRITE_FAILED';
END;
$$;

-- ==========================================
-- 2. PRIVATE MEDIA UPLOAD SESSIONS
-- ==========================================

CREATE TABLE private.academy_media_upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content_id uuid REFERENCES private.lesson_contents(id) ON DELETE SET NULL,
  content_type text NOT NULL CHECK (content_type IN ('video', 'document')),
  object_path text NOT NULL UNIQUE,
  expected_mime_type text NOT NULL,
  expected_size_bytes bigint NOT NULL CHECK (expected_size_bytes > 0),
  original_filename text NOT NULL CHECK (trim(original_filename) <> ''),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'finalized', 'expired', 'cancelled', 'failed')),
  expires_at timestamptz NOT NULL,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_expires_future CHECK (expires_at > created_at),
  CONSTRAINT chk_finalized_time CHECK (status != 'finalized' OR finalized_at IS NOT NULL)
);

CREATE INDEX idx_academy_upload_lesson_status ON private.academy_media_upload_sessions(lesson_id, status);
CREATE INDEX idx_academy_upload_actor_status ON private.academy_media_upload_sessions(actor_user_id, status);
CREATE INDEX idx_academy_upload_expires_status ON private.academy_media_upload_sessions(expires_at, status);

-- Enable RLS and deny all direct access
ALTER TABLE private.academy_media_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.academy_media_upload_sessions FORCE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER trg_academy_media_upload_sessions_updated_at
  BEFORE UPDATE ON private.academy_media_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==========================================
-- 3. AUTHORIZATION HELPERS
-- ==========================================

CREATE OR REPLACE FUNCTION private.require_current_academy_content_admin(
  OUT actor_id uuid,
  OUT actor_role public.app_role
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.app_role;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT role::public.app_role INTO v_role
  FROM public.user_roles
  WHERE user_id = v_uid
    AND role IN ('admin', 'sub_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  actor_id := v_uid;
  actor_role := v_role;
END;
$$;

CREATE OR REPLACE FUNCTION private.require_academy_content_admin_actor(
  p_actor_user_id uuid,
  OUT actor_id uuid,
  OUT actor_role public.app_role
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT role::public.app_role INTO v_role
  FROM public.user_roles
  WHERE user_id = p_actor_user_id
    AND role IN ('admin', 'sub_admin')
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  actor_id := p_actor_user_id;
  actor_role := v_role;
END;
$$;

-- Protect internal helpers from accidental public execution
REVOKE ALL ON FUNCTION private.require_current_academy_content_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.require_academy_content_admin_actor(uuid) FROM PUBLIC, anon, authenticated;
-- ==========================================
-- 4. ADMIN COURSE RPCS
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_list_academy_courses(
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
      'id', c.id,
      'title', c.title,
      'slug', c.slug,
      'status', c.status,
      'catalog_visibility', c.catalog_visibility,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ) ORDER BY c.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.courses c
  WHERE (p_status IS NULL OR c.status = p_status)
    AND (p_search IS NULL OR c.title ILIKE '%' || p_search || '%');

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_academy_courses(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_academy_courses(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_academy_course_editor(
  p_course_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_result jsonb;
  v_course record;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT c.*, cat.name as category_name
  INTO v_course
  FROM public.courses c
  LEFT JOIN public.course_categories cat ON c.category_id = cat.id
  WHERE c.id = p_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  SELECT jsonb_build_object(
    'course', jsonb_build_object(
      'id', v_course.id,
      'title', v_course.title,
      'slug', v_course.slug,
      'description', v_course.description,
      'status', v_course.status,
      'catalog_visibility', v_course.catalog_visibility,
      'enrollment_policy', v_course.enrollment_policy,
      'access_policy', v_course.access_policy,
      'pricing_model', v_course.pricing_model,
      'category', CASE WHEN v_course.category_id IS NOT NULL THEN
        jsonb_build_object('id', v_course.category_id, 'name', v_course.category_name)
      ELSE NULL END
    ),
    'modules', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', cm.id,
          'title', cm.title,
          'position', cm.position,
          'lessons', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', l.id,
                'title', l.title,
                'description', l.description,
                'type', l.type,
                'position', l.position,
                'is_preview', l.is_preview,
                'content_status', CASE
                  WHEN lc.id IS NULL THEN 'missing'
                  WHEN l.type IN ('video', 'document') THEN
                    CASE
                      WHEN lc.storage_path IS NOT NULL THEN 'ready'
                      ELSE 'configured'
                    END
                  ELSE 'ready'
                END,
                'content', CASE
                  WHEN l.type = 'article' AND lc.content_markdown IS NOT NULL THEN jsonb_build_object('markdown', lc.content_markdown)
                  WHEN l.type = 'external_link' AND lc.external_url IS NOT NULL THEN jsonb_build_object('url', lc.external_url)
                  WHEN l.type IN ('video', 'document') AND lc.id IS NOT NULL THEN jsonb_build_object('original_filename', lc.original_filename)
                  ELSE NULL
                END
              ) ORDER BY l.position ASC
            )
            FROM public.lessons l
            LEFT JOIN private.lesson_contents lc ON lc.lesson_id = l.id
            WHERE l.module_id = cm.id
          ), '[]'::jsonb)
        ) ORDER BY cm.position ASC
      )
      FROM public.course_modules cm
      WHERE cm.course_id = p_course_id
    ), '[]'::jsonb),
    'publish_validation', jsonb_build_object('can_publish', false, 'errors', '[]'::jsonb) -- Will be evaluated during publish logic or an explicitly requested endpoint
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_academy_course_editor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_academy_course_editor(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_academy_course(
  p_title text,
  p_slug text,
  p_description text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_catalog_visibility text DEFAULT 'private',
  p_enrollment_policy text DEFAULT 'closed',
  p_access_policy text DEFAULT 'dynamic',
  p_pricing_model text DEFAULT 'included'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_course_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  IF trim(p_title) = '' THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;

  IF EXISTS (SELECT 1 FROM public.courses WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'DUPLICATE_SLUG';
  END IF;

  INSERT INTO public.courses (
    title, slug, description, category_id, status, catalog_visibility, enrollment_policy, access_policy, pricing_model
  ) VALUES (
    p_title, p_slug, p_description, p_category_id, 'draft', p_catalog_visibility, p_enrollment_policy, p_access_policy, p_pricing_model
  ) RETURNING id INTO v_course_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'CREATE_COURSE', 'course', v_course_id, NULL, jsonb_build_object('title', p_title, 'slug', p_slug));

  RETURN jsonb_build_object('id', v_course_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_academy_course(text, text, text, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_academy_course(text, text, text, uuid, text, text, text, text) TO authenticated;

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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'UPDATE_COURSE', 'course', p_course_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_academy_course(uuid, text, text, text, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_academy_course(uuid, text, text, text, uuid, text, text, text, text) TO authenticated;
-- ==========================================
-- 5. ADMIN MODULE RPCS
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
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  IF trim(p_title) = '' THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;

  UPDATE public.course_modules SET title = p_title, updated_at = now() WHERE id = p_module_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MODULE_NOT_FOUND';
  END IF;

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
-- 6. ADMIN LESSON RPCS
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
  v_lesson_id uuid;
  v_position integer;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

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
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  IF trim(p_title) = '' THEN
    RAISE EXCEPTION 'INVALID_TITLE';
  END IF;

  UPDATE public.lessons SET
    title = p_title,
    description = p_description,
    is_preview = p_is_preview,
    updated_at = now()
  WHERE id = p_lesson_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LESSON_NOT_FOUND';
  END IF;

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
  v_existing_ids uuid[];
  v_id uuid;
  v_idx integer;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

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
-- 7. ADMIN LESSON CONTENT RPCS
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
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT type INTO v_lesson_type FROM public.lessons WHERE id = p_lesson_id;
  IF v_lesson_type IS NULL THEN
    RAISE EXCEPTION 'LESSON_NOT_FOUND';
  END IF;

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
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  SELECT type INTO v_lesson_type FROM public.lessons WHERE id = p_lesson_id;
  IF v_lesson_type IS NULL THEN
    RAISE EXCEPTION 'LESSON_NOT_FOUND';
  END IF;

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
-- 8. COURSE STATE RPCS
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

  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  IF v_course.status = 'published' THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF v_course.status = 'archived' THEN
    RAISE EXCEPTION 'CANNOT_PUBLISH_ARCHIVED';
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

  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

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

  UPDATE public.courses SET status = 'archived', updated_at = now() WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'ARCHIVE_COURSE', 'course', p_course_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_archive_academy_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_academy_course(uuid) TO authenticated;
-- ==========================================
-- 9. INTERNAL MEDIA RPCS (FOR EDGE FUNCTION)
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
-- No explicit GRANT means only service_role (and superuser) can execute

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
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role
  FROM private.require_academy_content_admin_actor(p_actor_user_id);

  SELECT * INTO v_session FROM private.academy_media_upload_sessions WHERE id = p_upload_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

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

CREATE OR REPLACE FUNCTION public.admin_cancel_academy_media_upload_session(
  p_actor_user_id uuid,
  p_upload_session_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_session record;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role
  FROM private.require_academy_content_admin_actor(p_actor_user_id);

  SELECT * INTO v_session FROM private.academy_media_upload_sessions WHERE id = p_upload_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  IF v_session.status IN ('finalized', 'cancelled', 'expired', 'failed') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION';
  END IF;

  UPDATE private.academy_media_upload_sessions SET
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_upload_session_id;

  PERFORM private.write_academy_admin_audit(v_actor_id, v_actor_role, 'CANCEL_UPLOAD', 'upload_session', p_upload_session_id);

  RETURN jsonb_build_object(
    'success', true,
    'status', 'cancelled'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_cancel_academy_media_upload_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_academy_media_upload_session(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION private.write_academy_admin_audit(uuid, public.app_role, text, text, uuid, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- ==========================================
-- STATE MACHINE TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION private.enforce_academy_media_upload_session_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status NOT IN ('uploaded', 'cancelled', 'expired', 'failed') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION';
  END IF;
  IF OLD.status = 'uploaded' AND NEW.status NOT IN ('finalized', 'cancelled', 'failed') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION';
  END IF;
  IF OLD.status IN ('finalized', 'cancelled', 'expired', 'failed') AND NEW.status != OLD.status THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_academy_media_upload_session_transition ON private.academy_media_upload_sessions;
CREATE TRIGGER trg_academy_media_upload_session_transition
  BEFORE UPDATE OF status ON private.academy_media_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION private.enforce_academy_media_upload_session_transition();
