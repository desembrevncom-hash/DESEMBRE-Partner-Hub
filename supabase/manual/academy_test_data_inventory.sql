-- Dịch vụ kiểm kê dữ liệu Test (Inventory Script)
-- Sử dụng kịch bản này để xem các dòng dữ liệu ảo/dữ liệu rác trước khi dọn dẹp.
-- KHÔNG có lệnh DELETE hoặc UPDATE ở đây.

-- 1. Kiểm tra các Course Access Overrides chứa lý do 'test', 'smoke', 'Phase C'
SELECT id, student_id, course_id, access_type, reason, created_at, expires_at 
FROM public.academy_course_access_overrides
WHERE reason ILIKE '%test%' 
   OR reason ILIKE '%smoke%' 
   OR reason ILIKE '%Phase C%' 
   OR reason ILIKE '%REVOKE_COURSE_ACCESS%';

-- 2. Kiểm tra các Enrolments (ghi danh) rác/nghi ngờ là test
-- Lưu ý: Chỉ là dự đoán dựa trên tiến độ học = 0. Admin cần kiểm tra thủ công.
SELECT id, student_id, course_id, status, completed_lessons, created_at
FROM public.academy_student_enrollments
WHERE status = 'active'
  AND completed_lessons = 0
ORDER BY created_at DESC
LIMIT 50;

-- 3. Liệt kê các tài khoản Học viên không được map với Customer (Dấu hiệu test)
SELECT a.id, a.user_id, a.display_name, a.phone, a.created_at
FROM public.academy_student_accounts a
WHERE a.customer_id IS NULL;
