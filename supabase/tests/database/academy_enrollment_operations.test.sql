BEGIN;
SELECT plan(20);

-- 1. Setup mock data and roles
DELETE FROM public.user_roles;
DELETE FROM auth.users;

INSERT INTO auth.users (id, email) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@example.com'),
('00000000-0000-0000-0000-000000000002', 'subadmin@example.com'),
('00000000-0000-0000-0000-000000000003', 'student@example.com'),
('00000000-0000-0000-0000-000000000004', 'sale@example.com');

INSERT INTO public.user_roles (user_id, role) VALUES
('00000000-0000-0000-0000-000000000001', 'admin'),
('00000000-0000-0000-0000-000000000002', 'sub_admin'),
('00000000-0000-0000-0000-000000000004', 'sale')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.student_accounts (id, user_id, status) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'active'),
('11111111-1111-1111-1111-111111111112', '00000000-0000-0000-0000-000000000004', 'blocked');

INSERT INTO public.course_categories (id, slug, name, status) VALUES 
('22222222-2222-2222-2222-222222222222', 'cat', 'Cat', 'published');

INSERT INTO public.courses (id, category_id, slug, title, status, catalog_visibility, enrollment_policy, access_policy, pricing_model) VALUES
('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'pub', 'pub', 'published', 'public', 'approval', 'dynamic', 'free'),
('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'draft', 'draft', 'draft', 'public', 'open', 'dynamic', 'free'),
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'arch', 'arch', 'archived', 'public', 'open', 'dynamic', 'free');

INSERT INTO public.enrollments (id, student_id, course_id, status, source) VALUES
('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'pending', 'self'),
('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333332', 'active', 'self');

-- Test 1: Admin lists pending enrollments
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);
SELECT ok((public.admin_list_academy_enrollments() IS NOT NULL), 'Admin can list enrollments');

-- Test 2: Sub_admin lists enrollments
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SELECT ok((public.admin_list_academy_enrollments() IS NOT NULL), 'Sub admin can list enrollments');

-- Test 3: Student denied
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003", "role":"authenticated"}', true);
SELECT throws_ok(
  'SELECT public.admin_list_academy_enrollments()',
  'FORBIDDEN',
  'Student denied'
);

-- Test 4: Sale denied
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004", "role":"authenticated"}', true);
SELECT throws_ok(
  'SELECT public.admin_list_academy_enrollments()',
  'FORBIDDEN',
  'Sale denied'
);

-- Test 5: Anonymous denied
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT throws_ok(
  'SELECT public.admin_list_academy_enrollments()',
  'UNAUTHORIZED',
  'Anon denied'
);

-- Switch back to admin for mutations
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);

-- Test 6: Approve pending -> active
SELECT ok((public.admin_approve_academy_enrollment('44444444-4444-4444-4444-444444444441')->>'success')::boolean, 'Approve pending succeeds');
SELECT results_eq(
  'SELECT status FROM public.enrollments WHERE id = ''44444444-4444-4444-4444-444444444441''',
  ARRAY['active'],
  'Status updated to active'
);
SELECT ok((SELECT approved_by FROM public.enrollments WHERE id = '44444444-4444-4444-4444-444444444441') = '00000000-0000-0000-0000-000000000001'::uuid, 'Approved_by set');

-- Test 7: Approve active -> idempotent
SELECT ok((public.admin_approve_academy_enrollment('44444444-4444-4444-4444-444444444441')->>'success')::boolean, 'Approve active is idempotent');

-- Test 8: Reject active -> rejected
SELECT throws_ok(
  'SELECT public.admin_reject_academy_enrollment(''44444444-4444-4444-4444-444444444441'')',
  'INVALID_ENROLLMENT_STATUS',
  'Reject active is denied'
);

-- Test 9: Reject pending -> rejected
-- reset status first
UPDATE public.enrollments SET status = 'pending' WHERE id = '44444444-4444-4444-4444-444444444441';
SELECT ok((public.admin_reject_academy_enrollment('44444444-4444-4444-4444-444444444441', 'Bad request')->>'success')::boolean, 'Reject pending succeeds');
SELECT results_eq(
  'SELECT status FROM public.enrollments WHERE id = ''44444444-4444-4444-4444-444444444441''',
  ARRAY['rejected'],
  'Status updated to rejected'
);
SELECT ok((SELECT rejected_by FROM public.enrollments WHERE id = '44444444-4444-4444-4444-444444444441') = '00000000-0000-0000-0000-000000000001'::uuid, 'Rejected_by set');

-- Test 10: Reject rejected -> idempotent
SELECT ok((public.admin_reject_academy_enrollment('44444444-4444-4444-4444-444444444441', 'x')->>'success')::boolean, 'Reject rejected is idempotent');

-- Test 11: Manual assign published course succeeds
SELECT ok((public.admin_assign_academy_course_to_student('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331')->>'success')::boolean, 'Manual assign succeeds');
SELECT results_eq(
  'SELECT source FROM public.enrollments WHERE student_id = ''11111111-1111-1111-1111-111111111111'' AND course_id = ''33333333-3333-3333-3333-333333333331''',
  ARRAY['admin'],
  'Source set to admin'
);

-- Test 12: Manual assign draft course rejected
SELECT throws_ok(
  'SELECT public.admin_assign_academy_course_to_student(''11111111-1111-1111-1111-111111111111'', ''33333333-3333-3333-3333-333333333332'')',
  'COURSE_NOT_PUBLISHED',
  'Manual assign draft course rejected'
);

-- Test 13: Manual assign archived course rejected
SELECT throws_ok(
  'SELECT public.admin_assign_academy_course_to_student(''11111111-1111-1111-1111-111111111111'', ''33333333-3333-3333-3333-333333333333'')',
  'COURSE_NOT_PUBLISHED',
  'Manual assign archived course rejected'
);

-- Test 14: Manual assign duplicate idempotent
SELECT ok((public.admin_assign_academy_course_to_student('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331')->>'success')::boolean, 'Manual assign duplicate idempotent');

-- Test 15: Blocked student assignment rejected
SELECT throws_ok(
  'SELECT public.admin_assign_academy_course_to_student(''11111111-1111-1111-1111-111111111112'', ''33333333-3333-3333-3333-333333333331'')',
  'STUDENT_NOT_ACTIVE',
  'Blocked student assignment rejected'
);

SELECT * FROM finish();
ROLLBACK;
