-- ============================================================================
-- MIGRATION: Nâng cấp Schema Customers lên chuẩn CRM B2B Elite (DESEMBRE)
-- ============================================================================

-- 1. Bổ sung các cột thông tin cơ bản và B2B
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS contact_name text,
    ADD COLUMN IF NOT EXISTS business_name text,
    -- phone, address đã tồn tại từ migration trước, nhưng thêm vào đây để đảm bảo tính nhất quán
    ADD COLUMN IF NOT EXISTS normalized_phone text,
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS zalo text,
    ADD COLUMN IF NOT EXISTS facebook text;

-- 2. Bổ sung các cột vị trí (Location)
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS district text,
    ADD COLUMN IF NOT EXISTS region text;

-- 3. Bổ sung hồ sơ kinh doanh (Business Profile)
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS business_type text,
    ADD COLUMN IF NOT EXISTS business_size text,
    ADD COLUMN IF NOT EXISTS main_service text,
    ADD COLUMN IF NOT EXISTS skin_concern_focus text,
    ADD COLUMN IF NOT EXISTS interested_products text,
    ADD COLUMN IF NOT EXISTS current_brands text,
    ADD COLUMN IF NOT EXISTS monthly_purchase_potential numeric;

-- 4. Bổ sung thông tin người quyết định (Decision Maker)
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS decision_maker text,
    ADD COLUMN IF NOT EXISTS decision_role text,
    ADD COLUMN IF NOT EXISTS preferred_contact_channel text;

-- 5. Bổ sung thông tin bán hàng (Sales)
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS source text,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS potential_level text NOT NULL DEFAULT 'warm',
    ADD COLUMN IF NOT EXISTS note text,
    ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 6. Bổ sung/Cập nhật Ownership (Đảm bảo có default cho các cột not null)
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS owner_sale_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_tele_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_channel text NOT NULL DEFAULT 'direct_sales',
    ADD COLUMN IF NOT EXISTS customer_distance_type text NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS care_model text NOT NULL DEFAULT 'sale_owned';

-- 7. Bổ sung thông tin tổng hợp (Summary)
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
    ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_order_at timestamptz,
    ADD COLUMN IF NOT EXISTS total_order_amount numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_orders_count integer NOT NULL DEFAULT 0;

-- 8. Bổ sung quyền riêng tư và Marketing (Marketing Consent)
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz,
    ADD COLUMN IF NOT EXISTS marketing_opt_out_at timestamptz,
    ADD COLUMN IF NOT EXISTS email_opt_in boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS zalo_opt_in boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_marketing_sent_at timestamptz;

-- 9. Bổ sung các trường Audit và an toàn dữ liệu
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS delete_reason text,
    ADD COLUMN IF NOT EXISTS merged_into_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS data_quality_status text NOT NULL DEFAULT 'clean';

-- 10. Tạo hệ thống chỉ mục (Indexes) để tối ưu hóa truy vấn
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_unique_normalized_phone 
    ON public.customers(normalized_phone) 
    WHERE (deleted_at IS NULL AND normalized_phone IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_customers_owner_sale_id ON public.customers(owner_sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner_tele_id ON public.customers(owner_tele_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_city ON public.customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_next_follow_up ON public.customers(next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_customers_channel ON public.customers(customer_channel);
CREATE INDEX IF NOT EXISTS idx_customers_distance_type ON public.customers(customer_distance_type);
CREATE INDEX IF NOT EXISTS idx_customers_care_model ON public.customers(care_model);

-- Làm mới PostgREST cache
NOTIFY pgrst, 'reload schema';
