BEGIN;

SELECT plan(54);

-- Authorization
SELECT ok(NOT has_function_privilege('anon', 'public.admin_list_academy_courses(text, text)', 'execute'), 'anon cannot execute browser admin mutations');
SELECT ok(NOT has_function_privilege('authenticated', 'public.admin_create_academy_media_upload_session(uuid, uuid, text, text, bigint, text)', 'execute'), 'authenticated cannot execute internal RPCs');
SELECT ok(has_function_privilege('service_role', 'public.admin_create_academy_media_upload_session(uuid, uuid, text, text, bigint, text)', 'execute'), 'service_role can execute internal RPCs');
SELECT ok(has_function_privilege('authenticated', 'public.admin_list_academy_courses(text, text)', 'execute'), 'authenticated can execute browser RPCs');
SELECT ok(NOT has_function_privilege('public', 'public.admin_list_academy_courses(text, text)', 'execute'), 'PUBLIC does not retain execute permission on browser RPCs');
SELECT ok(NOT has_function_privilege('public', 'public.admin_finalize_academy_media_upload_session(uuid, uuid)', 'execute'), 'PUBLIC does not retain execute permission on internal RPCs');
SELECT ok(NOT has_function_privilege('anon', 'public.admin_cancel_academy_media_upload_session(uuid, uuid)', 'execute'), 'anon cannot execute cancel internal RPC');
SELECT ok(has_function_privilege('service_role', 'public.admin_cancel_academy_media_upload_session(uuid, uuid)', 'execute'), 'service_role can execute cancel internal RPC');
SELECT ok(NOT has_function_privilege('public', 'private.require_current_academy_content_admin()', 'execute'), 'PUBLIC cannot execute require_current_academy_content_admin');
SELECT ok(NOT has_function_privilege('anon', 'private.require_academy_content_admin_actor(uuid)', 'execute'), 'anon cannot execute require_academy_content_admin_actor');
SELECT ok(NOT has_function_privilege('authenticated', 'public.admin_finalize_academy_media_upload_session(uuid, uuid)', 'execute'), 'authenticated cannot execute finalize internal RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.admin_finalize_academy_media_upload_session(uuid, uuid)', 'execute'), 'anon cannot execute finalize internal RPC');

-- Function Existence
SELECT has_function('public', 'admin_list_academy_courses', ARRAY['text', 'text']);
SELECT has_function('public', 'admin_get_academy_course_editor', ARRAY['uuid']);
SELECT has_function('public', 'admin_create_academy_course', ARRAY['text', 'text', 'text', 'uuid', 'text', 'text', 'text', 'text']);
SELECT has_function('public', 'admin_update_academy_course', ARRAY['uuid', 'text', 'text', 'text', 'uuid', 'text', 'text', 'text', 'text']);
SELECT has_function('public', 'admin_create_academy_module', ARRAY['uuid', 'text']);
SELECT has_function('public', 'admin_update_academy_module', ARRAY['uuid', 'text']);
SELECT has_function('public', 'admin_reorder_academy_modules', ARRAY['uuid', 'uuid[]']);
SELECT has_function('public', 'admin_create_academy_lesson', ARRAY['uuid', 'text', 'text', 'text', 'boolean']);
SELECT has_function('public', 'admin_update_academy_lesson', ARRAY['uuid', 'text', 'text', 'boolean']);
SELECT has_function('public', 'admin_reorder_academy_lessons', ARRAY['uuid', 'uuid[]']);
SELECT has_function('public', 'admin_set_academy_article_content', ARRAY['uuid', 'text']);
SELECT has_function('public', 'admin_set_academy_external_link_content', ARRAY['uuid', 'text']);
SELECT has_function('public', 'admin_publish_academy_course', ARRAY['uuid']);
SELECT has_function('public', 'admin_unpublish_academy_course', ARRAY['uuid']);
SELECT has_function('public', 'admin_archive_academy_course', ARRAY['uuid']);
SELECT has_function('public', 'admin_create_academy_media_upload_session', ARRAY['uuid', 'uuid', 'text', 'text', 'bigint', 'text']);
SELECT has_function('public', 'admin_finalize_academy_media_upload_session', ARRAY['uuid', 'uuid']);
SELECT has_function('public', 'admin_cancel_academy_media_upload_session', ARRAY['uuid', 'uuid']);

-- Table Verification
SELECT has_table('private', 'academy_admin_audit_logs', 'academy_admin_audit_logs exists in private');
SELECT has_table('private', 'academy_media_upload_sessions', 'academy_media_upload_sessions exists in private');
SELECT has_pk('private', 'academy_admin_audit_logs', 'academy_admin_audit_logs has pk');
SELECT has_pk('private', 'academy_media_upload_sessions', 'academy_media_upload_sessions has pk');

-- Columns Verification
SELECT has_column('private', 'academy_media_upload_sessions', 'status', 'status exists');
SELECT has_column('private', 'academy_media_upload_sessions', 'content_type', 'content_type exists');
SELECT has_column('private', 'academy_media_upload_sessions', 'content_id', 'content_id exists');
SELECT has_column('private', 'academy_media_upload_sessions', 'object_path', 'object_path exists');
SELECT has_column('private', 'academy_media_upload_sessions', 'expected_mime_type', 'expected_mime_type exists');
SELECT has_column('private', 'academy_media_upload_sessions', 'expected_size_bytes', 'expected_size_bytes exists');
SELECT has_column('private', 'academy_admin_audit_logs', 'actor_user_id', 'actor_user_id exists');
SELECT has_column('private', 'academy_admin_audit_logs', 'actor_role', 'actor_role exists');
SELECT has_column('private', 'academy_admin_audit_logs', 'action', 'action exists');
SELECT has_column('private', 'academy_admin_audit_logs', 'entity_type', 'entity_type exists');

-- Index Verification
SELECT has_index('private', 'academy_admin_audit_logs', 'idx_academy_admin_audit_actor', 'actor index exists');
SELECT has_index('private', 'academy_admin_audit_logs', 'idx_academy_admin_audit_entity', 'entity index exists');
SELECT has_index('private', 'academy_admin_audit_logs', 'idx_academy_admin_audit_action', 'action index exists');
SELECT has_index('private', 'academy_media_upload_sessions', 'idx_academy_upload_lesson_status', 'upload lesson index exists');
SELECT has_index('private', 'academy_media_upload_sessions', 'idx_academy_upload_actor_status', 'upload actor index exists');
SELECT has_index('private', 'academy_media_upload_sessions', 'idx_academy_upload_expires_status', 'upload expires index exists');

-- Trigger Verification
SELECT has_trigger('private', 'academy_media_upload_sessions', 'trg_academy_media_upload_sessions_updated_at', 'updated_at trigger exists');
SELECT has_trigger('private', 'academy_media_upload_sessions', 'trg_academy_media_upload_session_transition', 'transition trigger exists');

-- State Machine Verification
SELECT throws_ok(
  $$
    DO $DO$
    DECLARE v_course_id uuid; v_module_id uuid; v_id uuid; v_session_id uuid;
    BEGIN
      INSERT INTO public.courses (title, slug, status, catalog_visibility, enrollment_policy, access_policy, pricing_model) VALUES ('D', 'd1', 'draft', 'private', 'closed', 'dynamic', 'included') RETURNING id INTO v_course_id;
      INSERT INTO public.course_modules (course_id, title, position) VALUES (v_course_id, 'D', 1) RETURNING id INTO v_module_id;
      INSERT INTO public.lessons (module_id, title, description, type, position, status) VALUES (v_module_id, 'Dummy', 'Dummy', 'video', 99, 'draft') RETURNING id INTO v_id;
      INSERT INTO private.academy_media_upload_sessions(actor_user_id, lesson_id, content_type, object_path, expected_mime_type, expected_size_bytes, original_filename, expires_at, status) VALUES ('00000000-0000-0000-0000-000000000000', v_id, 'video', 'test/path_1', 'video/mp4', 100, 'test.mp4', now() + interval '1 day', 'pending') RETURNING id INTO v_session_id;
      UPDATE private.academy_media_upload_sessions SET status = 'finalized' WHERE id = v_session_id;
    END $DO$;
  $$,
  'P0001',
  'INVALID_STATE_TRANSITION',
  'State machine rejects pending -> finalized'
);

SELECT lives_ok(
  $$
    DO $DO$
    DECLARE v_course_id uuid; v_module_id uuid; v_id uuid; v_session_id uuid;
    BEGIN
      INSERT INTO public.courses (title, slug, status, catalog_visibility, enrollment_policy, access_policy, pricing_model) VALUES ('D', 'd2', 'draft', 'private', 'closed', 'dynamic', 'included') RETURNING id INTO v_course_id;
      INSERT INTO public.course_modules (course_id, title, position) VALUES (v_course_id, 'D', 1) RETURNING id INTO v_module_id;
      INSERT INTO public.lessons (module_id, title, description, type, position, status) VALUES (v_module_id, 'Dummy', 'Dummy', 'video', 99, 'draft') RETURNING id INTO v_id;
      INSERT INTO private.academy_media_upload_sessions(actor_user_id, lesson_id, content_type, object_path, expected_mime_type, expected_size_bytes, original_filename, expires_at, status) VALUES ('00000000-0000-0000-0000-000000000000', v_id, 'video', 'test/path_2', 'video/mp4', 100, 'test.mp4', now() + interval '1 day', 'pending') RETURNING id INTO v_session_id;
      UPDATE private.academy_media_upload_sessions SET status = 'uploaded' WHERE id = v_session_id;
      UPDATE private.academy_media_upload_sessions SET status = 'finalized', finalized_at = now() WHERE id = v_session_id;
    END $DO$;
  $$,
  'State machine allows pending -> uploaded -> finalized'
);

SELECT * FROM finish(); ROLLBACK;