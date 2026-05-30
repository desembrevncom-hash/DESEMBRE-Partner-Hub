-- ============================================================================
-- MIGRATION: CRM Phase 2 - Data Quality Views
-- ============================================================================
-- TÍNH CHẤT: Chỉ tạo View, không ảnh hưởng đến dữ liệu thực tế và RLS.
-- ============================================================================

-- 1. View: Khách hàng thiếu thông tin bắt buộc
CREATE OR REPLACE VIEW public.v_customers_missing_required_info AS
SELECT id, name, phone, email, owner_sale_id, created_at
FROM public.customers
WHERE name IS NULL OR name = '' OR (phone IS NULL AND email IS NULL);

-- 2. View: Khách hàng chưa được phân bổ (Unassigned)
CREATE OR REPLACE VIEW public.v_customers_unassigned AS
SELECT id, name, phone, email, status, source, created_at
FROM public.customers
WHERE owner_sale_id IS NULL AND owner_tele_id IS NULL;

-- 3. View: Trùng lặp số điện thoại
CREATE OR REPLACE VIEW public.v_customers_duplicate_phone AS
SELECT normalized_phone, COUNT(*) as duplicate_count, array_agg(id) as customer_ids
FROM public.customers
WHERE normalized_phone IS NOT NULL AND normalized_phone != ''
GROUP BY normalized_phone
HAVING COUNT(*) > 1;

-- 4. View: Khách hàng lâu chưa được liên hệ (Ví dụ: > 30 ngày hoặc chưa bao giờ liên hệ)
CREATE OR REPLACE VIEW public.v_customers_not_contacted_recently AS
SELECT id, name, phone, email, status, owner_sale_id, last_contacted_at, created_at
FROM public.customers
WHERE last_contacted_at IS NULL 
   OR last_contacted_at < (NOW() - INTERVAL '30 days');

-- 5. View: Khách hàng chưa đủ điều kiện Email Marketing (Chưa có opt_in hoặc thiếu email hợp lệ)
CREATE OR REPLACE VIEW public.v_customers_not_ready_for_email_marketing AS
SELECT id, name, email, normalized_email, marketing_opt_in, email_opt_in
FROM public.customers
WHERE normalized_email IS NULL OR normalized_email = '' OR email_opt_in = false OR marketing_opt_in = false;

-- 6. View: Khách hàng chưa đủ điều kiện Zalo Marketing
CREATE OR REPLACE VIEW public.v_customers_not_ready_for_zalo_marketing AS
SELECT c.id, c.name, c.zalo, c.marketing_opt_in, c.zalo_opt_in, z.zalo_id
FROM public.customers c
LEFT JOIN public.customer_zalo_profiles z ON c.id = z.customer_id
WHERE c.zalo IS NULL OR c.zalo = '' OR c.zalo_opt_in = false OR c.marketing_opt_in = false OR z.zalo_id IS NULL;

-- Kích hoạt lại cache của PostgREST
NOTIFY pgrst, 'reload schema';
