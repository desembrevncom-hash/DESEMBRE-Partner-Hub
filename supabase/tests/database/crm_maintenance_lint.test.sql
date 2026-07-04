BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(19);

-- Test 1-3: Function signatures and existence
SELECT has_function('public', 'run_crm_maintenance_tasks', '{}', 'run_crm_maintenance_tasks should exist');
SELECT has_function('public', 'get_workspace_execution_dashboard', '{}', 'get_workspace_execution_dashboard should exist');
SELECT has_function('public', 'run_active_automation_rules', '{}', 'run_active_automation_rules should exist');
-- We will just rely on dynamic queries to find the admin and sale users.
-- We assume that at least one admin and one sale user exists, or we will just let the test fail.
-- Actually, let's insert a sale user if none exists.
SELECT set_config('role', 'postgres', true);

INSERT INTO auth.users (id, email) VALUES 
('22222222-2222-2222-2222-222222222222', 'testsale_fresh@example.com')
ON CONFLICT DO NOTHING;

-- Ensure the user is a sale
UPDATE public.user_roles SET role = 'sale' WHERE user_id = '22222222-2222-2222-2222-222222222222';

-- Get variables
SELECT set_config('role', 'postgres', true);
SELECT set_config('my.admin_id', (SELECT id::text FROM auth.users WHERE email = 'desembrevn.com@gmail.com' LIMIT 1), true);
SELECT set_config('my.sale_id', (SELECT user_id::text FROM public.user_roles WHERE role = 'sale' LIMIT 1), true);

-- Test 4: run_crm_maintenance_tasks runs without syntax errors
-- (It shouldn't do much because there is no overdue task data, but it proves the column issue is fixed)
SELECT set_config('role', 'postgres', true);

SELECT lives_ok(
    $$ SELECT public.run_crm_maintenance_tasks() $$,
    'run_crm_maintenance_tasks executes successfully without missing column error'
);

-- Test 5-6: get_workspace_execution_dashboard runs
SELECT set_config('role', 'postgres', true);
SELECT set_config('request.jwt.claims', format('{"sub":"%s"}', current_setting('my.admin_id', true)), true);
SELECT set_config('role', 'authenticated', true);
SELECT lives_ok(
    $$ SELECT public.get_workspace_execution_dashboard() $$,
    'get_workspace_execution_dashboard executes successfully as admin'
);

SELECT results_eq(
    $$ SELECT (public.get_workspace_execution_dashboard()->'counters'->>'overdue_count')::int >= 0 $$,
    ARRAY[true],
    'Dashboard returns proper structure for admin'
);

-- Switch to Sale User
SELECT set_config('role', 'postgres', true);
SELECT set_config('request.jwt.claims', format('{"sub":"%s"}', current_setting('my.sale_id', true)), true);
SELECT set_config('role', 'authenticated', true);

-- Test 7-8: get_workspace_execution_dashboard as sale
SELECT lives_ok(
    $$ SELECT public.get_workspace_execution_dashboard() $$,
    'get_workspace_execution_dashboard executes successfully as sale'
);

SELECT results_eq(
    $$ SELECT (public.get_workspace_execution_dashboard()->'counters'->>'lead_to_call_count')::int >= 0 $$,
    ARRAY[true],
    'Dashboard returns proper structure for sale user'
);

-- Test 9: run_active_automation_rules access control
SELECT throws_ok(
    $$ SELECT public.run_active_automation_rules() $$,
    'P0001',
    'Permission denied.',
    'run_active_automation_rules throws permission denied for sale user'
);

-- Switch back to Admin
SELECT set_config('role', 'postgres', true);
SELECT set_config('request.jwt.claims', format('{"sub":"%s"}', current_setting('my.admin_id', true)), true);
SELECT set_config('role', 'authenticated', true);

-- Debug Test: Check if auth.uid() is returning the expected value
SELECT results_eq(
    $$ SELECT auth.uid() IS NOT NULL $$,
    ARRAY[true],
    'auth.uid() returns a non-null value'
);

SELECT set_config('role', 'postgres', true);

-- Debug Test: Dump all user_roles
SELECT results_eq(
    $$ SELECT count(*) > 0 FROM public.user_roles $$,
    ARRAY[true],
    'user_roles count'
);

SELECT results_eq(
    $$ SELECT count(*) FROM auth.users WHERE email = 'desembrevn.com@gmail.com' $$,
    ARRAY[1::bigint],
    'Admin user exists in auth.users'
);

SELECT results_eq(
    $$ SELECT role FROM public.user_roles WHERE user_id = current_setting('my.admin_id', true)::uuid $$,
    ARRAY['admin'::public.app_role],
    'Admin user has admin role in user_roles'
);

SELECT set_config('request.jwt.claims', format('{"sub":"%s"}', current_setting('my.admin_id', true)), true);
SELECT set_config('role', 'authenticated', true);

-- Test 12: Check is_admin_or_sub_admin
SELECT results_eq(
    $$ SELECT public.is_admin_or_sub_admin(current_setting('my.admin_id', true)::uuid) $$,
    ARRAY[true],
    'is_admin_or_sub_admin returns true for admin user'
);

-- Test 13: run_active_automation_rules runs successfully
SELECT lives_ok(
    $$ SELECT public.run_active_automation_rules() $$,
    'run_active_automation_rules executes successfully as admin without v_pilot_enabled warning'
);

SELECT results_eq(
    $$ SELECT (public.run_active_automation_rules()->>'success')::boolean $$,
    ARRAY[false],
    'run_active_automation_rules returns success false when no rules exist'
);

SELECT results_eq(
    $$ SELECT public.run_active_automation_rules()->>'message' $$,
    ARRAY['Automation is disabled globally.'],
    'run_active_automation_rules returns correct message'
);

-- Clean up configuration
SELECT set_config('role', 'postgres', true);

-- Test 15-16: Security Definer constraints
SELECT results_eq(
    $$ SELECT prosecdef FROM pg_proc WHERE proname = 'run_crm_maintenance_tasks' $$,
    ARRAY[true],
    'run_crm_maintenance_tasks is SECURITY DEFINER'
);

SELECT results_eq(
    $$ SELECT has_function_privilege('anon', 'public.run_crm_maintenance_tasks()', 'EXECUTE') $$,
    ARRAY[false],
    'anon cannot execute run_crm_maintenance_tasks'
);

SELECT * FROM finish();
ROLLBACK;
