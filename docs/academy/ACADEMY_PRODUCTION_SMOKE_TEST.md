# Academy Production Smoke Test

This smoke test script must be executed immediately following the Academy V1 production deployment to verify system health.

## 1. Identity & Onboarding

- [ ] **Request OTP**: Submit a valid phone number through the Zalo ZNS flow on the frontend login page.
- [ ] **Verify OTP**: Input the correct OTP.
- [ ] **Linked Student Routing**: If the phone matches exactly one active CRM customer, verify redirection to `/student`.
- [ ] **Pending Review Routing**: If the phone does not match or matches multiple customers, verify redirection to `/pending-review`.
- [ ] **Blocked Routing**: If the linked student is blocked, verify redirection to `/blocked`.

## 2. Enrollment Flow

- [ ] **Explore Tab**: Verify that only `published` courses appear in the Explore catalog.
- [ ] **Request Enrollment**: Click the enrollment CTA on a course in the Explore tab. Verify the request is safely transmitted.
- [ ] **Admin Approval**: In Partner Hub, an admin approves the pending enrollment request.
- [ ] **My Courses**: Refresh the Academy frontend and verify the course now appears in "My Courses".
- [ ] **Lesson Access Unlocked**: Verify that lessons previously locked are now accessible.

## 3. Learning Runtime

- [ ] **Article Lesson**: Open an Article lesson and verify the markdown content renders correctly.
- [ ] **External Link Lesson**: Open an External Link lesson and verify it routes safely.
- [ ] **Media Lesson**: Open a Media lesson and verify the signed URL strictly allows access.
- [ ] **Progress Persistence**: Complete a lesson and verify progress is saved. Refresh the page to ensure the completed state persists.
- [ ] **Resume Feature**: Verify the "Resume" button correctly identifies the next uncompleted lesson.
- [ ] **Cross-Student Isolation**: Verify that another student cannot view or mutate the primary test student's progress or enrollment status.

## 4. Admin Management (Partner Hub)

- [ ] **Content Studio**: Access the Admin Content Studio routes and verify they load safely.
- [ ] **Publish Workflow**: Test publishing, unpublishing, and archiving a mock course.
- [ ] **Archived Immutability**: Verify that archived courses are strictly read-only and mutations are blocked.
- [ ] **Enrollment Operations**: Verify the admin can list and filter enrollments safely.
- [ ] **Student List**: Verify the student accounts list loads without exposing internal CRM notes or sales data.

## 5. Security Validation

- [ ] **Service Role Absent**: Inspect browser network traffic to guarantee `service_role` keys are never leaked to the frontend.
- [ ] **CRM Data Isolation**: Verify that Academy UI does not receive broad CRM data (no notes, pipelines, internal tags).
- [ ] **Storage Path Safety**: Verify Edge Functions sanitize media locators and do not expose raw bucket paths.
- [ ] **OTP Privacy**: Check Edge Function logs to guarantee OTPs are never printed in plaintext.
