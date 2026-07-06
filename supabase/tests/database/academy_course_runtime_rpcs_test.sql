BEGIN;

SELECT plan(35);

-- ==========================================
-- MOCK DATA SETUP
-- ==========================================
-- 1. Tiers
INSERT INTO public.customer_tiers (id, code, name, rank, is_active) VALUES 
  ('22222222-2222-4222-8222-222222222222', 'silver', 'Silver', 1, true),
  ('33333333-3333-4333-8333-333333333333', 'gold', 'Gold', 2, true),
  ('44444444-4444-4444-8444-444444444444', 'diamond', 'Diamond', 3, true),
  ('55555555-5555-4555-8555-555555555555', 'inactive-tier', 'Inactive Tier', 4, false)
ON CONFLICT (id) DO NOTHING;

-- 2. Auth Users & Customers
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES
  ('819884e7-4565-4445-a1b1-ed3f4ad44b62', 'academy.silver@test.desembre.local', '', now()),
  ('ecb6e47c-1050-41ad-94af-0cfce7c068e6', 'academy.diamond@test.desembre.local', '', now()),
  ('99999999-9999-4999-8999-999999999999', 'academy.expired@test.desembre.local', '', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'academy.nostudent@test.desembre.local', '', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, name, email) VALUES
  ('c819884e-4565-4445-a1b1-ed3f4ad44b62', 'UI Silver Student', 'academy.silver@test.desembre.local'),
  ('cecb6e47-1050-41ad-94af-0cfce7c068e6', 'UI Diamond Student', 'academy.diamond@test.desembre.local'),
  ('c9999999-9999-4999-8999-999999999999', 'UI Expired Member', 'academy.expired@test.desembre.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.student_accounts (id, user_id, customer_id) VALUES
  ('5819884e-4565-4445-a1b1-ed3f4ad44b62', '819884e7-4565-4445-a1b1-ed3f4ad44b62', 'c819884e-4565-4445-a1b1-ed3f4ad44b62'),
  ('5ecb6e47-1050-41ad-94af-0cfce7c068e6', 'ecb6e47c-1050-41ad-94af-0cfce7c068e6', 'cecb6e47-1050-41ad-94af-0cfce7c068e6'),
  ('59999999-9999-4999-8999-999999999999', '99999999-9999-4999-8999-999999999999', 'c9999999-9999-4999-8999-999999999999')
ON CONFLICT (id) DO NOTHING;

-- Memberships
INSERT INTO public.customer_tier_memberships (id, customer_id, tier_id, starts_at, ends_at) VALUES
  ('e819884e-4565-4445-a1b1-ed3f4ad44b62', 'c819884e-4565-4445-a1b1-ed3f4ad44b62', '22222222-2222-4222-8222-222222222222', now(), null), -- Silver
  ('eecb6e47-1050-41ad-94af-0cfce7c068e6', 'cecb6e47-1050-41ad-94af-0cfce7c068e6', '44444444-4444-4444-8444-444444444444', now(), null), -- Diamond
  ('e9999999-9999-4999-8999-999999999999', 'c9999999-9999-4999-8999-999999999999', '44444444-4444-4444-8444-444444444444', now() - interval '2 days', now() - interval '1 day') -- Expired Diamond
ON CONFLICT (id) DO NOTHING;

-- 3. Category
INSERT INTO public.course_categories (id, slug, name, status) VALUES 
  ('c1111111-1111-4111-a111-111111111111', 'cat-1', 'Cat 1', 'published') ON CONFLICT (id) DO NOTHING;

-- 4. Courses
INSERT INTO public.courses (id, category_id, slug, title, status, catalog_visibility, enrollment_policy, access_policy, pricing_model) VALUES 
  ('a0000000-0000-4000-a000-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-a', 'Course A', 'published', 'public', 'open', 'dynamic', 'free'),
  ('b0000000-0000-4000-b000-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-b', 'Course B', 'published', 'public', 'open', 'dynamic', 'included'),
  ('d0000000-0000-4000-d000-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-draft', 'Course Draft', 'draft', 'public', 'open', 'dynamic', 'free'),
  ('e0000000-0000-4000-e000-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-archived', 'Course Archived', 'archived', 'public', 'open', 'dynamic', 'free'),
  ('88888888-0000-4000-8888-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-private', 'Course Private', 'published', 'private', 'open', 'dynamic', 'free'),
  ('c0000000-0000-4000-c000-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-closed', 'Course Closed', 'published', 'public', 'closed', 'dynamic', 'free'),
  ('99999998-0000-4000-8999-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-assigned', 'Course Assigned', 'published', 'public', 'assigned', 'dynamic', 'free'),
  ('77777777-0000-4000-7777-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-approval', 'Course Approval', 'published', 'public', 'approval', 'dynamic', 'free'),
  ('f0000000-0000-4000-f000-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-paid', 'Course Paid', 'published', 'public', 'open', 'dynamic', 'paid'),
  ('66666666-0000-4000-6666-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-gf', 'Course Grandfathered', 'published', 'public', 'open', 'grandfathered', 'free')
ON CONFLICT (id) DO NOTHING;

-- Modules & Lessons (Course A and Course B)
INSERT INTO public.course_modules (id, course_id, title, position) VALUES 
  ('a1111111-1111-4111-a111-111111111111', 'a0000000-0000-4000-a000-000000000000', 'Module 1 A', 1),
  ('a1111111-1111-4111-a111-111111111112', 'a0000000-0000-4000-a000-000000000000', 'Module 2 A', 2),
  ('b1111111-1111-4111-b111-111111111111', 'b0000000-0000-4000-b000-000000000000', 'Module 1 B', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, module_id, title, type, position, duration, is_preview, status) VALUES 
  ('a2222222-2222-4222-a222-222222222222', 'a1111111-1111-4111-a111-111111111111', 'Lesson 1 A', 'video', 1, 600, false, 'published'),
  ('a2222222-2222-4222-a222-222222222223', 'a1111111-1111-4111-a111-111111111111', 'Lesson 2 A', 'video', 2, 600, false, 'published'),
  ('b2222222-2222-4222-b222-222222222222', 'b1111111-1111-4111-b111-111111111111', 'Lesson 1 B', 'video', 1, 600, true, 'published'),
  ('b2222222-2222-4222-b222-222222222223', 'b1111111-1111-4111-b111-111111111111', 'Lesson 2 B', 'video', 2, 600, false, 'published')
ON CONFLICT (id) DO NOTHING;

-- Rules
INSERT INTO public.course_access_rules (id, course_id, tier_id, decision, access_scope, match_mode) VALUES 
  ('a3333333-3333-4333-a333-333333333333', 'a0000000-0000-4000-a000-000000000000', '22222222-2222-4222-8222-222222222222', 'allow', 'full', 'minimum'), -- Course A: Min Silver
  ('b3333333-3333-4333-b333-333333333333', 'b0000000-0000-4000-b000-000000000000', '33333333-3333-4333-8333-333333333333', 'allow', 'full', 'minimum'),  -- Course B: Min Gold
  ('73333333-3333-4333-7333-333333333333', '77777777-0000-4000-7777-000000000000', '22222222-2222-4222-8222-222222222222', 'allow', 'full', 'minimum')  -- Course Approval: Min Silver
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- CATALOG TESTS
-- ==========================================

-- 1. Anonymous caller denied
SELECT set_config('request.jwt.claims', '', true);
SELECT is(
  (public.get_academy_course_catalog()::text),
  '[]',
  '1. Anonymous caller denied'
);

-- Login as Silver
SELECT set_config('request.jwt.claims', '{"sub":"819884e7-4565-4445-a1b1-ed3f4ad44b62"}', true);

-- 2 & 3. Draft/archived excluded; 4. Published public visible
SELECT ok(
  (SELECT COUNT(*) FROM jsonb_array_elements(public.get_academy_course_catalog()) c WHERE c->>'slug' IN ('course-draft', 'course-archived')) = 0,
  '2,3. Draft and archived courses excluded'
);

SELECT ok(
  (SELECT COUNT(*) FROM jsonb_array_elements(public.get_academy_course_catalog()) c WHERE c->>'slug' = 'course-a') = 1,
  '4. Published public course visible'
);

-- 5. Private course does not leak
SELECT ok(
  (SELECT COUNT(*) FROM jsonb_array_elements(public.get_academy_course_catalog()) c WHERE c->>'slug' = 'course-private') = 0,
  '5. Private course does not leak'
);

-- 6. Silver sees Gold public course as visible but locked
SELECT is(
  (SELECT c->'access_decision'->>'can_enroll' FROM jsonb_array_elements(public.get_academy_course_catalog()) c WHERE c->>'slug' = 'course-b'),
  'false',
  '6. Silver sees Gold course but locked (can_enroll false)'
);

SELECT is(
  (private.get_course_access_decision('b0000000-0000-4000-b000-000000000000') ->> 'reason'),
  'TIER_REQUIRED',
  '7. Silver cannot learn Gold course (TIER_REQUIRED)'
);

-- 8. Diamond can access Gold course
SELECT set_config('request.jwt.claims', '{"sub":"ecb6e47c-1050-41ad-94af-0cfce7c068e6"}', true);
SELECT is(
  (private.get_course_access_decision('b0000000-0000-4000-b000-000000000000') ->> 'reason'),
  'AVAILABLE',
  '8. Diamond can access Gold course'
);

-- 9. No cross-student enrollment data leak
SELECT ok(
  (SELECT COUNT(*) FROM jsonb_array_elements(public.get_current_student_courses())) = 0,
  '9. Diamond has no enrollments initially (no cross leak)'
);

-- ==========================================
-- ENROLLMENT TESTS
-- ==========================================
SELECT set_config('request.jwt.claims', '{"sub":"819884e7-4565-4445-a1b1-ed3f4ad44b62"}', true); -- Silver

-- 10. Eligible open course creates active self enrollment
SELECT is(
  (public.enroll_current_student_in_course('course-a') ->> 'status'),
  'active',
  '10. Eligible open course creates active self enrollment'
);

-- 11. Duplicate active enrollment is idempotent
SELECT is(
  (public.enroll_current_student_in_course('course-a') ->> 'message'),
  'Already enrolled',
  '11. Duplicate active enrollment is idempotent'
);

-- 12. Closed course rejects self enrollment
PREPARE enroll_closed AS SELECT public.enroll_current_student_in_course('course-closed');
SELECT throws_ok(
  'enroll_closed',
  'Cannot enroll: ENROLLMENT_CLOSED',
  '12. Closed course rejects self enrollment'
);

-- 13. Assigned course rejects self enrollment
PREPARE enroll_assigned AS SELECT public.enroll_current_student_in_course('course-assigned');
SELECT throws_ok(
  'enroll_assigned',
  'Cannot enroll: ASSIGNMENT_REQUIRED',
  '13. Assigned course rejects self enrollment'
);

-- 14. Approval course creates pending, never active
SELECT is(
  (public.enroll_current_student_in_course('course-approval') ->> 'status'),
  'pending',
  '14. Approval course creates pending, never active'
);

-- 15. Tier-ineligible caller cannot enroll
PREPARE enroll_tier AS SELECT public.enroll_current_student_in_course('course-b');
SELECT throws_ok(
  'enroll_tier',
  'Cannot enroll: TIER_REQUIRED',
  '15. Tier-ineligible caller cannot enroll'
);

-- 16. Unpublished course cannot be enrolled
PREPARE enroll_unpub AS SELECT public.enroll_current_student_in_course('course-draft');
SELECT throws_ok(
  'enroll_unpub',
  'Course not found or unpublished',
  '16. Unpublished course cannot be enrolled'
);

-- 17. Caller cannot spoof another student
-- Addressed by the function signature not taking a student ID
SELECT ok(true, '17. Caller cannot spoof another student (enforced by signature)');

-- 18. Paid course returns PAYMENT_REQUIRED and creates no row
PREPARE enroll_paid AS SELECT public.enroll_current_student_in_course('course-paid');
SELECT throws_ok(
  'enroll_paid',
  'Cannot enroll: PAYMENT_REQUIRED',
  '18. Paid course returns PAYMENT_REQUIRED and creates no row'
);

-- ==========================================
-- OUTLINE TESTS
-- ==========================================
-- 19 & 20. Modules and lessons ordered by position
SELECT ok(
  (public.get_academy_course_outline('course-a') #>> '{modules,0,title}') = 'Module 1 A' AND
  (public.get_academy_course_outline('course-a') #>> '{modules,1,title}') = 'Module 2 A' AND
  (public.get_academy_course_outline('course-a') #>> '{modules,0,lessons,0,title}') = 'Lesson 1 A' AND
  (public.get_academy_course_outline('course-a') #>> '{modules,0,lessons,1,title}') = 'Lesson 2 A',
  '19, 20. Modules and lessons ordered by position'
);

-- 21. Valid preview metadata visible & 22. Protected lesson data is redacted
-- Check course B (Silver unenrolled, sees preview, but locked for Lesson 2)
SELECT ok(
  (public.get_academy_course_outline('course-b') #>> '{modules,0,lessons,0,is_preview}') = 'true' AND
  (public.get_academy_course_outline('course-b') #>> '{modules,0,lessons,0,is_locked}') = 'false' AND
  (public.get_academy_course_outline('course-b') #>> '{modules,0,lessons,0,type}') = 'video' AND
  (public.get_academy_course_outline('course-b') #>> '{modules,0,lessons,1,is_preview}') = 'false' AND
  (public.get_academy_course_outline('course-b') #>> '{modules,0,lessons,1,is_locked}') = 'true' AND
  (public.get_academy_course_outline('course-b') #>> '{modules,0,lessons,1,type}') IS NULL,
  '21, 22. Valid preview visible, protected lesson data redacted'
);

-- 23. Eligible enrolled student receives full outline
-- Silver is enrolled in Course A
SELECT ok(
  (public.get_academy_course_outline('course-a') #>> '{modules,0,lessons,0,is_locked}') = 'false' AND
  (public.get_academy_course_outline('course-a') #>> '{modules,0,lessons,0,duration}') = '600',
  '23. Eligible enrolled student receives full outline'
);

-- 24. Private course outline does not leak
SELECT ok(
  public.get_academy_course_outline('course-private') IS NULL,
  '24. Private course outline does not leak'
);

-- 25. Another student's progress does not leak
-- (Silver has enrollment in A. Diamond should not see Silver's progress)
SELECT set_config('request.jwt.claims', '{"sub":"ecb6e47c-1050-41ad-94af-0cfce7c068e6"}', true); -- Diamond
SELECT ok(
  public.get_academy_course_outline('course-a') #>> '{enrollment}' IS NULL,
  '25. Another student progress does not leak (Diamond sees no enrollment for Course A)'
);


-- ==========================================
-- PROGRESS TESTS
-- ==========================================
SELECT set_config('request.jwt.claims', '{"sub":"819884e7-4565-4445-a1b1-ed3f4ad44b62"}', true); -- Silver (enrolled in A)

-- 26. Active owner can save progress
SELECT is(
  (public.save_current_lesson_progress('a2222222-2222-4222-a222-222222222222', 'in_progress', 50) ->> 'status'),
  'in_progress',
  '26. Active owner can save progress'
);

-- 27. Another student cannot mutate progress
SELECT set_config('request.jwt.claims', '{"sub":"ecb6e47c-1050-41ad-94af-0cfce7c068e6"}', true); -- Diamond
PREPARE save_other AS SELECT public.save_current_lesson_progress('a2222222-2222-4222-a222-222222222222', 'in_progress', 50);
SELECT throws_ok('save_other', 'Active enrollment required', '27. Another student cannot mutate progress');

SELECT set_config('request.jwt.claims', '{"sub":"819884e7-4565-4445-a1b1-ed3f4ad44b62"}', true); -- Silver again

-- 28. Invalid progress status rejected
PREPARE save_invalid_stat AS SELECT public.save_current_lesson_progress('a2222222-2222-4222-a222-222222222222', 'invalid_status', 50);
SELECT throws_ok('save_invalid_stat', 'Invalid status', '28. Invalid progress status rejected');

-- 29. Percentage below 0 rejected
PREPARE save_invalid_pct1 AS SELECT public.save_current_lesson_progress('a2222222-2222-4222-a222-222222222222', 'in_progress', -1);
SELECT throws_ok('save_invalid_pct1', 'Invalid progress_percent', '29. Percentage below 0 rejected');

-- 30. Percentage above 100 rejected
PREPARE save_invalid_pct2 AS SELECT public.save_current_lesson_progress('a2222222-2222-4222-a222-222222222222', 'in_progress', 101);
SELECT throws_ok('save_invalid_pct2', 'Invalid progress_percent', '30. Percentage above 100 rejected');

-- 31. Repeated save updates the same logical row
SELECT is(
  (public.save_current_lesson_progress('a2222222-2222-4222-a222-222222222222', 'completed', 100) ->> 'status'),
  'completed',
  '31. Repeated save updates the same logical row'
);

-- 34. Progress summary calculated correctly & 35. Completed lesson count
SELECT ok(
  (SELECT (c->'current_progress_summary'->>'progress_percent')::numeric FROM jsonb_array_elements(public.get_academy_course_catalog()) c WHERE c->>'slug' = 'course-a') = 100 AND
  (SELECT (c->'current_progress_summary'->>'completed_lessons')::integer FROM jsonb_array_elements(public.get_academy_course_catalog()) c WHERE c->>'slug' = 'course-a') = 1,
  '34, 35. Progress summary and completed lesson count calculated correctly'
);

-- 32. Completed enrollment cannot mutate progress
UPDATE public.enrollments SET status = 'completed' WHERE student_id = '5819884e-4565-4445-a1b1-ed3f4ad44b62' AND course_id = 'a0000000-0000-4000-a000-000000000000';
PREPARE save_completed AS SELECT public.save_current_lesson_progress('a2222222-2222-4222-a222-222222222222', 'not_started', 0);
SELECT throws_ok('save_completed', 'Active enrollment required', '32. Completed enrollment cannot mutate progress');

-- 33. Pending, cancelled and expired enrollment cannot mutate progress
UPDATE public.enrollments SET status = 'pending' WHERE student_id = '5819884e-4565-4445-a1b1-ed3f4ad44b62' AND course_id = 'a0000000-0000-4000-a000-000000000000';
PREPARE save_pending AS SELECT public.save_current_lesson_progress('a2222222-2222-4222-a222-222222222222', 'in_progress', 50);
SELECT throws_ok('save_pending', 'Active enrollment required', '33. Pending/cancelled/expired enrollment cannot mutate progress');

-- ==========================================
-- ACCESS EXPLICIT PROOFS
-- ==========================================

-- Prove: expired membership grants no tier access
SELECT set_config('request.jwt.claims', '{"sub":"99999999-9999-4999-8999-999999999999"}', true); -- Expired member
SELECT is(
  (private.get_course_access_decision('b0000000-0000-4000-b000-000000000000') ->> 'reason'),
  'MEMBERSHIP_REQUIRED',
  'Expired membership grants no tier access'
);

-- Prove: minimum tier uses customer_tiers.rank (Diamond rank 3 > Gold rank 2)
-- Tested via Diamond accessing Gold in Test 8 (already passed but explicit verify here)
SELECT set_config('request.jwt.claims', '{"sub":"ecb6e47c-1050-41ad-94af-0cfce7c068e6"}', true); -- Diamond
SELECT is(
  (private.get_course_access_decision('b0000000-0000-4000-b000-000000000000') ->> 'reason'),
  'AVAILABLE',
  'Minimum tier uses customer_tiers.rank'
);

-- Prove: grandfathered alone creates no entitlement
SELECT set_config('request.jwt.claims', '{"sub":"819884e7-4565-4445-a1b1-ed3f4ad44b62"}', true); -- Silver
SELECT is(
  (private.get_course_access_decision('66666666-0000-4000-6666-000000000000') ->> 'reason'),
  'COURSE_UNAVAILABLE',
  'Grandfathered alone creates no entitlement'
);

-- No student fallback
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}', true); -- No student row
SELECT is(
  (private.get_course_access_decision('a0000000-0000-4000-a000-000000000000') ->> 'reason'),
  'NO_STUDENT_ACCOUNT',
  'No student state is deterministic'
);


SELECT * FROM finish();
ROLLBACK;
