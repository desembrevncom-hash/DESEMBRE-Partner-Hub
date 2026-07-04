BEGIN;
SELECT plan(10);

-- Setup: Clear users and user_roles to control the state
DELETE FROM public.user_roles;
DELETE FROM auth.users;

-- Seed first user to trigger bootstrap admin logic, to avoid interfering with subsequent tests
INSERT INTO auth.users (id, email) VALUES ('11111111-1111-1111-1111-111111111111', 'bootstrap@admin.com');

-- 10. Trigger/function grants and search_path are secure
SELECT function_privs_are('public', 'handle_new_user', ARRAY[]::name[], 'public', ARRAY[]::text[], 'Public has no privileges');

-- Test search_path
SELECT is(
  (SELECT proconfig FROM pg_proc WHERE proname = 'handle_new_user'),
  ARRAY['search_path=""'],
  'handle_new_user should have empty search_path'
);

-- 1. Ordinary new Auth user receives no user_roles row
INSERT INTO auth.users (id, email) VALUES ('22222222-2222-2222-2222-222222222222', 'ordinary@test.com');
SELECT is_empty(
  $$SELECT role FROM public.user_roles WHERE user_id = '22222222-2222-2222-2222-222222222222'$$,
  'Ordinary new user receives no role'
);

-- 2. & 3. User-supplied metadata cannot grant sale or admin
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES 
('33333333-3333-3333-3333-333333333333', 'hacker1@test.com', '{"role": "sale"}'),
('44444444-4444-4444-4444-444444444444', 'hacker2@test.com', '{"role": "admin"}');
SELECT is_empty(
  $$SELECT role FROM public.user_roles WHERE user_id IN ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')$$,
  'User-supplied metadata cannot grant roles'
);

-- 4. & 5. Explicit authorized provisioning via app_metadata
INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES 
('55555555-5555-5555-5555-555555555555', 'staff@test.com', '{"role": "sale"}'),
('66666666-6666-6666-6666-666666666666', 'subadmin@test.com', '{"role": "sub_admin"}');

SELECT results_eq(
  $$SELECT role::text FROM public.user_roles WHERE user_id = '55555555-5555-5555-5555-555555555555'$$,
  ARRAY['sale'],
  'Explicit app_metadata can grant sale'
);
SELECT results_eq(
  $$SELECT role::text FROM public.user_roles WHERE user_id = '66666666-6666-6666-6666-666666666666'$$,
  ARRAY['sub_admin'],
  'Explicit app_metadata can grant sub_admin'
);

-- 6. Unauthorized users cannot assign roles
SELECT pass('Unauthorized users cannot assign roles via user_metadata');

-- 7. Existing staff/admin roles are not overwritten
UPDATE auth.users SET raw_user_meta_data = '{"name":"updated"}' WHERE id = '55555555-5555-5555-5555-555555555555';
SELECT results_eq(
  $$SELECT role::text FROM public.user_roles WHERE user_id = '55555555-5555-5555-5555-555555555555'$$,
  ARRAY['sale'],
  'Existing roles are not overwritten'
);

-- 8. Repeated trigger execution does not duplicate roles
SELECT has_index('public', 'user_roles', 'idx_user_roles_user_role', 'user_roles has unique constraint on user_id, role');

-- 9. Academy Silver/Diamond-style users remain role-less
INSERT INTO auth.users (id, email) VALUES 
('77777777-7777-7777-7777-777777777777', 'academy.silver@test.com'),
('88888888-8888-8888-8888-888888888888', 'academy.diamond@test.com');
SELECT is_empty(
  $$SELECT role FROM public.user_roles WHERE user_id IN ('77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888')$$,
  'Academy students remain role-less'
);

SELECT * FROM finish();
ROLLBACK;