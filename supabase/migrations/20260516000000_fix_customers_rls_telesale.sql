-- ============================================================================
-- MIGRATION: Cập nhật RLS cho bảng Customers để hỗ trợ Sale và Telesale
-- ============================================================================

-- Bật RLS nếu chưa bật
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Xóa các policy cũ nếu có
DROP POLICY IF EXISTS "Users view customers" ON public.customers;
DROP POLICY IF EXISTS "Users insert customers" ON public.customers;
DROP POLICY IF EXISTS "Users update customers" ON public.customers;
DROP POLICY IF EXISTS "Users delete customers" ON public.customers;

-- Cấp quyền Đọc (SELECT):
-- Admin xem tất cả.
-- Sale/Telesale xem khách hàng do họ sở hữu hoặc tạo ra.
CREATE POLICY "Users view customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR user_id = auth.uid() 
  OR owner_sale_id = auth.uid()
  OR owner_tele_id = auth.uid()
  OR user_id IS NULL
);

-- Cấp quyền Thêm mới (INSERT):
-- Mọi người đều có thể tạo, hệ thống nên gán user_id bằng auth.uid() 
CREATE POLICY "Users insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR user_id = auth.uid() 
  OR user_id IS NULL
);

-- Cấp quyền Cập nhật (UPDATE):
-- Chỉ người sở hữu (Sale/Tele) hoặc người tạo (user_id) hoặc Admin mới được sửa.
CREATE POLICY "Users update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR user_id = auth.uid()
  OR owner_sale_id = auth.uid()
  OR owner_tele_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR user_id = auth.uid()
  OR owner_sale_id = auth.uid()
  OR owner_tele_id = auth.uid()
);

-- Cấp quyền Xóa (DELETE):
CREATE POLICY "Users delete customers"
ON public.customers
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR user_id = auth.uid()
  OR owner_sale_id = auth.uid()
  OR owner_tele_id = auth.uid()
);

-- Làm mới PostgREST cache
NOTIFY pgrst, 'reload schema';
