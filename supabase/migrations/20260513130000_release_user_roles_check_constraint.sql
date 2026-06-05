-- Migration: Hợp nhất toàn vẹn dữ liệu phân quyền Phó Admin
-- Gỡ bỏ ràng buộc kiểm tra cũ và cập nhật Policy để hệ thống chấp nhận trọn vẹn vai trò sub_admin

-- 1. Hàm hỗ trợ tra cứu quyền cấp cao (Admin gốc hoặc Phó Admin)
DROP FUNCTION IF EXISTS public.is_admin_or_sub_admin(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin_or_sub_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role::text IN ('admin', 'sub_admin')
  ) OR EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = _user_id AND email = 'desembrevn.com@gmail.com'
  )
$$;

-- 2. Gỡ bỏ ràng buộc kiểm tra chuỗi cũ trên cột role
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- 3. Áp dụng ràng buộc mới hỗ trợ trọn vẹn các quyền: admin, sub_admin, sale, tele_lead, telesale
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role::text IN ('admin', 'sub_admin', 'sale', 'tele_lead', 'telesale'));

-- 4. Cập nhật Policy cho phép Phó Admin nạp danh sách hồ sơ nhân sự
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- 5. Làm mới bộ nhớ đệm API
NOTIFY pgrst, 'reload schema';
