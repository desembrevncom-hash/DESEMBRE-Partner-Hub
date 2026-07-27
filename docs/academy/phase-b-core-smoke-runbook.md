# Phase B: Academy Core Smoke Runbook

**Goal**: Bring DESEMBRE Academy into early internal use, verifying the core flows from student signup to course enrollment within the Academy environment itself.
**Status**: Runbook ready. Manual smoke test pending. Internal Academy pilot GO only after smoke PASS.
**Academy Project Ref**: `ynmcoeapfycijblydyuw`

> [!WARNING]
> This smoke test is strictly isolated to the Academy. Do not use the Partner Hub project (`xhfqjupiidexvlltstal`) for this test. Partner Hub sync will be handled in Phase D. Do not touch real email campaigns or marketing sends.

---

## 1. Environment & Pre-Flight Confirmation
Before beginning the smoke test, verify the environment and configurations:
1. **Academy App**: Running locally or on production domain, pointing exclusively to the Academy Supabase project (`ynmcoeapfycijblydyuw`).
2. **Zalo ZNS Function**: Ensure `send-otp-zalo-zns` is deployed to the Academy Supabase project and `ZALO_ZNS_OTP_TEMPLATE_ID` is set.
3. **Database Schema**: Verify that tables `student_accounts`, `courses`, and `enrollments` exist on the Academy project.

## 2. Acceptance Criteria
The manual smoke test is considered a PASS only if all of the following are met:
- [ ] OTP Zalo is successfully received upon signup/login.
- [ ] Student reaches the `pending-review` screen (or blocked state) initially.
- [ ] Admin approval successfully changes the student status to `active`.
- [ ] Approved student can bypass the pending screen and access the course/dashboard.
- [ ] Student enrollment correctly appears in the `enrollments` table.
- [ ] Test data is safely cleaned up after the test.

---

## 3. Execution Steps

### Step 1: Test Student Creation & Zalo OTP Flow
1. Open the Academy app.
2. Navigate to **Đăng ký** (Signup).
3. Enter a valid test phone number and fill in the required details.
4. **Expected**: A Zalo ZNS OTP message is delivered to the phone number.
5. Enter the OTP in the Academy app.
6. **Expected**: The Supabase Auth hook returns `{}` on success, and a user record is created in the Academy DB.

### Step 2: Expected `pending-review` State
1. Upon successful OTP verification, the user is logged into the Academy app.
2. **Expected**: The user should be redirected to the `/pending-review` route (or blocked UI) since their default status is `pending_review`.
3. They should not be able to access premium courses yet.

### Step 3: Admin Approval Flow (Academy DB)
Since Phase D (Partner Hub Sync) is not implemented yet, we will simulate the Admin approval directly on the Academy project's database or using the Academy Admin UI if available.
1. Run the status update RPC or query on the Academy project (`ynmcoeapfycijblydyuw`).
```sql
-- Simulate Admin approval
UPDATE public.student_accounts 
SET status = 'active' 
WHERE phone = '+84xxxxxxxxx';
```
2. **Expected**: The student status is updated to `active`.

### Step 4: Student Login After Approval
1. Return to the Academy app (refresh or log out and log back in).
2. **Expected**: The student is no longer on the `/pending-review` route.
3. They should have access to the main dashboard / catalog.

### Step 5: Enrollments Verification
1. As the approved student in the Academy app, attempt to view or enroll in a free/demo course.
2. **Expected**: The student's enrollment should be successfully created in the Academy database.

---

## 4. SQL Verification Queries
Run these queries exclusively on the **Academy Supabase project (`ynmcoeapfycijblydyuw`)** via the SQL Editor.

**Schema Inspection:**
```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('student_accounts', 'courses', 'enrollments')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

**Check Default Status (Hardening Check):**
```sql
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'student_accounts'
  AND column_name = 'status';
-- Expected: 'pending_review'::text
```

**Check Unique Index (Hardening Check):**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'student_accounts'
  AND indexdef ILIKE '%user_id%';
```

**Check Student Status:**
```sql
SELECT id, phone, status, created_at 
FROM public.student_accounts 
WHERE phone = '+84xxxxxxxxx'; -- Replace with test phone
```

**Check Enrollments:**
```sql
SELECT e.id, c.title, e.status, e.enrolled_at
FROM public.enrollments e
JOIN public.courses c ON e.course_id = c.id
JOIN public.student_accounts s ON e.student_account_id = s.id
WHERE s.phone = '+84xxxxxxxxx';
```

---

## 5. Rollback / Cleanup Test Data
To keep the database clean, remove the test student data after the smoke test. Run this on the Academy Project (`ynmcoeapfycijblydyuw`):

```sql
-- Delete enrollments first
DELETE FROM public.enrollments 
WHERE student_account_id IN (
  SELECT id FROM public.student_accounts WHERE phone = '+84xxxxxxxxx'
);

-- Delete student account
DELETE FROM public.student_accounts WHERE phone = '+84xxxxxxxxx';

-- Delete auth user
DELETE FROM auth.users WHERE phone = '+84xxxxxxxxx'; 
```

## 6. Known Blocker & Resolution (Provisioning Fix)
**Blocker Observed**: After Zalo OTP verification, students received 'Your Academy profile is incomplete.' instead of being placed in 'pending_review' because they lacked a \student_accounts\ row.
**Resolution**:
- **Backend**: Created RPC `ensure_current_student_account` to automatically provision missing `student_accounts` with `pending_review` status upon login. Updated `get_current_student_bootstrap` to return the account `status`. Hardened schema by changing default status to `pending_review` and adding a unique index on `user_id`.
- **Frontend**: Updated `student.service.ts` to invoke this RPC before fetching the bootstrap payload. Updated `StudentLayout.tsx` to automatically redirect users to `/pending-review` or `/blocked` based on the returned status.

### How to re-test with an old vs new phone number:
- **If using an old phone that is already 'blocked'**: The `ensure_current_student_account` RPC will NOT overwrite the blocked status. You will be redirected to `/blocked`.
- **If you want to test 'pending_review' with an old phone**: You must manually reset it in the database first:
  ```sql
  UPDATE public.student_accounts sa
  SET status = 'pending_review', updated_at = now()
  FROM auth.users u
  WHERE u.id = sa.user_id AND u.phone ILIKE '%964638228%';
  ```
- **If using a new/clean phone (Recommended)**: Log out, go to `/auth/login`, submit your new phone number, and enter the OTP. The system will create a new account and you should be seamlessly redirected to `/pending-review`.


## 7. Real Blocker & Resolution (NO_CUSTOMER Blocking)
**Blocker Observed**: Even after Admin approval (status=active), students received 'Your Academy profile is incomplete.' on /student.
**Resolution**:
- **Backend**: We verified that \ensure_current_student_account\ works perfectly and \get_current_student_bootstrap\ correctly identifies \status = active\.
- **Frontend**: The true culprit was that \StudentLayout.tsx\ explicitly blocked the user if \ootstrapState === 'NO_CUSTOMER'\. Since Phase B does not automatically link \customer_id\ (leaving it NULL), this state was always triggered. We removed this hard block from \StudentLayout\. The UI now correctly gracefully degrades to using the user's email if they lack a CRM customer profile, allowing them to access the dashboard.


## 8. Enrollment Tier Bypass (Phase B Smoke)
For Phase B smoke, use per-student \course_access_overrides\, not global tier bypass. Do not alter \private.can_access_course\.

To allow the test student to enroll in Course A and Course B (which normally require Silver/Gold tiers), run this SQL in the Academy project:
\\\sql
-- Grant override to specific test student for Course A and Course B
INSERT INTO public.course_access_overrides (course_id, student_id, access_scope, decision, starts_at, expires_at)
SELECT c.id, sa.id, 'full', 'allow', now(), now() + interval '7 days'
FROM public.courses c
CROSS JOIN public.student_accounts sa
WHERE c.slug IN ('course-a-slug', 'course-b-slug') -- Replace with actual slugs
  AND sa.phone = '+84xxxxxxxxx' -- Replace with test phone
ON CONFLICT DO NOTHING;
\\\

