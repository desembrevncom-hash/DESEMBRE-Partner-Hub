BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(12);

-- Function Signatures
SELECT has_function('public', 'resolve_facebook_identity_manual_review', ARRAY['uuid', 'text', 'fb_resolution_job_status', 'text', 'text']::name[], 'Function resolve_facebook_identity_manual_review exists');
SELECT has_function('public', 'apply_facebook_name_to_customer', ARRAY['uuid', 'uuid', 'boolean']::name[], 'Function apply_facebook_name_to_customer exists');

-- Mock users
WITH new_users AS (
  INSERT INTO auth.users (id, aud, role, email) VALUES 
    ('00000000-0000-0000-0000-222222222222'::uuid, 'authenticated', 'authenticated', 'sale_owner_fb@local.test'),
    ('00000000-0000-0000-0000-333333333333'::uuid, 'authenticated', 'authenticated', 'sale_other_fb@local.test')
  RETURNING id
) SELECT 1;

-- Clear auto-inserted roles
DELETE FROM public.user_roles WHERE user_id IN (
  '00000000-0000-0000-0000-222222222222'::uuid,
  '00000000-0000-0000-0000-333333333333'::uuid
);

INSERT INTO public.user_roles (user_id, role) VALUES 
  ('00000000-0000-0000-0000-222222222222'::uuid, 'sale'::public.app_role),
  ('00000000-0000-0000-0000-333333333333'::uuid, 'sale'::public.app_role);

-- Mock data
INSERT INTO public.customers (id, name, owner_sale_id) VALUES 
  ('00000000-0000-0000-0000-444444444444'::uuid, 'http://fb.com/user1', '00000000-0000-0000-0000-222222222222'::uuid);

INSERT INTO public.customer_social_profiles (id, customer_id, platform, raw_url, facebook_display_name, resolver_status) VALUES 
  ('00000000-0000-0000-0000-555555555555'::uuid, '00000000-0000-0000-0000-444444444444'::uuid, 'facebook', 'http://fb.com/user1', 'Valid FB Name', 'unresolved'::public.resolver_status),
  ('00000000-0000-0000-0000-777777777777'::uuid, '00000000-0000-0000-0000-444444444444'::uuid, 'facebook', 'http://fb.com/user2', 'Another Name', 'unresolved'::public.resolver_status);

INSERT INTO public.facebook_identity_resolution_jobs (id, customer_id, raw_url, status) VALUES 
  ('00000000-0000-0000-0000-666666666661'::uuid, '00000000-0000-0000-0000-444444444444'::uuid, 'http://fb.com/user1', 'manual_review_required'),
  ('00000000-0000-0000-0000-666666666662'::uuid, '00000000-0000-0000-0000-444444444444'::uuid, 'http://fb.com/user2', 'manual_review_required');

-- ----------------------------------------------------------------------------------
-- Test apply_facebook_name_to_customer
-- ----------------------------------------------------------------------------------

-- 1. Unprivileged user
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-333333333333"}', true);
SELECT is(
    (SELECT public.apply_facebook_name_to_customer('00000000-0000-0000-0000-444444444444'::uuid, '00000000-0000-0000-0000-555555555555'::uuid)->>'success'),
    'false',
    'Other sale user should be denied'
);

-- 2. Owner sale user
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-222222222222"}', true);
SELECT is(
    (SELECT public.apply_facebook_name_to_customer('00000000-0000-0000-0000-444444444444'::uuid, '00000000-0000-0000-0000-555555555555'::uuid)->>'success'),
    'true',
    'Owner sale user should be allowed'
);

-- Reset config to postgres to check data
SELECT set_config('role', 'postgres', true);
SELECT is(
    (SELECT name FROM public.customers WHERE id = '00000000-0000-0000-0000-444444444444'::uuid),
    'Valid FB Name',
    'Customer name should be updated properly without array casting error'
);

-- ----------------------------------------------------------------------------------
-- Test resolve_facebook_identity_manual_review
-- ----------------------------------------------------------------------------------

-- Switch to unprivileged sale user
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-222222222222"}', true);
SELECT throws_ok(
    $$ SELECT public.resolve_facebook_identity_manual_review('00000000-0000-0000-0000-666666666661'::uuid, NULL, 'ignored'::public.fb_resolution_job_status, NULL, NULL) $$,
    'Access denied. Must be Admin or Sub-admin.',
    'Non-admin should not be able to resolve identity'
);

-- Switch to admin
SELECT set_config('role', 'postgres', true);
SELECT set_config('request.jwt.claims', format('{"sub":"%s"}', (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1)), true);
SELECT set_config('role', 'authenticated', true);

-- Test 'ignored' maps to 'unresolved'
SELECT lives_ok(
    $$ SELECT public.resolve_facebook_identity_manual_review('00000000-0000-0000-0000-666666666661'::uuid, NULL, 'ignored'::public.fb_resolution_job_status, NULL, NULL) $$,
    'Admin can resolve identity as ignored'
);

-- Switch back to postgres
SELECT set_config('role', 'postgres', true);

-- Verify status mapping
SELECT is(
    (SELECT resolver_status::text FROM public.customer_social_profiles WHERE id = '00000000-0000-0000-0000-555555555555'::uuid),
    'unresolved',
    'Status ignored should map to unresolved in social_profiles'
);

-- Test 'failed' maps to 'failed'
SELECT set_config('role', 'postgres', true);
SELECT set_config('request.jwt.claims', format('{"sub":"%s"}', (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1)), true);
SELECT set_config('role', 'authenticated', true);
SELECT lives_ok(
    $$ SELECT public.resolve_facebook_identity_manual_review('00000000-0000-0000-0000-666666666662'::uuid, NULL, 'failed'::public.fb_resolution_job_status, NULL, NULL) $$,
    'Admin can resolve identity as failed'
);

SELECT set_config('role', 'postgres', true);
SELECT is(
    (SELECT resolver_status::text FROM public.customer_social_profiles WHERE id = '00000000-0000-0000-0000-777777777777'::uuid),
    'failed',
    'Status failed should map to failed in social_profiles'
);

-- Execute rights
SELECT results_eq(
    $$ SELECT has_function_privilege('anon', 'public.resolve_facebook_identity_manual_review(uuid, text, public.fb_resolution_job_status, text, text)', 'EXECUTE') $$,
    $$ VALUES (false) $$,
    'anon should not have execute privilege'
);

SELECT results_eq(
    $$ SELECT has_function_privilege('anon', 'public.apply_facebook_name_to_customer(uuid, uuid, boolean)', 'EXECUTE') $$,
    $$ VALUES (false) $$,
    'anon should not have execute privilege'
);

ROLLBACK;
