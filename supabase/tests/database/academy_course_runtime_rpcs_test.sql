BEGIN;

SELECT plan(10);

-- MOCK DATA
-- Create Category
INSERT INTO public.course_categories (id, slug, name, status)
VALUES ('c1111111-1111-4111-a111-111111111111', 'v4-category', 'V4 Category', 'published')
ON CONFLICT (id) DO NOTHING;

-- Course A
INSERT INTO public.courses (id, category_id, slug, title, status, catalog_visibility, enrollment_policy, access_policy, pricing_model)
VALUES (
  'a0000000-0000-4000-a000-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-a-v4', 'Course A (V4)',
  'published', 'public', 'open', 'dynamic', 'free'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.course_modules (id, course_id, title, position)
VALUES ('a1111111-1111-4111-a111-111111111111', 'a0000000-0000-4000-a000-000000000000', 'Module 1', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, module_id, title, type, position, duration, is_preview, status)
VALUES ('a2222222-2222-4222-a222-222222222222', 'a1111111-1111-4111-a111-111111111111', 'Lesson 1', 'video', 1, 600, false, 'published')
ON CONFLICT (id) DO NOTHING;

-- Course B
INSERT INTO public.courses (id, category_id, slug, title, status, catalog_visibility, enrollment_policy, access_policy, pricing_model)
VALUES (
  'b0000000-0000-4000-b000-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-b-v4', 'Course B (V4)',
  'published', 'public', 'open', 'dynamic', 'included'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.course_modules (id, course_id, title, position)
VALUES ('b1111111-1111-4111-b111-111111111111', 'b0000000-0000-4000-b000-000000000000', 'Module 1', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, module_id, title, type, position, duration, is_preview, status)
VALUES ('b2222222-2222-4222-b222-222222222222', 'b1111111-1111-4111-b111-111111111111', 'Lesson 1', 'video', 1, 600, false, 'published')
ON CONFLICT (id) DO NOTHING;

-- Tiers
INSERT INTO public.customer_tiers (id, code, name, rank, is_active)
VALUES 
  ('22222222-2222-4222-8222-222222222222', 'silver', 'Silver', 1, true),
  ('33333333-3333-4333-8333-333333333333', 'gold', 'Gold', 2, true),
  ('44444444-4444-4444-8444-444444444444', 'diamond', 'Diamond', 3, true)
ON CONFLICT (id) DO NOTHING;

-- Rule for Course A (Silver)
INSERT INTO public.course_access_rules (id, course_id, tier_id, decision, access_scope, match_mode)
VALUES ('a3333333-3333-4333-a333-333333333333', 'a0000000-0000-4000-a000-000000000000', '22222222-2222-4222-8222-222222222222', 'allow', 'full', 'minimum')
ON CONFLICT (id) DO NOTHING;

-- Rule for Course B (Gold)
INSERT INTO public.course_access_rules (id, course_id, tier_id, decision, access_scope, match_mode)
VALUES ('b3333333-3333-4333-b333-333333333333', 'b0000000-0000-4000-b000-000000000000', '33333333-3333-4333-8333-333333333333', 'allow', 'full', 'minimum')
ON CONFLICT (id) DO NOTHING;

-- M3 Students
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES
  ('819884e7-4565-4445-a1b1-ed3f4ad44b62', 'academy.silver@test.desembre.local', '', now()),
  ('ecb6e47c-1050-41ad-94af-0cfce7c068e6', 'academy.diamond@test.desembre.local', '', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, name, email)
VALUES
  ('c819884e-4565-4445-a1b1-ed3f4ad44b62', 'UI Silver Student', 'academy.silver@test.desembre.local'),
  ('cecb6e47-1050-41ad-94af-0cfce7c068e6', 'UI Diamond Student', 'academy.diamond@test.desembre.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.student_accounts (id, user_id, customer_id)
VALUES
  ('5819884e-4565-4445-a1b1-ed3f4ad44b62', '819884e7-4565-4445-a1b1-ed3f4ad44b62', 'c819884e-4565-4445-a1b1-ed3f4ad44b62'),
  ('5ecb6e47-1050-41ad-94af-0cfce7c068e6', 'ecb6e47c-1050-41ad-94af-0cfce7c068e6', 'cecb6e47-1050-41ad-94af-0cfce7c068e6')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customer_tier_memberships (id, customer_id, tier_id, starts_at, ends_at)
VALUES
  ('e819884e-4565-4445-a1b1-ed3f4ad44b62', 'c819884e-4565-4445-a1b1-ed3f4ad44b62', '22222222-2222-4222-8222-222222222222', now(), null),
  ('eecb6e47-1050-41ad-94af-0cfce7c068e6', 'cecb6e47-1050-41ad-94af-0cfce7c068e6', '44444444-4444-4444-8444-444444444444', now(), null)
ON CONFLICT (id) DO NOTHING;

-- TEST 1: Silver student sees Course B as TIER_REQUIRED
SELECT set_config('request.jwt.claims', '{"sub":"819884e7-4565-4445-a1b1-ed3f4ad44b62"}', true);
SELECT is(
  (private.get_course_access_decision('b0000000-0000-4000-b000-000000000000') ->> 'reason'),
  'TIER_REQUIRED',
  'Course B should be TIER_REQUIRED for Silver student'
);

-- TEST 2: Silver student sees Course A as AVAILABLE
SELECT is(
  (private.get_course_access_decision('a0000000-0000-4000-a000-000000000000') ->> 'reason'),
  'AVAILABLE',
  'Course A should be AVAILABLE for Silver student'
);

-- Change auth to Diamond student
SELECT set_config('request.jwt.claims', '{"sub":"ecb6e47c-1050-41ad-94af-0cfce7c068e6"}', true);

-- TEST 3: Diamond student sees Course B as AVAILABLE
SELECT is(
  (private.get_course_access_decision('b0000000-0000-4000-b000-000000000000') ->> 'reason'),
  'AVAILABLE',
  'Course B should be AVAILABLE for Diamond student'
);

-- TEST 4: Enrollment creates active enrollment for Course A
SELECT is(
  (public.enroll_current_student_in_course('course-a-v4') ->> 'status'),
  'active',
  'Enrollment in Course A should be active'
);

-- TEST 5: Idempotent enrollment returns same active status
SELECT is(
  (public.enroll_current_student_in_course('course-a-v4') ->> 'message'),
  'Already enrolled',
  'Idempotent enrollment should return existing enrollment'
);

-- TEST 6: Save progress
SELECT is(
  (public.save_current_lesson_progress('a2222222-2222-4222-a222-222222222222', 'in_progress', 50) ->> 'status'),
  'in_progress',
  'Save progress should return updated progress'
);

-- TEST 7: Catalog visibility contains Course A
SELECT ok(
  (SELECT jsonb_array_length(public.get_academy_course_catalog()) > 0),
  'Catalog should contain courses'
);

-- TEST 8: Outline contains modules
SELECT is(
  (public.get_academy_course_outline('course-a-v4') #>> '{course,slug}'),
  'course-a-v4',
  'Outline should return course metadata'
);

-- MOCK AN UNENROLLED COURSE FOR OUTLINE
-- TEST 9: Locked lessons in outline
SELECT set_config('request.jwt.claims', '{"sub":"819884e7-4565-4445-a1b1-ed3f4ad44b62"}', true);
SELECT is(
  (public.get_academy_course_outline('course-b-v4') #>> '{modules,0,lessons,0,is_locked}'),
  'true',
  'Lesson in Course B should be locked for Silver student'
);

-- TEST 10: Paid course check
INSERT INTO public.courses (id, category_id, slug, title, status, catalog_visibility, enrollment_policy, access_policy, pricing_model)
VALUES (
  'f0000000-0000-4000-f000-000000000000', 'c1111111-1111-4111-a111-111111111111', 'course-paid', 'Course Paid',
  'published', 'public', 'open', 'dynamic', 'paid'
) ON CONFLICT (id) DO NOTHING;

SELECT is(
  (private.get_course_access_decision('f0000000-0000-4000-f000-000000000000') ->> 'reason'),
  'PAYMENT_REQUIRED',
  'Paid course should return PAYMENT_REQUIRED'
);

-- Clean up
ROLLBACK;
