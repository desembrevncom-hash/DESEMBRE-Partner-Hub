-- 1. Bổ sung giá trị 'sub_admin' vào kiểu dữ liệu liệt kê public.app_role một cách an toàn
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sub_admin';

-- 2. Đảm bảo ràng buộc duy nhất cặp (user_id, role) trên bảng user_roles
-- (Nếu constraint/index đã được tạo từ các migration trước, lệnh này sẽ bổ sung chỉ mục độc lập hoặc bỏ qua an toàn)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles (user_id, role);

-- 3. Tạo Partial Unique Index đảm bảo toàn hệ thống chỉ có duy nhất một tài khoản mang quyền 'admin' chính
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_single_admin ON public.user_roles (role) WHERE role = 'admin';

-- 4. Khởi tạo hàm kiểm tra quyền truy cập gộp (Admin hoặc Sub-Admin)
DROP FUNCTION IF EXISTS public.is_admin_or_sub_admin(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin_or_sub_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
      AND role IN ('admin', 'sub_admin')
  );
$$;

-- 5. Kích hoạt thông báo nạp lại lược đồ cho bộ đệm PostgREST API
NOTIFY pgrst, 'reload schema';
