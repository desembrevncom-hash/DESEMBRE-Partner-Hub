BEGIN;

-- 1. Create necessary pgtap extension if missing
CREATE EXTENSION IF NOT EXISTS pgtap;

-- 2. Plan tests
SELECT plan(17);

-- 3. Function Signatures (1-2)
SELECT has_function('public', 'get_ai_settings_masked', ARRAY[]::name[], 'Function get_ai_settings_masked should exist with exact signature');
SELECT has_function('public', 'update_ai_settings', ARRAY['text', 'text', 'text', 'boolean', 'boolean', 'boolean', 'boolean', 'integer', 'numeric', 'text', 'integer', 'numeric', 'text', 'text', 'text', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'integer', 'integer'], 'Function update_ai_settings should exist with exact 22-param signature');

-- Create mock user
WITH new_user AS (
  INSERT INTO auth.users (id, aud, role, email) VALUES 
    ('00000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'admin@local.test'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'subadmin@local.test'),
    ('00000000-0000-0000-0000-000000000003'::uuid, 'authenticated', 'authenticated', 'sale@local.test'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'authenticated', 'authenticated', 'user@local.test')
  RETURNING id
)
SELECT 1;

-- Clear existing admins to avoid unique constraint "idx_user_roles_single_admin"
UPDATE public.user_roles SET role = 'sub_admin' WHERE role = 'admin';

-- Delete any auto-created roles for our mock users
DELETE FROM public.user_roles 
WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid
);

INSERT INTO public.user_roles (user_id, role) VALUES 
  ('00000000-0000-0000-0000-000000000001'::uuid, 'admin'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'sub_admin'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'sale');

-- Seed provider settings
INSERT INTO public.system_ai_provider_settings (id, provider, encrypted_api_key) VALUES 
  ('11111111-1111-1111-1111-111111111111'::uuid, 'openai', 'some_secret_key_1'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'gemini', NULL),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'anthropic', '');

-- Test get_ai_settings_masked Authorization (3-7)

-- Switch to admin
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
SELECT lives_ok(
    $$ SELECT public.get_ai_settings_masked(); $$,
    'Admin should be able to call get_ai_settings_masked'
);

-- Sub Admin
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002"}', true);
SELECT lives_ok(
    $$ SELECT public.get_ai_settings_masked(); $$,
    'Sub_admin should be able to call get_ai_settings_masked'
);

-- Sale
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003"}', true);
SELECT throws_ok(
    $$ SELECT public.get_ai_settings_masked(); $$,
    'Access denied. Only Admins can view masked AI settings.',
    'Sale should be denied from calling get_ai_settings_masked'
);

-- User
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004"}', true);
SELECT throws_ok(
    $$ SELECT public.get_ai_settings_masked(); $$,
    'Access denied. Only Admins can view masked AI settings.',
    'Regular user should be denied from calling get_ai_settings_masked'
);

-- Return to Admin to check outputs
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);

-- Test Output Content (8-12)
SELECT is(
    (SELECT public.get_ai_settings_masked()->>'openai_key_configured'),
    'true',
    'OpenAI key should be configured'
);

SELECT is(
    (SELECT public.get_ai_settings_masked()->>'gemini_key_configured'),
    'false',
    'Gemini key should not be configured (NULL)'
);

SELECT is(
    (SELECT public.get_ai_settings_masked()->>'anthropic_key_configured'),
    'false',
    'Anthropic key should not be configured (empty string)'
);

SELECT results_eq(
    $$ SELECT (public.get_ai_settings_masked() ? 'encrypted_api_key') $$,
    $$ VALUES (false) $$,
    'Output should not contain encrypted_api_key'
);

SELECT results_eq(
    $$ SELECT (public.get_ai_settings_masked()::text ILIKE '%some_secret_key_1%') $$,
    $$ VALUES (false) $$,
    'Output should not contain plaintext secret'
);

-- Test update_ai_settings (13-16)
SELECT throws_ok(
    $$ SELECT public.update_ai_settings(p_openai_api_key := 'new_key') $$,
    'API keys cannot be updated via update_ai_settings. Use the secure provider settings interface.',
    'Updating deprecated API key should throw exception'
);

SELECT throws_ok(
    $$ SELECT public.update_ai_settings(p_gemini_api_key := 'new_key') $$,
    'API keys cannot be updated via update_ai_settings. Use the secure provider settings interface.',
    'Updating deprecated Gemini key should throw exception'
);

SELECT lives_ok(
    $$ SELECT public.update_ai_settings(p_provider := 'anthropic') $$,
    'Updating non-sensitive settings should succeed'
);

-- Switch back to postgres role to verify database state without RLS restrictions
SELECT set_config('role', 'postgres', true);

SELECT is(
    (SELECT provider FROM public.ai_settings WHERE id = 'default'),
    'anthropic',
    'Provider should be updated to anthropic'
);

-- Check Grants (17-18)
SELECT results_eq(
    $$ SELECT has_function_privilege('anon', 'public.get_ai_settings_masked()', 'EXECUTE') $$,
    $$ VALUES (false) $$,
    'anon should not have EXECUTE privilege on get_ai_settings_masked'
);

SELECT results_eq(
    $$ SELECT has_function_privilege('anon', 'public.update_ai_settings(text, text, text, boolean, boolean, boolean, boolean, integer, numeric, text, integer, numeric, text, text, text, boolean, boolean, boolean, boolean, boolean, integer, integer)', 'EXECUTE') $$,
    $$ VALUES (false) $$,
    'anon should not have EXECUTE privilege on update_ai_settings'
);

ROLLBACK;
