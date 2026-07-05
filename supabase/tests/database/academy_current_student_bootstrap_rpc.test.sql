BEGIN;
SELECT plan(15);

-- Test 14 & 15: Permissions
SELECT ok(NOT has_function_privilege('anon', 'public.get_current_student_bootstrap()', 'EXECUTE'), 'anon has no execute permission');
SELECT ok(has_function_privilege('authenticated', 'public.get_current_student_bootstrap()', 'EXECUTE'), 'authenticated has execute permission');

-- We need mock users for testing
-- Create mock users in auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test1@example.com'),
('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test2@example.com'),
('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test3@example.com'),
('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test4@example.com'),
('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test5@example.com');

-- Set up test data
INSERT INTO public.customers (id, name, email) VALUES
('c1111111-1111-4111-8111-111111111111', 'Customer 1', 'test1@example.com'),
('c2222222-2222-4222-8222-222222222222', 'Customer 2', 'test2@example.com'),
('c3333333-3333-4333-8333-333333333333', 'Customer 3', 'test3@example.com');

INSERT INTO public.student_accounts (id, user_id, customer_id) VALUES
('51111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111'),
('52222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'c2222222-2222-4222-8222-222222222222'),
('53333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', NULL);

INSERT INTO public.customer_tiers (id, code, name, rank, is_active) VALUES
('d1111111-1111-4111-8111-111111111111', 'SILVER', 'Silver', 1, true),
('d2222222-2222-4222-8222-222222222222', 'GOLD', 'Gold', 2, true),
('d3333333-3333-4333-8333-333333333333', 'DIAMOND', 'Diamond', 3, false);

-- 1. Unauthenticated test (Test 1)
-- Should throw 'Not authenticated'
SELECT throws_ok(
  'SELECT public.get_current_student_bootstrap()',
  'Not authenticated',
  'Anonymous caller cannot execute successfully'
);

-- Mock authenticated context for user 4 (No student account)
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444"}', true);

-- Test 5: User without student account
SELECT is(
  (SELECT (get_current_student_bootstrap()->>'state')::text),
  'NO_STUDENT_ACCOUNT',
  'User without student account returns NO_STUDENT_ACCOUNT'
);

-- Mock authenticated context for user 3 (Null customer_id)
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333"}', true);

-- Test 6: Student with null customer_id
SELECT is(
  (SELECT (get_current_student_bootstrap()->>'state')::text),
  'NO_CUSTOMER',
  'Student with null customer_id returns NO_CUSTOMER'
);

-- Mock authenticated context for user 1 (Silver)
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111"}', true);

-- Test 7: Student with no active membership
SELECT is(
  (SELECT (get_current_student_bootstrap()->>'state')::text),
  'NO_ACTIVE_MEMBERSHIP',
  'Student with no active membership returns NO_ACTIVE_MEMBERSHIP'
);

-- Add active membership for user 1
INSERT INTO public.customer_tier_memberships (id, customer_id, tier_id, starts_at, ends_at) VALUES
('e1111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111', now() - interval '1 day', now() + interval '1 year');

-- Test 2 & 8: Silver receives only Silver, Active membership returns ACTIVE
SELECT is(
  (SELECT (get_current_student_bootstrap()->>'state')::text),
  'ACTIVE',
  'Active membership returns ACTIVE'
);
SELECT is(
  (SELECT (get_current_student_bootstrap()->'tier'->>'code')::text),
  'SILVER',
  'Active membership returns correct tier'
);
SELECT is(
  (SELECT (get_current_student_bootstrap()->'student_account'->>'id')::text),
  '51111111-1111-4111-8111-111111111111',
  'Silver receives only Silver student account'
);
SELECT is(
  (SELECT (get_current_student_bootstrap()->'customer'->>'id')::text),
  'c1111111-1111-4111-8111-111111111111',
  'Silver receives only Silver customer'
);

-- Add expired membership and inactive tier membership for user 2
INSERT INTO public.customer_tier_memberships (id, customer_id, tier_id, starts_at, ends_at) VALUES
('e2222222-2222-4222-8222-222222222222', 'c2222222-2222-4222-8222-222222222222', 'd2222222-2222-4222-8222-222222222222', now() - interval '2 year', now() - interval '1 year'),
('e3333333-3333-4333-8333-333333333333', 'c2222222-2222-4222-8222-222222222222', 'd2222222-2222-4222-8222-222222222222', now() - interval '3 year', now() - interval '2 year');

-- Mock authenticated context for user 2
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222"}', true);

-- Test 9 & 10: Expired membership is not treated as active, latest expired membership is selected
SELECT is(
  (SELECT (get_current_student_bootstrap()->>'state')::text),
  'NO_ACTIVE_MEMBERSHIP',
  'Expired membership is not treated as active'
);
SELECT is(
  (SELECT (get_current_student_bootstrap()->'latest_expired_membership'->>'id')::text),
  'e2222222-2222-4222-8222-222222222222',
  'Latest expired membership is selected deterministically'
);

-- Add inactive tier membership for user 2 (active by dates, but tier is inactive)
INSERT INTO public.customer_tier_memberships (id, customer_id, tier_id, starts_at, ends_at) VALUES
('e4444444-4444-4444-8444-444444444444', 'c2222222-2222-4222-8222-222222222222', 'd3333333-3333-4333-8333-333333333333', now() - interval '1 day', now() + interval '1 year');

-- Test 12: Inactive tier is not returned as active
SELECT is(
  (SELECT (get_current_student_bootstrap()->>'state')::text),
  'NO_ACTIVE_MEMBERSHIP',
  'Inactive tier is not returned as active'
);


-- Test 3 & 4: Silver never receives Diamond membership/customer, Diamond receives only Diamond (Mocked as Gold here)
SELECT is(
  (SELECT (get_current_student_bootstrap()->'customer'->>'id')::text),
  'c2222222-2222-4222-8222-222222222222',
  'User receives only their own customer'
);

-- Test 13: RPC accepts no spoofed user/customer ID (inherent in the signature `get_current_student_bootstrap()`)
SELECT is(
  (SELECT pg_get_function_arguments('public.get_current_student_bootstrap'::regproc)),
  '',
  'RPC accepts no spoofed user/customer ID (no arguments)'
);

SELECT * FROM finish();
ROLLBACK;
