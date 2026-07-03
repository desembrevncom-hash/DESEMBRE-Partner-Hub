# Đề Xuất Database (Database Proposal)

Tài liệu này chứa schema đề xuất nhằm mở rộng Hub Database cho các chức năng của Academy.

## Đề xuất Schema Academy
**Phân loại:** RECOMMENDATION
**Repository:** DESEMBRE-Partner-Hub
**File:** N/A
**Lines:** N/A
**Nội dung:** 
Cần tạo các bảng sau:
- `academy_courses`: id, title, description, created_at
- `academy_lessons`: id, course_id, title, duration, type
- `academy_enrollments`: id, course_id, user_id (liên kết với auth.users)
- `academy_student_progress`: id, enrollment_id, lesson_id, status

## Liên kết với hệ thống hiện tại
**Phân loại:** RECOMMENDATION
**Repository:** DESEMBRE-Partner-Hub
**File:** `supabase/migrations/20260512170000_create_customers_table.sql`
**Lines:** 11
**Nội dung:** 
Việc ghi danh khóa học của học viên sẽ được liên kết trực tiếp với `auth.users.id`, từ đó có thể join với `public.customers.user_id` để trích xuất thông tin khách hàng đồng bộ.
