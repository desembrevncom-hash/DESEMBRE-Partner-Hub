-- ============================================================================
-- MIGRATION: Tạo bảng quản lý check-in thực địa của nhân viên (public.customer_visit_checkins)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_visit_checkins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    checked_in_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    latitude numeric NOT NULL,
    longitude numeric NOT NULL,
    accuracy_meters numeric,
    customer_latitude numeric,
    customer_longitude numeric,
    distance_meters numeric,
    is_valid_location boolean NOT NULL DEFAULT false,
    valid_radius_meters integer NOT NULL DEFAULT 200,
    note text,
    photo_url text,
    checked_in_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Bật Row Level Security (RLS)
ALTER TABLE public.customer_visit_checkins ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách xem dữ liệu: Admin/Sub Admin xem toàn bộ, nhân viên xem check-in của chính mình
CREATE POLICY "Users view checkins"
ON public.customer_visit_checkins
FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') 
    OR checked_in_by = auth.uid()
);

-- Tạo chính sách thêm mới: Cho phép mọi nhân viên đã đăng nhập thêm check-in
CREATE POLICY "Users insert checkins"
ON public.customer_visit_checkins
FOR INSERT
TO authenticated
WITH CHECK (
    checked_in_by = auth.uid()
);

-- Tạo chỉ mục tối ưu hóa tìm kiếm
CREATE INDEX IF NOT EXISTS idx_checkins_customer_id ON public.customer_visit_checkins(customer_id);
CREATE INDEX IF NOT EXISTS idx_checkins_checked_in_by ON public.customer_visit_checkins(checked_in_by);
CREATE INDEX IF NOT EXISTS idx_checkins_checked_in_at ON public.customer_visit_checkins(checked_in_at);

-- Tải lại cấu trúc schema cho PostgREST
NOTIFY pgrst, 'reload schema';
