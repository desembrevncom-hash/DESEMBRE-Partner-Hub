-- ============================================================================
-- MIGRATION: Bổ sung quyền sở hữu (Ownership) Sale/Tele cho Customers và Leads
-- ============================================================================

-- 1. BỔ SUNG CÁC TRƯỜNG SỞ HỮU VÀ PHÂN LOẠI CHO BẢNG CUSTOMERS
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS owner_sale_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_tele_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_channel text DEFAULT 'direct_sales',
    ADD COLUMN IF NOT EXISTS customer_distance_type text DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS care_model text DEFAULT 'sale_owned';

-- 2. KHỞI TẠO BẢNG LEADS NẾU CHƯA TỒN TẠI VÀ BỔ SUNG CÁC TRƯỜNG SỞ HỮU
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text,
    email text,
    facility_name text,
    status text DEFAULT 'new',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS owner_sale_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_tele_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lead_route text DEFAULT 'unrouted',
    ADD COLUMN IF NOT EXISTS distance_type text DEFAULT 'unknown';

-- 3. TẠO HỆ THỐNG CHỈ MỤC (INDEXES) TỐI ƯU HÓA HIỆU NĂNG TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_customers_owner_sale_id ON public.customers(owner_sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner_tele_id ON public.customers(owner_tele_id);
CREATE INDEX IF NOT EXISTS idx_customers_channel ON public.customers(customer_channel);
CREATE INDEX IF NOT EXISTS idx_customers_distance_type ON public.customers(customer_distance_type);
CREATE INDEX IF NOT EXISTS idx_customers_care_model ON public.customers(care_model);

CREATE INDEX IF NOT EXISTS idx_leads_owner_sale_id ON public.leads(owner_sale_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner_tele_id ON public.leads(owner_tele_id);
CREATE INDEX IF NOT EXISTS idx_leads_route ON public.leads(lead_route);
CREATE INDEX IF NOT EXISTS idx_leads_distance_type ON public.leads(distance_type);

-- 4. BẬT RLS CHO BẢNG LEADS NẾU VỪA TẠO MỚI (Bảo lưu nguyên vẹn yêu cầu không đổi RLS lớn ở bước này)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách an toàn mặc định cho leads nếu chưa có
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'leads' AND policyname = 'Admins manage leads'
    ) THEN
        CREATE POLICY "Admins manage leads" ON public.leads
            FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));
            
        CREATE POLICY "Sales view leads" ON public.leads
            FOR SELECT TO authenticated USING (true);
    END IF;
END
$$;

-- Kích hoạt tải lại schema cho PostgREST
NOTIFY pgrst, 'reload schema';
