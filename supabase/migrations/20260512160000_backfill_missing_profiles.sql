-- Kịch bản rà soát và tự động vá (backfill) các hồ sơ bị thiếu trong bảng public.profiles và public.user_roles
-- Dành cho các tài khoản đã tồn tại trong auth.users nhưng bị Trigger bỏ sót do trễ mạng hoặc lỗi giao dịch.

DO $$
DECLARE
  _user RECORD;
BEGIN
  FOR _user IN 
    SELECT u.id, u.email, u.raw_user_meta_data 
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  LOOP
    -- 1. Tự động chèn bổ sung vào bảng profiles
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
      _user.id, 
      _user.email, 
      COALESCE(_user.raw_user_meta_data->>'display_name', _user.raw_user_meta_data->>'fullName', split_part(_user.email, '@', 1))
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

    -- 2. Tự động chèn bổ sung vào bảng user_roles mặc định là 'sale'
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user.id, 'sale')
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;
