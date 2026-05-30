-- ============================================================================
-- MIGRATION: CRM Phase 1 - Database Foundation (Safe Mode)
-- ============================================================================
-- TÍNH CHẤT: Additive Migration (Chỉ thêm, không xóa hay sửa đổi RLS hiện tại của bảng customers).
-- LƯU Ý: Khái niệm "assigned_to" trong logic mới sẽ được map trực tiếp vào cột "owner_sale_id" đã có.
-- 
-- ROLLBACK NOTE:
-- To rollback this migration, run:
-- DROP TRIGGER IF EXISTS trg_normalize_customer_email_on_upsert ON public.customers;
-- DROP FUNCTION IF EXISTS public.normalize_customer_email();
-- DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
-- DROP FUNCTION IF EXISTS public.update_updated_at_column();
-- DROP VIEW IF EXISTS public.v_customers_duplicate_email;
-- DROP VIEW IF EXISTS public.v_customers_invalid_status;
-- DROP VIEW IF EXISTS public.v_customers_invalid_source;
-- ALTER TABLE public.customers DROP COLUMN IF EXISTS normalized_email;
-- DROP TABLE IF EXISTS public.customer_import_rows;
-- DROP TABLE IF EXISTS public.customer_import_batches;
-- DROP TABLE IF EXISTS public.customer_tag_links;
-- DROP TABLE IF EXISTS public.customer_tags;
-- DROP TABLE IF EXISTS public.customer_zalo_profiles;
-- DROP TABLE IF EXISTS public.customer_consents;
-- ============================================================================

-- 1. Thêm cột normalized_email (nếu chưa có) và tự động chuẩn hóa dữ liệu cũ
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS normalized_email text;

UPDATE public.customers 
SET normalized_email = lower(trim(email)) 
WHERE email IS NOT NULL AND normalized_email IS NULL;

-- 2. Tạo function và trigger tự động chuẩn hóa email khi insert/update
CREATE OR REPLACE FUNCTION public.normalize_customer_email()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.normalized_email = lower(trim(NEW.email));
    ELSE
        NEW.normalized_email = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_customer_email_on_upsert ON public.customers;
CREATE TRIGGER trg_normalize_customer_email_on_upsert
    BEFORE INSERT OR UPDATE OF email ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_customer_email();

-- 3. Đảm bảo updated_at luôn tự động cập nhật
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Nếu trigger cũ chưa tồn tại thì tạo mới, không xóa trigger cũ nếu nó tên khác
DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Tạo các Views hỗ trợ quản trị chất lượng dữ liệu (Data Quality) thay vì ép Constraint ngay

-- 4a. View phát hiện email trùng lặp
CREATE OR REPLACE VIEW public.v_customers_duplicate_email AS
SELECT normalized_email, COUNT(*) as duplicate_count, array_agg(id) as customer_ids
FROM public.customers
WHERE normalized_email IS NOT NULL
GROUP BY normalized_email
HAVING COUNT(*) > 1;

-- 4b. View phát hiện status không chuẩn (Bao gồm cả các stage mới trong salesPipeline.ts)
CREATE OR REPLACE VIEW public.v_customers_invalid_status AS
SELECT id, name, status, owner_sale_id
FROM public.customers
WHERE status IS NOT NULL AND status NOT IN (
    'lead_new', 'lead_received', 'contacting', 'consulting', 'closing', 'purchased', 'lost',
    'new', 'contacted', 'interested', 'quoted', 'ordered', 'won', 'inactive', 'blocked'
);

-- 4c. View phát hiện source không chuẩn
CREATE OR REPLACE VIEW public.v_customers_invalid_source AS
SELECT id, name, source, owner_sale_id
FROM public.customers
WHERE source IS NOT NULL AND source NOT IN (
    'website', 'facebook', 'zalo', 'tiktok', 'google', 'referral', 'offline', 'event', 'import', 'unknown'
);

-- 5. Tạo các bảng mới (IF NOT EXISTS)
-- LƯU Ý: RLS chỉ giới hạn ở Admin và Sale (dựa trên app_role)

CREATE TABLE IF NOT EXISTS public.customer_consents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    channel text NOT NULL, -- 'email', 'zalo', 'sms'
    is_opt_in boolean NOT NULL DEFAULT false,
    opt_in_at timestamptz,
    opt_out_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_zalo_profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    zalo_id text UNIQUE,
    zalo_name text,
    zalo_phone text,
    avatar_url text,
    is_following_oa boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_tags (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    color text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_tag_links (
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    tag_id uuid REFERENCES public.customer_tags(id) ON DELETE CASCADE,
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (customer_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.customer_import_batches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name text NOT NULL,
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    total_rows int DEFAULT 0,
    success_rows int DEFAULT 0,
    failed_rows int DEFAULT 0,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_import_rows (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_id uuid REFERENCES public.customer_import_batches(id) ON DELETE CASCADE,
    raw_data jsonb NOT NULL,
    parsed_data jsonb,
    is_valid boolean DEFAULT false,
    validation_errors jsonb,
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'imported', 'skipped'
    imported_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- 6. Thiết lập RLS cho các bảng mới (Admin thấy hết, Sale thấy liên quan)

ALTER TABLE public.customer_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_zalo_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_import_rows ENABLE ROW LEVEL SECURITY;

-- Note: Role Manager chưa có policy cụ thể, dùng Admin
-- TODO: Bổ sung policy cho Manager nếu sau này có app_role 'manager'

DROP POLICY IF EXISTS "Admin manage consents" ON public.customer_consents;
CREATE POLICY "Admin manage consents" ON public.customer_consents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Sale read own customer consents" ON public.customer_consents;
CREATE POLICY "Sale read own customer consents" ON public.customer_consents FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.customers WHERE id = customer_consents.customer_id AND owner_sale_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin manage zalo profiles" ON public.customer_zalo_profiles;
CREATE POLICY "Admin manage zalo profiles" ON public.customer_zalo_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Sale read own customer zalo profiles" ON public.customer_zalo_profiles;
CREATE POLICY "Sale read own customer zalo profiles" ON public.customer_zalo_profiles FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.customers WHERE id = customer_zalo_profiles.customer_id AND owner_sale_id = auth.uid())
);

-- Tags: Ai cũng đọc được, Admin tạo mới
DROP POLICY IF EXISTS "All authenticated read tags" ON public.customer_tags;
CREATE POLICY "All authenticated read tags" ON public.customer_tags FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage tags" ON public.customer_tags;
CREATE POLICY "Admin manage tags" ON public.customer_tags FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tag Links: Admin quản lý tất cả, Sale thêm tag cho khách của mình
DROP POLICY IF EXISTS "Admin manage tag links" ON public.customer_tag_links;
CREATE POLICY "Admin manage tag links" ON public.customer_tag_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Sale manage own customer tags" ON public.customer_tag_links;
CREATE POLICY "Sale manage own customer tags" ON public.customer_tag_links FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.customers WHERE id = customer_tag_links.customer_id AND owner_sale_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.customers WHERE id = customer_tag_links.customer_id AND owner_sale_id = auth.uid())
);

-- Import batches/rows: Chỉ Admin được phép
DROP POLICY IF EXISTS "Admin manage import batches" ON public.customer_import_batches;
CREATE POLICY "Admin manage import batches" ON public.customer_import_batches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin manage import rows" ON public.customer_import_rows;
CREATE POLICY "Admin manage import rows" ON public.customer_import_rows FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
