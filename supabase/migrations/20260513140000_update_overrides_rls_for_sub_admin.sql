-- Migration: Cập nhật RLS backend cho bảng product_overrides và kho lưu trữ product-images
-- Bổ sung quyền thao tác toàn diện cho Phó Admin (sub_admin) hỗ trợ vận hành danh mục sản phẩm và cập nhật giá

-- 1. Nâng cấp các chính sách RLS trên bảng public.product_overrides
DROP POLICY IF EXISTS "Admins insert overrides" ON public.product_overrides;
DROP POLICY IF EXISTS "Admins update overrides" ON public.product_overrides;
DROP POLICY IF EXISTS "Admins delete overrides" ON public.product_overrides;

CREATE POLICY "Admins insert overrides" ON public.product_overrides
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Admins update overrides" ON public.product_overrides
FOR UPDATE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Admins delete overrides" ON public.product_overrides
FOR DELETE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- 2. Nâng cấp các chính sách RLS trên Storage Objects cho bucket product-images
DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete product images" ON storage.objects;

CREATE POLICY "Admins upload product images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin_or_sub_admin(auth.uid())
);

CREATE POLICY "Admins update product images" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin_or_sub_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin_or_sub_admin(auth.uid())
);

CREATE POLICY "Admins delete product images" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin_or_sub_admin(auth.uid())
);

-- 3. Thông báo làm mới cache cho API PostgREST
NOTIFY pgrst, 'reload schema';
