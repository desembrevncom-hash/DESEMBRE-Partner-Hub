-- Migration: Kích hoạt luồng phát sóng Realtime cho giao diện Quản lý Người dùng
-- Đưa bảng profiles và user_roles vào kênh theo dõi supabase_realtime để Frontend tự động đồng bộ

-- 1 & 2. Bổ sung bảng profiles và user_roles vào publication (nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
END $$;
