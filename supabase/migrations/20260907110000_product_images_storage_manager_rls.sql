-- Migration: Idempotent RLS and Bucket Setup for product-images Storage
-- Ensures manager (admin and sub_admin) can upload, update, and delete product images.
-- Public users can view images.

-- 1. Ensure product-images bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 2. Public read policy
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images');

-- 3. Manager (admin or sub_admin) insert/update/delete policies
DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
CREATE POLICY "Admins upload product images"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin_or_sub_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins update product images" ON storage.objects;
CREATE POLICY "Admins update product images"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin_or_sub_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin_or_sub_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins delete product images" ON storage.objects;
CREATE POLICY "Admins delete product images"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin_or_sub_admin(auth.uid())
);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
