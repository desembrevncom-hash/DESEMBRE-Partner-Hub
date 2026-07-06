BEGIN;
SELECT plan(31);

-- Setup test roles
-- We need users: Silver, Diamond, Unenrolled, Anon

-- Seed test data
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid), -- anonish
  ('00000000-0000-0000-0000-000000000002'::uuid), -- unenrolled
  ('00000000-0000-0000-0000-000000000003'::uuid), -- silver
  ('00000000-0000-0000-0000-000000000004'::uuid); -- diamond

INSERT INTO public.student_accounts (id, user_id) VALUES
  ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
  ('10000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000004'::uuid);

INSERT INTO public.course_categories (id, slug, name, status) VALUES 
  ('c0000000-0000-0000-0000-000000000000'::uuid, 'test-cat', 'Test', 'published');

INSERT INTO public.courses (id, category_id, slug, title, status, catalog_visibility, enrollment_policy, access_policy, pricing_model) VALUES
  ('a0000000-0000-0000-0000-000000000000'::uuid, 'c0000000-0000-0000-0000-000000000000'::uuid, 'course-a', 'Course A', 'published', 'public', 'open', 'dynamic', 'free'),
  ('b0000000-0000-0000-0000-000000000000'::uuid, 'c0000000-0000-0000-0000-000000000000'::uuid, 'course-b', 'Course B', 'published', 'public', 'open', 'dynamic', 'included');

INSERT INTO public.course_modules (id, course_id, title, position) VALUES
  ('c1000000-0000-0000-0000-000000000000'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'M1', 1),
  ('c2000000-0000-0000-0000-000000000000'::uuid, 'b0000000-0000-0000-0000-000000000000'::uuid, 'M2', 1);

INSERT INTO public.lessons (id, module_id, title, type, position, duration, is_preview, status) VALUES
  ('d1000000-0000-0000-0000-000000000000'::uuid, 'c1000000-0000-0000-0000-000000000000'::uuid, 'A1', 'article', 1, 100, false, 'published'),
  ('d1000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000000'::uuid, 'A2 Preview', 'video', 2, 200, true, 'published'),
  ('d2000000-0000-0000-0000-000000000000'::uuid, 'c2000000-0000-0000-0000-000000000000'::uuid, 'B1', 'video', 1, 300, false, 'published');

INSERT INTO private.lesson_contents (id, lesson_id, content_type, content_markdown, provider, storage_bucket, storage_path) VALUES
  ('e1000000-0000-0000-0000-000000000000'::uuid, 'd1000000-0000-0000-0000-000000000000'::uuid, 'article', '# Hello', null, null, null),
  ('e1000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000001'::uuid, 'video', null, 'supabase_storage', 'academy-content', 'courses/a/a.mp4'),
  ('e2000000-0000-0000-0000-000000000000'::uuid, 'd2000000-0000-0000-0000-000000000000'::uuid, 'video', null, 'supabase_storage', 'academy-content', 'courses/b/b.mp4');

-- Enrollments
INSERT INTO public.enrollments (id, student_id, course_id, status, source) VALUES
  ('e1000000-0000-0000-0000-000000000000'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'active', 'self'),
  ('e2000000-0000-0000-0000-000000000000'::uuid, '10000000-0000-0000-0000-000000000004'::uuid, 'b0000000-0000-0000-0000-000000000000'::uuid, 'active', 'self'),
  ('e3000000-0000-0000-0000-000000000000'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'cancelled', 'self');

-- Access rules (mock)
-- We will override access via private.can_access_course directly using a mock, or just grant full via overrides
INSERT INTO public.course_access_overrides (student_id, course_id, decision, access_scope) VALUES
  ('10000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'allow', 'full'),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'b0000000-0000-0000-0000-000000000000'::uuid, 'allow', 'full'),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000000'::uuid, 'allow', 'full'); -- allow full but enrollment is cancelled

-- Test 1. anon cannot fetch protected content
SET ROLE anon;
PREPARE anon_content AS SELECT public.get_academy_lesson_content('course-a', 'd1000000-0000-0000-0000-000000000000'::uuid);
SELECT throws_ok('anon_content', null, null, 'Anon denied');

-- Test 2. unauthenticated media locator denied
-- Should fail permission
PREPARE unauth_locator AS SELECT public.get_academy_lesson_media_locator('c1000000-0000-0000-0000-000000000001'::uuid);
SELECT throws_ok('unauth_locator', null, null, 'Anon locator denied');
RESET ROLE;

-- Test 3. authenticated user cannot call media locator
SET request.jwt.claims TO '{"role":"authenticated", "sub":"00000000-0000-0000-0000-000000000003"}';
SET ROLE authenticated;
PREPARE auth_locator AS SELECT public.get_academy_lesson_media_locator('c1000000-0000-0000-0000-000000000001'::uuid);
SELECT throws_ok('auth_locator', null, null, 'Auth locator denied');

-- Test 4. unenrolled student cannot fetch protected content (cancelled enrollment)
SET request.jwt.claims TO '{"role":"authenticated", "sub":"00000000-0000-0000-0000-000000000002"}';
SELECT is((public.get_academy_lesson_content('course-a', 'd1000000-0000-0000-0000-000000000000'::uuid))->>'state', 'ACCESS_DENIED', 'Unenrolled denied');

-- Test 5. preview lesson exposes only configured preview content
SELECT is((public.get_academy_lesson_content('course-a', 'd1000000-0000-0000-0000-000000000001'::uuid))->>'state', 'AVAILABLE', 'Preview available to unenrolled');
SELECT is((public.get_academy_lesson_content('course-a', 'd1000000-0000-0000-0000-000000000001'::uuid))->'content'->>'media_ref', 'e1000000-0000-0000-0000-000000000001', 'Preview exposes content');

-- Test 6. enrolled Silver can fetch Course A article metadata
SET request.jwt.claims TO '{"role":"authenticated", "sub":"00000000-0000-0000-0000-000000000003"}';
SELECT is((public.get_academy_lesson_content('course-a', 'd1000000-0000-0000-0000-000000000000'::uuid))->>'state', 'AVAILABLE', 'Silver can access A1');
SELECT is((public.get_academy_lesson_content('course-a', 'd1000000-0000-0000-0000-000000000000'::uuid))->'content'->>'markdown', '# Hello', 'Silver gets markdown');

-- Test 7. Silver cannot fetch Course B protected content
SELECT is((public.get_academy_lesson_content('course-b', 'd2000000-0000-0000-0000-000000000000'::uuid))->>'state', 'ACCESS_DENIED', 'Silver denied B1');

-- Test 8. enrolled Diamond can fetch Course B content
SET request.jwt.claims TO '{"role":"authenticated", "sub":"00000000-0000-0000-0000-000000000004"}';
SELECT is((public.get_academy_lesson_content('course-b', 'd2000000-0000-0000-0000-000000000000'::uuid))->>'state', 'AVAILABLE', 'Diamond can access B1');

-- Test 9. locked response contains no media_ref
SET request.jwt.claims TO '{"role":"authenticated", "sub":"00000000-0000-0000-0000-000000000003"}';
SELECT is((public.get_academy_lesson_content('course-b', 'd2000000-0000-0000-0000-000000000000'::uuid))->>'content', null, 'Locked content is null');

-- Test 10. public RPC never returns storage path
SELECT ok((public.get_academy_lesson_content('course-a', 'd1000000-0000-0000-0000-000000000001'::uuid))->'content'->>'storage_path' IS NULL, 'No storage_path in public RPC');

-- Test 11. another student progress does not leak
RESET ROLE;
INSERT INTO public.lesson_progress (enrollment_id, lesson_id, status, progress_percent, last_position_seconds)
VALUES ('e2000000-0000-0000-0000-000000000000'::uuid, 'd2000000-0000-0000-0000-000000000000'::uuid, 'in_progress', 50, 60);

SET request.jwt.claims TO '{"role":"authenticated", "sub":"00000000-0000-0000-0000-000000000003"}';
SET ROLE authenticated;
-- Silver requests course B, progress should be null
SELECT ok((public.get_academy_lesson_content('course-b', 'd2000000-0000-0000-0000-000000000000'::uuid))->>'progress' IS NULL, 'Silver cannot see Diamond progress');

-- Test 12. invalid lesson ID returns safe state
SELECT is((public.get_academy_lesson_content('course-a', '00000000-0000-0000-0000-000000000000'::uuid))->>'state', 'NOT_FOUND', 'Invalid lesson not found');

-- Test 13. lesson/course mismatch rejected
SELECT is((public.get_academy_lesson_content('course-b', 'd1000000-0000-0000-0000-000000000000'::uuid))->>'state', 'NOT_FOUND', 'Mismatch rejected');

-- Test 18. malformed type-specific content rows are rejected
RESET ROLE;
PREPARE bad_article AS INSERT INTO private.lesson_contents (lesson_id, content_type, storage_bucket) VALUES ('d1000000-0000-0000-0000-000000000000'::uuid, 'article', 'bad');
SELECT throws_ok('bad_article', null, null, 'Malformed article rejected');

PREPARE bad_video AS INSERT INTO private.lesson_contents (lesson_id, content_type, content_markdown) VALUES ('d2000000-0000-0000-0000-000000000000'::uuid, 'video', 'bad');
SELECT throws_ok('bad_video', null, null, 'Malformed video rejected');

-- Test 17. external links reject non-HTTPS values
INSERT INTO public.lessons (id, module_id, title, type, position, status) VALUES ('d9000000-0000-0000-0000-000000000000'::uuid, 'c1000000-0000-0000-0000-000000000000'::uuid, 'Ext', 'external_link', 9, 'published');
PREPARE bad_ext AS INSERT INTO private.lesson_contents (lesson_id, content_type, provider, external_url) VALUES ('d9000000-0000-0000-0000-000000000000'::uuid, 'external_link', 'external', 'http://insecure.com');
SELECT throws_ok('bad_ext', null, null, 'Insecure external URL rejected');

-- Test 19, 20. Progress save
SET request.jwt.claims TO '{"role":"authenticated", "sub":"00000000-0000-0000-0000-000000000003"}';
SET ROLE authenticated;
SELECT public.save_current_lesson_progress('d1000000-0000-0000-0000-000000000000'::uuid, 'in_progress', 10, 50);
SELECT is((public.get_academy_lesson_content('course-a', 'd1000000-0000-0000-0000-000000000000'::uuid))->'progress'->>'last_position_seconds', '50', '4-arg saved position');

-- Test 21. negative position rejected
PREPARE bad_pos AS SELECT public.save_current_lesson_progress('d1000000-0000-0000-0000-000000000000'::uuid, 'in_progress', 10, -5);
SELECT throws_ok('bad_pos', null, null, 'Negative position rejected');

-- Test 22. position beyond lesson duration rejected
PREPARE big_pos AS SELECT public.save_current_lesson_progress('d1000000-0000-0000-0000-000000000000'::uuid, 'in_progress', 10, 105);
SELECT throws_ok('big_pos', null, null, 'Position beyond duration rejected');

-- Test 23. completed progress requires 100%
PREPARE bad_comp AS SELECT public.save_current_lesson_progress('d1000000-0000-0000-0000-000000000000'::uuid, 'completed', 90, 50);
SELECT throws_ok('bad_comp', null, null, 'Completed requires 100%');

-- Test 3-arg wrapper
SELECT public.save_current_lesson_progress('d1000000-0000-0000-0000-000000000000'::uuid, 'in_progress', 20);
SELECT is((public.get_academy_lesson_content('course-a', 'd1000000-0000-0000-0000-000000000000'::uuid))->'progress'->>'last_position_seconds', '50', '3-arg kept previous position');

-- Test 24. locator returns only the requested media record
RESET ROLE;
SET request.jwt.claims TO '{"role":"service_role"}';
SET ROLE service_role;
SELECT is(
  (public.get_academy_lesson_media_locator('e1000000-0000-0000-0000-000000000001'::uuid))->>'path',
  'courses/a/a.mp4',
  'Locator returns exact path'
);

-- Test 25. non-video locator returns null
SELECT is(
  (public.get_academy_lesson_media_locator('e1000000-0000-0000-0000-000000000000'::uuid))::text,
  null,
  'Locator denies non-media'
);

-- Test 26. matching article/article succeeds
RESET ROLE;
INSERT INTO public.lessons (id, module_id, title, type, position, status) VALUES ('d9000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000000'::uuid, 'A1', 'article', 10, 'published');
PREPARE insert_matching_article AS INSERT INTO private.lesson_contents (lesson_id, content_type, content_markdown) VALUES ('d9000000-0000-0000-0000-000000000001'::uuid, 'article', 'foo');
SELECT lives_ok('insert_matching_article', 'matching article/article succeeds');

-- Test 27. matching video/video succeeds
INSERT INTO public.lessons (id, module_id, title, type, position, status) VALUES ('d9000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000000'::uuid, 'V1', 'video', 11, 'published');
PREPARE insert_matching_video AS INSERT INTO private.lesson_contents (lesson_id, content_type, provider, storage_bucket, storage_path) VALUES ('d9000000-0000-0000-0000-000000000002'::uuid, 'video', 'supabase_storage', 'academy-content', 'v1.mp4');
SELECT lives_ok('insert_matching_video', 'matching video/video succeeds');

-- Test 28. article content for video lesson fails
PREPARE insert_article_for_video AS INSERT INTO private.lesson_contents (lesson_id, content_type, content_markdown) VALUES ('d9000000-0000-0000-0000-000000000002'::uuid, 'article', 'foo');
SELECT throws_ok('insert_article_for_video', null, null, 'article content for video lesson fails');

-- Test 29. video content for article lesson fails
PREPARE insert_video_for_article AS INSERT INTO private.lesson_contents (lesson_id, content_type, provider, storage_bucket, storage_path) VALUES ('d9000000-0000-0000-0000-000000000001'::uuid, 'video', 'supabase_storage', 'academy-content', 'v2.mp4');
SELECT throws_ok('insert_video_for_article', null, null, 'video content for article lesson fails');

-- Test 30. updating lesson_id to a mismatched lesson fails
PREPARE update_lesson_id_mismatch AS UPDATE private.lesson_contents SET lesson_id = 'd9000000-0000-0000-0000-000000000002'::uuid WHERE lesson_id = 'd9000000-0000-0000-0000-000000000001'::uuid;
SELECT throws_ok('update_lesson_id_mismatch', null, null, 'updating lesson_id to a mismatched lesson fails');

-- Test 31. changing public.lessons.type while content exists cannot leave an inconsistent pair
PREPARE update_lessons_type_mismatch AS UPDATE public.lessons SET type = 'video' WHERE id = 'd9000000-0000-0000-0000-000000000001'::uuid;
SELECT throws_ok('update_lessons_type_mismatch', null, null, 'changing public.lessons.type while content exists cannot leave an inconsistent pair');

SELECT * FROM finish();
ROLLBACK;
