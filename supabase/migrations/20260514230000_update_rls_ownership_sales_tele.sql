-- ============================================================================
-- MIGRATION: Cập nhật Row Level Security (RLS) cho Customers và Leads theo Ownership
-- ============================================================================

-- 1. Đảm bảo bảng leads có đủ các cột tham chiếu theo yêu cầu phân quyền
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS assigned_sale_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. CẬP NHẬT RLS CHO BẢNG CUSTOMERS
-- ============================================================================
-- Xóa các chính sách cũ để tránh rò rỉ quyền hạn
DROP POLICY IF EXISTS "Users view customers" ON public.customers;
DROP POLICY IF EXISTS "Users insert customers" ON public.customers;
DROP POLICY IF EXISTS "Users update customers" ON public.customers;
DROP POLICY IF EXISTS "Users delete customers" ON public.customers;
DROP POLICY IF EXISTS "Admins manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Sales manage owned customers" ON public.customers;
DROP POLICY IF EXISTS "Tele leads manage owned customers" ON public.customers;
DROP POLICY IF EXISTS "Staff insert owned customers" ON public.customers;

-- Chính sách cho Admin/Sub Admin: Xem và quản lý tất cả
CREATE POLICY "Admins manage all customers" ON public.customers
    FOR ALL TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Chính sách cho Sale: Xem/sửa customers có owner_sale_id = auth.uid()
CREATE POLICY "Sales manage owned customers" ON public.customers
    FOR ALL TO authenticated
    USING (
        public.has_role(auth.uid(), 'sale') 
        AND owner_sale_id = auth.uid()
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'sale') 
        AND owner_sale_id = auth.uid()
    );

-- Chính sách cho Tele Lead: Xem/sửa customers có owner_tele_id = auth.uid()
CREATE POLICY "Tele leads manage owned customers" ON public.customers
    FOR ALL TO authenticated
    USING (
        public.has_role(auth.uid(), 'tele_lead') 
        AND owner_tele_id = auth.uid()
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'tele_lead') 
        AND owner_tele_id = auth.uid()
    );

-- Chính sách cho phép nhân sự tự do chèn mới nếu họ tự gán ID của mình làm chủ sở hữu
CREATE POLICY "Staff insert owned customers" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (
        (public.has_role(auth.uid(), 'sale') AND owner_sale_id = auth.uid())
        OR (public.has_role(auth.uid(), 'tele_lead') AND owner_tele_id = auth.uid())
    );


-- ============================================================================
-- 3. CẬP NHẬT RLS CHO BẢNG LEADS
-- ============================================================================
DROP POLICY IF EXISTS "Admins manage leads" ON public.leads;
DROP POLICY IF EXISTS "Sales view leads" ON public.leads;
DROP POLICY IF EXISTS "Users view leads" ON public.leads;
DROP POLICY IF EXISTS "Admins manage all leads" ON public.leads;
DROP POLICY IF EXISTS "Sales manage owned leads" ON public.leads;
DROP POLICY IF EXISTS "Tele leads manage owned leads" ON public.leads;
DROP POLICY IF EXISTS "Staff insert owned leads" ON public.leads;

-- Chính sách cho Admin/Sub Admin: Xem và quản lý tất cả
CREATE POLICY "Admins manage all leads" ON public.leads
    FOR ALL TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Chính sách cho Sale: Xem/sửa leads có owner_sale_id = auth.uid() hoặc assigned_sale_id = auth.uid()
CREATE POLICY "Sales manage owned leads" ON public.leads
    FOR ALL TO authenticated
    USING (
        public.has_role(auth.uid(), 'sale') 
        AND (owner_sale_id = auth.uid() OR assigned_sale_id = auth.uid())
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'sale') 
        AND (owner_sale_id = auth.uid() OR assigned_sale_id = auth.uid())
    );

-- Chính sách cho Tele Lead: Xem/sửa leads có owner_tele_id = auth.uid()
CREATE POLICY "Tele leads manage owned leads" ON public.leads
    FOR ALL TO authenticated
    USING (
        public.has_role(auth.uid(), 'tele_lead') 
        AND owner_tele_id = auth.uid()
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'tele_lead') 
        AND owner_tele_id = auth.uid()
    );

-- Chính sách cho phép nhân sự tạo mới Leads
CREATE POLICY "Staff insert owned leads" ON public.leads
    FOR INSERT TO authenticated
    WITH CHECK (
        (public.has_role(auth.uid(), 'sale') AND (owner_sale_id = auth.uid() OR assigned_sale_id = auth.uid()))
        OR (public.has_role(auth.uid(), 'tele_lead') AND owner_tele_id = auth.uid())
    );

-- 4. Kích hoạt thông báo PostgREST tải lại schema
NOTIFY pgrst, 'reload schema';
