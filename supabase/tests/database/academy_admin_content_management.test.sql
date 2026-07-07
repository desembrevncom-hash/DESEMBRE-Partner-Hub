BEGIN;

SELECT plan(50);

-- Authorization
SELECT ok(NOT has_function_privilege('anon', 'public.admin_list_academy_courses(text, text)', 'execute'), 'anon cannot execute browser admin mutations');
SELECT ok(NOT has_function_privilege('authenticated', 'public.admin_create_academy_media_upload_session(uuid, uuid, text, text, bigint, text)', 'execute'), 'authenticated cannot execute internal RPCs');
SELECT ok(has_function_privilege('service_role', 'public.admin_create_academy_media_upload_session(uuid, uuid, text, text, bigint, text)', 'execute'), 'service_role can execute internal RPCs');
SELECT ok(has_function_privilege('authenticated', 'public.admin_list_academy_courses(text, text)', 'execute'), 'authenticated can execute browser RPCs');
SELECT ok(NOT has_function_privilege('PUBLIC', 'public.admin_list_academy_courses(text, text)', 'execute'), 'PUBLIC does not retain execute permission on browser RPCs');
SELECT ok(NOT has_function_privilege('PUBLIC', 'public.admin_finalize_academy_media_upload_session(uuid, uuid)', 'execute'), 'PUBLIC does not retain execute permission on internal RPCs');
SELECT ok(NOT has_function_privilege('anon', 'public.admin_cancel_academy_media_upload_session(uuid, uuid)', 'execute'), 'anon cannot execute cancel internal RPC');
SELECT ok(has_function_privilege('service_role', 'public.admin_cancel_academy_media_upload_session(uuid, uuid)', 'execute'), 'service_role can execute cancel internal RPC');
SELECT ok(NOT has_function_privilege('PUBLIC', 'private.require_current_academy_content_admin()', 'execute'), 'PUBLIC cannot execute require_current_academy_content_admin');
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
SELECT has_function('private', 'require_current_academy_content_admin');
SELECT has_function('private', 'require_academy_content_admin_actor', ARRAY['uuid']);
SELECT has_function('private', 'write_academy_admin_audit', ARRAY['uuid', 'public.app_role', 'text', 'text', 'uuid', 'jsonb', 'jsonb', 'uuid']);
SELECT has_function('private', 'enforce_academy_media_upload_session_transition');

-- Table Verification
SELECT has_table('private', 'academy_admin_audit_logs');
SELECT has_table('private', 'academy_media_upload_sessions');
SELECT has_pk('private', 'academy_admin_audit_logs');
SELECT has_pk('private', 'academy_media_upload_sessions');

-- Columns Verification
SELECT has_column('private', 'academy_media_upload_sessions', 'status');
SELECT has_column('private', 'academy_media_upload_sessions', 'content_type');
SELECT has_column('private', 'academy_media_upload_sessions', 'content_id');
SELECT has_column('private', 'academy_media_upload_sessions', 'object_path');
SELECT has_column('private', 'academy_media_upload_sessions', 'expected_mime_type');
SELECT has_column('private', 'academy_media_upload_sessions', 'expected_size_bytes');

-- RLS Verification
SELECT tests_rls_enabled('private', 'academy_admin_audit_logs');
SELECT tests_rls_enabled('private', 'academy_media_upload_sessions');

-- Index Verification
SELECT has_index('private', 'academy_admin_audit_logs', 'idx_academy_admin_audit_actor', 'actor index exists');
SELECT has_index('private', 'academy_admin_audit_logs', 'idx_academy_admin_audit_entity', 'entity index exists');
SELECT has_index('private', 'academy_admin_audit_logs', 'idx_academy_admin_audit_action', 'action index exists');
SELECT has_index('private', 'academy_media_upload_sessions', 'idx_academy_upload_lesson_status', 'upload lesson index exists');
SELECT has_index('private', 'academy_media_upload_sessions', 'idx_academy_upload_actor_status', 'upload actor index exists');
SELECT has_index('private', 'academy_media_upload_sessions', 'idx_academy_upload_expires_status', 'upload expires index exists');

-- Trigger Verification
SELECT has_trigger('private', 'academy_media_upload_sessions', 'trg_academy_media_upload_sessions_updated_at');
SELECT has_trigger('private', 'academy_media_upload_sessions', 'trg_academy_media_upload_session_transition');

SELECT * FROM finish();
ROLLBACK;
