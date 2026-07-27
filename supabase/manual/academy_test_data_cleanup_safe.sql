-- Dọn dẹp dữ liệu Test an toàn (Safe Cleanup Script)
-- CẢNH BÁO: Không thêm file này vào thư mục `migrations` để chạy tự động!
-- Cách dùng: Bôi đen và chạy toàn bộ trong môi trường console. 
-- Mặc định lệnh cuối cùng là ROLLBACK để bảo vệ dữ liệu.
-- Đổi ROLLBACK thành COMMIT khi bạn chắc chắn đã kiểm tra kết quả an toàn.

BEGIN;

-- 1. Vô hiệu hóa (Revoke/Expire) các Overrides được tạo ra do chạy test
-- Ưu tiên sử dụng khái niệm Hết Hạn (Expire) hoặc Hủy thay vì Xóa vật lý (DELETE)
UPDATE public.academy_course_access_overrides
SET expires_at = NOW(),
    reason = '[CLEANUP] ' || reason
WHERE (reason ILIKE '%test%' 
   OR reason ILIKE '%smoke%' 
   OR reason ILIKE '%Phase C%' 
   OR reason ILIKE '%REVOKE_COURSE_ACCESS%')
   AND (expires_at IS NULL OR expires_at > NOW());

-- 2. (Tùy chọn) Hủy các đăng ký khóa học rác
-- Khuyến cáo: Không xóa, hãy đổi status thành cancelled hoặc blocked nếu có
/*
UPDATE public.academy_student_enrollments
SET status = 'cancelled'
WHERE id IN (
  SELECT id FROM public.academy_student_enrollments WHERE status = 'active' ...
);
*/

-- LƯU Ý: Nếu thông báo OK, hãy chuyển chữ ROLLBACK dưới đây thành COMMIT và chạy lại.
ROLLBACK;
-- COMMIT;
