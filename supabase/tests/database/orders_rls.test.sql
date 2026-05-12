BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(3);

-- Verify that the orders table exists
SELECT has_table('public', 'orders', 'Table orders should exist in public schema');

-- Verify that Row Level Security (RLS) is enabled on the orders table
SELECT results_eq(
    $$ SELECT relrowsecurity FROM pg_class WHERE relname = 'orders' $$,
    $$ VALUES (true) $$,
    'Row Level Security should be strictly active on orders table'
);

-- Verify that the expected RLS policies are defined
SELECT has_policy('public', 'orders', 'Sale view own orders', 'Policy "Sale view own orders" must exist');

SELECT * FROM finish();

ROLLBACK;
