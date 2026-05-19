-- ============================================================================
-- MIGRATION: Bổ sung các cột thông tin địa lý và toạ độ phục vụ Bản đồ Khách hàng
-- ============================================================================

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS latitude numeric(10, 8),
    ADD COLUMN IF NOT EXISTS longitude numeric(11, 8),
    ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
    ADD COLUMN IF NOT EXISTS formatted_address text,
    ADD COLUMN IF NOT EXISTS geo_source text DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS geo_verified_at timestamptz,
    ADD COLUMN IF NOT EXISTS geo_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS map_note text;

-- Tạo chỉ mục tối ưu hoá truy vấn địa lý
CREATE INDEX IF NOT EXISTS idx_customers_latitude ON public.customers(latitude);
CREATE INDEX IF NOT EXISTS idx_customers_longitude ON public.customers(longitude);
CREATE INDEX IF NOT EXISTS idx_customers_geocode_status ON public.customers(geocode_status);
CREATE INDEX IF NOT EXISTS idx_customers_geo_source ON public.customers(geo_source);

-- Tải lại cấu trúc schema cho PostgREST
NOTIFY pgrst, 'reload schema';
