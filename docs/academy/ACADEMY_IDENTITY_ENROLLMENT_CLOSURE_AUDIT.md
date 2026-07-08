# Academy Identity & Enrollment Closure Audit

## 1. Executive Summary
This audit validates the current implementation of the Academy Identity and Enrollment flows against their original requirements.

**Conclusion:** **Outcome D: Both require implementation.**
While placeholder UI components and backend database schemas exist, the runtime wiring (Supabase authentication, Edge Functions, RPCs) and Partner Hub business operation portals are entirely missing or mocked.

---

## 2. Current Architecture
- **DESEMBRE-Academy**: Owns content administration and student portal. The frontend UI contains placeholder routes for Identity and Enrollment.
- **DESEMBRE-Partner-Hub**: Owns CRM-linked student operations and enrollment management. Currently has ZERO implementation for these features.

---

## 3. Identity Requirement Matrix
| Requirement | Status | Evidence |
|---|---|---|
| Phone entry UI | **PARTIAL** | `Desembre Academy`: `src/routes/auth.phone.tsx` exists with mocked UI. |
| OTP request | **MISSING** | `Desembre Academy`: `src/features/auth/services/authService.ts` mocks the request. Supabase `signInWithOtp` is not called. |
| OTP verification | **MISSING** | `Desembre Academy`: `src/features/auth/services/authService.ts` mocks verification (`123456`). Supabase `verifyOtp` is not called. |
| Phone normalization | **PARTIAL** | Basic E.164 normalization may exist in UI, but no robust backend validation or tests are wired. |
| Student account linking | **MISSING** | Edge Function for linking customer to student account does not exist. |
| Customer matching behavior | **MISSING** | Matching logic does not exist. |
| Enumeration protection | **UNKNOWN** | Cannot evaluate without backend implementation. |
| Abuse protection | **UNKNOWN** | Cannot evaluate without backend implementation. |
| Role-aware landing | **PARTIAL** | Hardcoded routing exists in Academy middleware/layouts but requires robust runtime linking. |

---

## 4. Enrollment Requirement Matrix
| Requirement | Status | Evidence |
|---|---|---|
| Enrollment Database | **PASS** | `DESEMBRE-Partner-Hub`: `supabase/migrations/20260703174001_academy_course_schema.sql` lines 121-133 define `enrollments` table. Statuses: `pending`, `active`, `rejected`, `completed`, `cancelled`, `expired`. Unique constraint `(student_id, course_id)` exists. |
| Student Enrollment Flow | **MISSING** | `Desembre Academy`: `src/features/enrollments/services/enrollmentService.ts` mocks `requestEnrollment` with a dummy delay. |
| My Courses Flow | **PARTIAL** | `Desembre Academy`: `src/routes/student.courses.index.tsx` exists but uses static/mocked hooks. |

---

## 5. Student Operations Matrix (Partner Hub)
| Operation | Status | Evidence |
|---|---|---|
| Pending enrollment queue | **MISSING** | Zero references in Partner Hub source code. |
| Enrollment details | **MISSING** | Zero references in Partner Hub source code. |
| Approve/Reject | **MISSING** | Zero references in Partner Hub source code. |
| Manual assignment | **MISSING** | Zero references in Partner Hub source code. |
| List student accounts | **MISSING** | Zero references in Partner Hub source code. |
| Review pending link | **MISSING** | Zero references in Partner Hub source code. |
| Resolve duplicate phone | **MISSING** | Zero references in Partner Hub source code. |

---

## 6. Authorization Matrix
| Authorization Check | Status | Evidence |
|---|---|---|
| Academy Frontend safe | **PASS** | No `service_role` key exposed. |
| Authenticated identity authoritative | **PASS** | `academy_course_runtime_rpcs.sql` uses `auth.uid()` securely. |
| Partner Hub Operations | **MISSING** | Partner Hub enrollment interfaces do not exist yet to enforce constraints. |

---

## 7. Test Evidence
- **Identity Tests**: **MISSING**. No tests found in `tests/` or `__tests__/` for OTP, phone normalization, or customer matching.
- **Enrollment Tests**: **MISSING**. No tests found for enrollment operations or My Courses logic.

---

## 8. Totals
- **Identity**: 0 PASS, 3 PARTIAL, 4 MISSING, 2 UNKNOWN.
- **Enrollment**: 1 PASS, 1 PARTIAL, 1 MISSING, 0 UNKNOWN.
- **Student Operations**: 0 PASS, 0 PARTIAL, 7 MISSING, 0 UNKNOWN.

---

## 9. Critical Gaps
1. **Mocked Authentication**: `signInWithOtp` and `verifyOtp` are completely mocked in the Academy frontend.
2. **Missing Edge Functions**: No secure backend linking between Supabase Auth and CRM customers for student accounts.
3. **Missing Partner Hub Operations**: The CRM application lacks all required screens for approving, rejecting, and reviewing enrollments.

---

## 10. Non-Critical Gaps
- My Courses empty states and active-only filtering rely on incomplete runtime data.

---

## 11. Features Already Complete
- The database schema for `student_accounts` and `enrollments` is stable and accurately models the required statuses and constraints.

---

## 12. Recommended Implementation Milestones
- **M6D.1 — Identity Closure**: Replace mocked UI with `signInWithOtp`/`verifyOtp`. Implement secure student account linking and phone normalization.
- **M6D.2 — Enrollment Request Closure**: Wire the frontend `requestEnrollment` flow to the Supabase backend.
- **M6D.3 — Partner Hub Enrollment Operations**: Build the UI and RPCs in Partner Hub to approve/reject/manage enrollments.
- **M6D.4 — Student E2E Closure**: Finalize My Courses logic and access enforcement.

---

## 13. Recommended Branches
- Next implementation branch: `feat/academy-identity-closure`

---

## 14. Production Blockers
- **Identity & Enrollment** must be implemented before Academy can be exposed to live customers safely.
