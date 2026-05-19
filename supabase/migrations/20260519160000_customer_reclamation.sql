-- ============================================================================
-- MIGRATION: Bổ sung các trường và chỉ mục hỗ trợ cơ chế thu hồi/chia khách hàng (Customer Reclamation)
-- ============================================================================

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS ownership_status text NOT NULL DEFAULT 'assigned',
    ADD COLUMN IF NOT EXISTS at_risk_at timestamptz,
    ADD COLUMN IF NOT EXISTS reclaimable_at timestamptz,
    ADD COLUMN IF NOT EXISTS free_pool_at timestamptz,
    ADD COLUMN IF NOT EXISTS reclaim_reason text,
    ADD COLUMN IF NOT EXISTS last_owner_activity_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_reassigned_at timestamptz,
    ADD COLUMN IF NOT EXISTS reassigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Tạo chỉ mục (Indexes) phục vụ tối ưu hóa hiệu năng truy vấn
CREATE INDEX IF NOT EXISTS idx_customers_ownership_status ON public.customers(ownership_status);
CREATE INDEX IF NOT EXISTS idx_customers_at_risk_at ON public.customers(at_risk_at);
CREATE INDEX IF NOT EXISTS idx_customers_reclaimable_at ON public.customers(reclaimable_at);
CREATE INDEX IF NOT EXISTS idx_customers_free_pool_at ON public.customers(free_pool_at);
CREATE INDEX IF NOT EXISTS idx_customers_last_owner_activity_at ON public.customers(last_owner_activity_at);
CREATE INDEX IF NOT EXISTS idx_customers_last_order_at ON public.customers(last_order_at);
CREATE INDEX IF NOT EXISTS idx_customers_owner_sale_id ON public.customers(owner_sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner_tele_id ON public.customers(owner_tele_id);

-- Làm mới PostgREST cache
NOTIFY pgrst, 'reload schema';
