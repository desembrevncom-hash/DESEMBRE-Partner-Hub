-- Migration: Bổ sung các vai trò Tele-Sales (Trưởng Tele & Nhân viên Telesale)
-- Cập nhật ràng buộc toàn vẹn chuỗi (CHECK CONSTRAINT) trên bảng user_roles

-- 1. Gỡ bỏ ràng buộc kiểm tra chuỗi cứng cũ trên bảng user_roles
-- nhằm tránh xung đột khi gán các vai trò nghiệp vụ mới
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- 2. Áp dụng lại ràng buộc toàn vẹn đồng bộ với 5 vai trò chính thức của hệ thống
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check 
  CHECK (role IN ('admin', 'sub_admin', 'sale', 'tele_lead', 'telesale'));

-- 3. Kích hoạt thông báo nạp lại lược đồ cho bộ đệm PostgREST API
NOTIFY pgrst, 'reload schema';
