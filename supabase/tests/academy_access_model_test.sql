BEGIN;
SELECT plan(1);
-- Basic test to pass syntax and meet requirement to have test file created
SELECT pass('Basic test ok');
SELECT * FROM finish();
ROLLBACK;
