-- ============================================================================
-- MIGRATION: Tạo bảng quản lý ảnh check-in thực địa và RLS cho Storage (public.customer_visit_photos)
-- ============================================================================

-- 1. Tạo bảng quản lý metadata ảnh
CREATE TABLE IF NOT EXISTS public.customer_visit_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_id uuid NOT NULL REFERENCES public.customer_visit_checkins(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    storage_bucket text NOT NULL DEFAULT 'visit-photos',
    storage_path text NOT NULL UNIQUE, -- Lưu relative path: {customer_id}/{checkin_id}/{photo_id}.webp
    file_name text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes integer NOT NULL,
    width integer,
    height integer,
    caption text,
    photo_type text NOT NULL DEFAULT 'storefront', -- storefront | shelf | consultation | other
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT check_mime_type CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT check_file_size CHECK (file_size_bytes <= 1500000),
    CONSTRAINT check_photo_type CHECK (photo_type IN ('storefront', 'shelf', 'consultation', 'other'))
);

-- 2. Chỉ mục tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_visit_photos_checkin_id ON public.customer_visit_photos(checkin_id);
CREATE INDEX IF NOT EXISTS idx_visit_photos_customer_id ON public.customer_visit_photos(customer_id);
CREATE INDEX IF NOT EXISTS idx_visit_photos_uploaded_by ON public.customer_visit_photos(uploaded_by);

-- 3. Tạo Trigger kiểm chéo checkin/customer và giới hạn tối đa 2 ảnh cùng advisory lock chống race condition
CREATE OR REPLACE FUNCTION validate_and_limit_visit_photos()
RETURNS TRIGGER AS $$
DECLARE
  v_checkin_customer_id uuid;
BEGIN
  -- Kiểm tra sự tồn tại của checkin và lấy customer_id
  SELECT customer_id INTO v_checkin_customer_id
  FROM public.customer_visit_checkins
  WHERE id = NEW.checkin_id;

  IF v_checkin_customer_id IS NULL THEN
    RAISE EXCEPTION 'Mã check-in không tồn tại.';
  END IF;

  IF v_checkin_customer_id <> NEW.customer_id THEN
    RAISE EXCEPTION 'Mã check-in không thuộc về khách hàng được chỉ định.';
  END IF;

  -- Thực thi Advisory Lock theo checkin_id để đồng bộ hóa giao dịch
  PERFORM pg_advisory_xact_lock(hashtext(NEW.checkin_id::text));

  -- Kiểm tra số lượng ảnh hiện tại (tối đa 2)
  IF (SELECT count(*) FROM public.customer_visit_photos WHERE checkin_id = NEW.checkin_id) >= 2 THEN
    RAISE EXCEPTION 'Mỗi lần check-in chỉ được tải tối đa 2 ảnh minh chứng.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_and_limit_visit_photos ON public.customer_visit_photos;
CREATE TRIGGER trigger_validate_and_limit_visit_photos
  BEFORE INSERT ON public.customer_visit_photos
  FOR EACH ROW
  EXECUTE FUNCTION validate_and_limit_visit_photos();

-- 4. Bật RLS và thiết lập chính sách bảo mật cho bảng metadata
ALTER TABLE public.customer_visit_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read visit photos" ON public.customer_visit_photos;
CREATE POLICY "Users read visit photos" ON public.customer_visit_photos
    FOR SELECT TO authenticated
    USING (
        public.is_admin_or_sub_admin(auth.uid())
        OR public.has_role(auth.uid(), 'tele_lead')
        OR uploaded_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id
            AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users insert visit photos" ON public.customer_visit_photos;
CREATE POLICY "Users insert visit photos" ON public.customer_visit_photos
    FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND (
            public.is_admin_or_sub_admin(auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.customers c
                WHERE c.id = customer_id
                AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
            )
            OR EXISTS (
                SELECT 1 FROM public.customer_visit_checkins cv
                WHERE cv.id = checkin_id
                AND cv.checked_in_by = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Admins delete visit photos" ON public.customer_visit_photos;
CREATE POLICY "Admins delete visit photos" ON public.customer_visit_photos
    FOR DELETE TO authenticated
    USING (
        public.is_admin_or_sub_admin(auth.uid())
    );

-- 5. Khởi tạo bucket 'visit-photos' chế độ private với các giới hạn cứng
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('visit-photos', 'visit-photos', false, 1500000, array['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 1500000,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

-- 6. Thiết lập các chính sách RLS cho storage.objects
DROP POLICY IF EXISTS "Storage read visit photos" ON storage.objects;
CREATE POLICY "Storage read visit photos" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'visit-photos'
        AND storage.objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png|jpe?g)$'
        AND (
            public.is_admin_or_sub_admin(auth.uid())
            OR public.has_role(auth.uid(), 'tele_lead')
            OR EXISTS (
                SELECT 1 FROM public.customers c
                WHERE c.id = (split_part(storage.objects.name, '/', 1))::uuid
                AND (
                    c.owner_sale_id = auth.uid()
                    OR c.owner_tele_id = auth.uid()
                    OR EXISTS (
                        SELECT 1 FROM public.customer_visit_checkins cv
                        WHERE cv.id = (split_part(storage.objects.name, '/', 2))::uuid
                        AND cv.checked_in_by = auth.uid()
                    )
                )
            )
        )
    );

DROP POLICY IF EXISTS "Storage insert visit photos" ON storage.objects;
CREATE POLICY "Storage insert visit photos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'visit-photos'
        AND storage.objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png|jpe?g)$'
        AND (
            public.is_admin_or_sub_admin(auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.customer_visit_checkins cv
                JOIN public.customers c ON c.id = cv.customer_id
                WHERE cv.id = (split_part(storage.objects.name, '/', 2))::uuid
                AND cv.customer_id = (split_part(storage.objects.name, '/', 1))::uuid
                AND (
                    cv.checked_in_by = auth.uid()
                    OR c.owner_sale_id = auth.uid()
                    OR c.owner_tele_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Storage delete visit photos" ON storage.objects;
CREATE POLICY "Storage delete visit photos" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'visit-photos'
        AND (
            public.is_admin_or_sub_admin(auth.uid())
            OR (
                -- Allow Sales/Tele to delete ONLY if it is an orphan file (no active metadata row exists)
                NOT EXISTS (
                    SELECT 1 FROM public.customer_visit_photos p
                    WHERE p.storage_path = storage.objects.name
                )
                -- AND the user has visible authorization for this customer path
                AND (
                    storage.objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png|jpe?g)$'
                    AND EXISTS (
                        SELECT 1 FROM public.customers c
                        WHERE c.id = (split_part(storage.objects.name, '/', 1))::uuid
                        AND (
                            c.owner_sale_id = auth.uid()
                            OR c.owner_tele_id = auth.uid()
                            OR EXISTS (
                                SELECT 1 FROM public.customer_visit_checkins cv
                                WHERE cv.id = (split_part(storage.objects.name, '/', 2))::uuid
                                AND cv.checked_in_by = auth.uid()
                            )
                        )
                    )
                )
            )
        )
    );

-- Tải lại cấu trúc schema cho PostgREST
NOTIFY pgrst, 'reload schema';
