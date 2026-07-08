BEGIN;

SELECT plan(72);

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




-- ==========================================
-- ARCHIVED COURSE IMMUTABILITY TESTS
-- ==========================================

DO $$
DECLARE
  v_admin_uid uuid;
  v_sub_admin_uid uuid;
  v_student_uid uuid := '00000000-0000-0000-0000-000000000003';
  v_sale_uid uuid := '00000000-0000-0000-0000-000000000004';

  v_archived_course_id uuid := '10000000-0000-0000-0000-000000000001';
  v_draft_course_id uuid := '10000000-0000-0000-0000-000000000002';
  v_archived_module_id uuid := '20000000-0000-0000-0000-000000000001';
  v_archived_lesson_article uuid := '30000000-0000-0000-0000-000000000001';
  v_archived_lesson_ext uuid := '30000000-0000-0000-0000-000000000002';
  v_archived_lesson_video uuid := '30000000-0000-0000-0000-000000000003';
  v_archived_session_id uuid := '40000000-0000-0000-0000-000000000001';

BEGIN
  SELECT user_id INTO v_admin_uid FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF v_admin_uid IS NULL THEN
    v_admin_uid := '00000000-0000-0000-0000-000000000001';
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES (v_admin_uid, 'admin@test.com', '', now()) ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_admin_uid, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  SELECT user_id INTO v_sub_admin_uid FROM public.user_roles WHERE role = 'sub_admin' LIMIT 1;
  IF v_sub_admin_uid IS NULL THEN
    v_sub_admin_uid := '00000000-0000-0000-0000-000000000002';
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES (v_sub_admin_uid, 'subadmin@test.com', '', now()) ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_sub_admin_uid, 'sub_admin') ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES
    (v_student_uid, 'student@test.com', '', now()),
    (v_sale_uid, 'sale@test.com', '', now())
  ON CONFLICT (id) DO NOTHING;

  -- Create Archived Course
  INSERT INTO public.courses (id, title, slug, status, catalog_visibility, enrollment_policy, access_policy, pricing_model)
  VALUES (v_archived_course_id, 'Archived Course', 'archived-course', 'archived', 'private', 'closed', 'dynamic', 'free')
  ON CONFLICT DO NOTHING;

  -- Create Draft Course
  INSERT INTO public.courses (id, title, slug, status, catalog_visibility, enrollment_policy, access_policy, pricing_model)
  VALUES (v_draft_course_id, 'Draft Course', 'draft-course', 'draft', 'private', 'closed', 'dynamic', 'free')
  ON CONFLICT DO NOTHING;

  -- Create Module in Archived Course
  INSERT INTO public.course_modules (id, course_id, title, position)
  VALUES (v_archived_module_id, v_archived_course_id, 'Module 1', 1)
  ON CONFLICT DO NOTHING;

  -- Create Lessons
  INSERT INTO public.lessons (id, module_id, title, type, position, status) VALUES
    (v_archived_lesson_article, v_archived_module_id, 'Article', 'article', 1, 'draft'),
    (v_archived_lesson_ext, v_archived_module_id, 'Ext Link', 'external_link', 2, 'draft'),
    (v_archived_lesson_video, v_archived_module_id, 'Video', 'video', 3, 'draft')
  ON CONFLICT DO NOTHING;

  -- Create Media Session for Video
  INSERT INTO private.academy_media_upload_sessions (id, actor_user_id, lesson_id, content_type, object_path, expected_mime_type, expected_size_bytes, original_filename, status, expires_at)
  VALUES (v_archived_session_id, v_admin_uid, v_archived_lesson_video, 'video', 'test/path.mp4', 'video/mp4', 100, 'test.mp4', 'pending', now() + interval '1 day')
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.admin_uid', v_admin_uid::text, true);
END;
$$;

-- Login as Admin
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('app.admin_uid'))::text, true);

-- Clear audit logs to ensure clean state
DELETE FROM private.academy_admin_audit_logs;

-- 1. Test update course
PREPARE test_update AS SELECT public.admin_update_academy_course('10000000-0000-0000-0000-000000000001', 'T', 'S', '', null, 'private', 'closed', 'dynamic', 'free');
SELECT throws_ok('test_update', 'COURSE_ARCHIVED', '1. Reject update archived course');

-- 2. Test create module
PREPARE test_create_mod AS SELECT public.admin_create_academy_module('10000000-0000-0000-0000-000000000001', 'M2');
SELECT throws_ok('test_create_mod', 'COURSE_ARCHIVED', '2. Reject create module in archived course');

-- 3. Test update module
PREPARE test_update_mod AS SELECT public.admin_update_academy_module('20000000-0000-0000-0000-000000000001', 'M2');
SELECT throws_ok('test_update_mod', 'COURSE_ARCHIVED', '3. Reject update module in archived course');

-- 4. Test reorder modules
PREPARE test_reorder_mod AS SELECT public.admin_reorder_academy_modules('10000000-0000-0000-0000-000000000001', ARRAY['20000000-0000-0000-0000-000000000001'::uuid]);
SELECT throws_ok('test_reorder_mod', 'COURSE_ARCHIVED', '4. Reject reorder modules in archived course');

-- 5. Test create lesson
PREPARE test_create_lesson AS SELECT public.admin_create_academy_lesson('20000000-0000-0000-0000-000000000001', 'L', 'article');
SELECT throws_ok('test_create_lesson', 'COURSE_ARCHIVED', '5. Reject create lesson in archived course');

-- 6. Test update lesson
PREPARE test_update_lesson AS SELECT public.admin_update_academy_lesson('30000000-0000-0000-0000-000000000001', 'L', '', false);
SELECT throws_ok('test_update_lesson', 'COURSE_ARCHIVED', '6. Reject update lesson in archived course');

-- 7. Test reorder lessons
PREPARE test_reorder_lesson AS SELECT public.admin_reorder_academy_lessons('20000000-0000-0000-0000-000000000001', ARRAY['30000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, '30000000-0000-0000-0000-000000000003'::uuid]);
SELECT throws_ok('test_reorder_lesson', 'COURSE_ARCHIVED', '7. Reject reorder lessons in archived course');

-- 8. Test set article content
PREPARE test_set_article AS SELECT public.admin_set_academy_article_content('30000000-0000-0000-0000-000000000001', '# Hello');
SELECT throws_ok('test_set_article', 'COURSE_ARCHIVED', '8. Reject set article content in archived course');

-- 9. Test set external link content
PREPARE test_set_ext AS SELECT public.admin_set_academy_external_link_content('30000000-0000-0000-0000-000000000002', 'https://example.com');
SELECT throws_ok('test_set_ext', 'COURSE_ARCHIVED', '9. Reject set external link content in archived course');

-- 10. Test publish archived
PREPARE test_pub_arch AS SELECT public.admin_publish_academy_course('10000000-0000-0000-0000-000000000001');
SELECT throws_ok('test_pub_arch', 'COURSE_ARCHIVED', '12. Reject publish archived course');

-- 11. Test unpublish archived
PREPARE test_unpub_arch AS SELECT public.admin_unpublish_academy_course('10000000-0000-0000-0000-000000000001');
SELECT throws_ok('test_unpub_arch', 'COURSE_ARCHIVED', '13. Reject unpublish archived course');

-- 12. Test duplicate archive
PREPARE test_dup_arch AS SELECT public.admin_archive_academy_course('10000000-0000-0000-0000-000000000001');
SELECT throws_ok('test_dup_arch', 'COURSE_ARCHIVED', '14. Reject duplicate archive');

-- Now the internal media functions which run as service_role. We need to mock service_role.
SELECT set_config('role', 'service_role', true);

-- 13. Test create media upload session
PREPARE test_create_media AS SELECT public.admin_create_academy_media_upload_session(current_setting('app.admin_uid')::uuid, '30000000-0000-0000-0000-000000000003', 'video', 'video/mp4', 100, 'test.mp4');
SELECT throws_ok('test_create_media', 'COURSE_ARCHIVED', '10. Reject create media upload session in archived course');

-- 14. Test finalize media upload session
PREPARE test_finalize_media AS SELECT public.admin_finalize_academy_media_upload_session(current_setting('app.admin_uid')::uuid, '40000000-0000-0000-0000-000000000001');
SELECT throws_ok('test_finalize_media', 'COURSE_ARCHIVED', '11. Reject finalize media upload session in archived course');

-- 15. Cancel valid non-terminal upload session after archive succeeds
SELECT lives_ok($$ SELECT public.admin_cancel_academy_media_upload_session(current_setting('app.admin_uid')::uuid, '40000000-0000-0000-0000-000000000001'); $$, '15. cancel valid non-terminal upload session after archive succeeds');

-- 16. Cancel terminal session fails
PREPARE test_cancel_terminal AS SELECT public.admin_cancel_academy_media_upload_session(current_setting('app.admin_uid')::uuid, '40000000-0000-0000-0000-000000000001');
SELECT throws_ok('test_cancel_terminal', 'INVALID_STATE_TRANSITION', '16. cancel terminal session fails');

-- Revert to admin for next tests
SELECT set_config('role', 'postgres', true);
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('app.admin_uid'))::text, true);

-- Verify no success audit log created for rejected mutations
SELECT is(
  (SELECT COUNT(*) FROM private.academy_admin_audit_logs WHERE action NOT IN ('CANCEL_UPLOAD')),
  0::bigint,
  'Assert no success audit log is created for rejected mutations'
);

-- Prove draft course mutations continue to work
SELECT lives_ok(
  $$ SELECT public.admin_update_academy_course('10000000-0000-0000-0000-000000000002', 'D2', 'draft-course', '', null, 'private', 'closed', 'dynamic', 'free') $$,
  'draft course mutations continue to work'
);

-- 17. unauthorized cancel fails (student)
SELECT set_config('role', 'service_role', true);
PREPARE test_cancel_unauth AS SELECT public.admin_cancel_academy_media_upload_session('00000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001');
SELECT throws_ok('test_cancel_unauth', 'FORBIDDEN', '17. unauthorized cancel fails');
SELECT set_config('role', 'postgres', true);

-- Verify student/sale denied for draft course mutation
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003"}', true);
PREPARE test_student_mut AS SELECT public.admin_update_academy_course('10000000-0000-0000-0000-000000000002', 'D3', 'draft-course', '', null, 'private', 'closed', 'dynamic', 'free');
SELECT throws_ok('test_student_mut', 'FORBIDDEN', 'student remain denied');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004"}', true);
PREPARE test_sale_mut AS SELECT public.admin_update_academy_course('10000000-0000-0000-0000-000000000002', 'D3', 'draft-course', '', null, 'private', 'closed', 'dynamic', 'free');
SELECT throws_ok('test_sale_mut', 'FORBIDDEN', 'sale remain denied');

SELECT * FROM finish();
ROLLBACK;
