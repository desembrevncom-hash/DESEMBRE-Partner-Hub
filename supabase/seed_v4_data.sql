-- SEED V4
-- Course A: published, public, open, dynamic, free
-- Course B: published, public, open, dynamic, included, minimum Gold rule, requires active membership

-- Create Tiers
INSERT INTO public.customer_tiers (id, code, name, rank, is_active)
VALUES 
  ('22222222-2222-4222-8222-222222222222', 'silver', 'Silver', 1, true),
  ('33333333-3333-4333-8333-333333333333', 'gold', 'Gold', 2, true),
  ('44444444-4444-4444-8444-444444444444', 'diamond', 'Diamond', 3, true)
ON CONFLICT (id) DO NOTHING;

-- Create Auth Users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES
  ('819884e7-4565-4445-a1b1-ed3f4ad44b62', 'academy.silver@test.desembre.local', '', now()),
  ('ecb6e47c-1050-41ad-94af-0cfce7c068e6', 'academy.diamond@test.desembre.local', '', now())
ON CONFLICT (id) DO NOTHING;

-- Create Customers
INSERT INTO public.customers (id, name, email)
VALUES
  ('c1111111-1111-4111-8111-111111111111', 'UI Silver Student', 'academy.silver@test.desembre.local'),
  ('c2222222-2222-4222-8222-222222222222', 'UI Diamond Student', 'academy.diamond@test.desembre.local')
ON CONFLICT (id) DO NOTHING;

-- Create Student Accounts
INSERT INTO public.student_accounts (id, user_id, customer_id)
VALUES
  ('51111111-1111-4111-8111-111111111111', '819884e7-4565-4445-a1b1-ed3f4ad44b62', 'c1111111-1111-4111-8111-111111111111'),
  ('52222222-2222-4222-8222-222222222222', 'ecb6e47c-1050-41ad-94af-0cfce7c068e6', 'c2222222-2222-4222-8222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- Create Memberships
INSERT INTO public.customer_tier_memberships (id, customer_id, tier_id, starts_at, ends_at)
VALUES
  ('e1111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', now(), null),
  ('e2222222-2222-4222-8222-222222222222', 'c2222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', now(), null)
ON CONFLICT (id) DO NOTHING;

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

-- Minimum Gold rule for Course B
-- Gold tier ID from known state: 33333333-3333-4333-8333-333333333333
INSERT INTO public.course_access_rules (id, course_id, tier_id, decision, access_scope, match_mode)
VALUES ('b3333333-3333-4333-b333-333333333333', 'b0000000-0000-4000-b000-000000000000', '33333333-3333-4333-8333-333333333333', 'allow', 'full', 'minimum')
ON CONFLICT (id) DO NOTHING;
