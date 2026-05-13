-- Migration: Kích hoạt luồng phát sóng Realtime cho giao diện Quản lý Người dùng
-- Đưa bảng profiles và user_roles vào kênh theo dõi supabase_realtime để Frontend tự động đồng bộ

-- 1. Bổ sung bảng profiles vào publication (nếu chưa có)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 2. Bổ sung bảng user_roles vào publication (nếu chưa có)
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
