BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(10);

-- Verify that the orders table exists
SELECT has_table('public', 'orders', 'Table orders should exist in public schema');

-- Verify that Row Level Security (RLS) is enabled on the orders table
SELECT results_eq(
    $$ SELECT relrowsecurity FROM pg_class WHERE relname = 'orders' $$,
    $$ VALUES (true) $$,
    'Row Level Security should be strictly active on orders table'
);

-- Verify that the expected RLS policies are defined
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'Orders select access'
  ),
  'Policy "Orders select access" must exist'
);

-- === BEHAVIORAL TESTS ===
INSERT INTO auth.users (id, aud, role, email) VALUES 
('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sale1@test.com'),
('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sale2@test.com'),
('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rando@test.com');

INSERT INTO public.orders (id, sale_user_id, customer_name, status) VALUES 
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Test Customer', 'draft'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test Customer', 'completed'),
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Test Customer', 'draft')
ON CONFLICT DO NOTHING;


-- 1. sale đọc được order có sale_user_id của mình
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('role', 'authenticated', true);
SELECT results_eq(
    $$ SELECT count(*)::int FROM public.orders WHERE id IN ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002') $$,
    $$ VALUES (2::int) $$,
    'sale đọc được order có sale_user_id của mình'
);

-- 2. sale không đọc order của sale khác
SELECT is_empty(
    $$ SELECT id FROM public.orders WHERE id = '20000000-0000-0000-0000-000000000001' $$,
    'sale không đọc order của sale khác'
);

-- 3. admin/sub_admin đọc được toàn bộ
SELECT set_config('role', 'postgres', true);
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.user_roles WHERE role IN ('admin', 'sub_admin') LIMIT 1), true);
SELECT set_config('role', 'authenticated', true);
SELECT results_eq(
    $$ SELECT count(*)::int FROM public.orders WHERE id IN ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001') $$,
    $$ VALUES (3::int) $$,
    'admin/sub_admin đọc được toàn bộ'
);

-- 4. authenticated user không có ownership không đọc được order
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
SELECT is_empty(
    $$ SELECT id FROM public.orders WHERE id IN ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001') $$,
    'authenticated user không có ownership không đọc được order'
);

-- 5. sale chỉ update order thuộc quyền
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT results_eq(
    $$ UPDATE public.orders SET note = 'test update' WHERE id = '10000000-0000-0000-0000-000000000001' RETURNING id $$,
    $$ VALUES ('10000000-0000-0000-0000-000000000001'::uuid) $$,
    'sale chỉ update order thuộc quyền'
);

-- sale update order của sale khác (không có quyền nên returning rỗng)
SELECT is_empty(
    $$ UPDATE public.orders SET note = 'test update false' WHERE id = '20000000-0000-0000-0000-000000000001' RETURNING id $$,
    'sale không update được order sale khác'
);

-- 6. sale chỉ delete order draft của mình
-- Delete successful
SELECT results_eq(
    $$ DELETE FROM public.orders WHERE id = '10000000-0000-0000-0000-000000000001' RETURNING id $$,
    $$ VALUES ('10000000-0000-0000-0000-000000000001'::uuid) $$,
    'sale chỉ delete order draft của mình'
);

-- Reset jwt claims just in case
SELECT set_config('role', 'postgres', true);
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT * FROM finish();

ROLLBACK;
