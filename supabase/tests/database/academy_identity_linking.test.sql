BEGIN;
SELECT plan(2);

-- 1. one auth user cannot own multiple conflicting student accounts
SELECT col_is_unique('public', 'student_accounts', 'user_id', 'One auth user cannot own multiple student accounts');

-- 2. one customer cannot link to multiple auth users
SELECT col_is_unique('public', 'student_accounts', 'customer_id', 'One customer cannot link to multiple auth users');

SELECT * FROM finish();
ROLLBACK;
