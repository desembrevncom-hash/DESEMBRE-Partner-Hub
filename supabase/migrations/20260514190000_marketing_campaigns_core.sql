-- ============================================================================
-- MIGRATION: Khởi tạo Nền tảng Dữ liệu Lõi cho Phân hệ Marketing CRM B2B
-- ============================================================================

-- 1. BỔ SUNG CÁC TRƯỜNG KIỂM SOÁT OPT-IN VÀO BẢNG CUSTOMERS GỐC
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS marketing_opt_out_at timestamptz,
    ADD COLUMN IF NOT EXISTS opt_out_reason text;

-- 2. TẠO BẢNG CUSTOMER_SEGMENTS (PHÂN NHÓM KHÁCH HÀNG)
CREATE TABLE IF NOT EXISTS public.customer_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    segment_type text NOT NULL DEFAULT 'static',
    rules jsonb DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT check_segment_type CHECK (segment_type IN ('static', 'dynamic'))
);

-- Bảng ánh xạ trung gian cho các phân khúc tĩnh (Static Segment Mapping)
CREATE TABLE IF NOT EXISTS public.customer_segments_map (
    segment_id uuid REFERENCES public.customer_segments(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (segment_id, customer_id)
);

-- 3. TẠO BẢNG MARKETING_CAMPAIGNS (CHIẾN DỊCH TIẾP THỊ)
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    template_id uuid REFERENCES public.message_templates(id) ON DELETE RESTRICT,
    sender_account_id uuid REFERENCES public.sender_accounts(id) ON DELETE RESTRICT,
    segment_id uuid REFERENCES public.customer_segments(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'draft',
    target_criteria jsonb,
    override_variables jsonb DEFAULT '{}'::jsonb,
    scheduled_at timestamptz,
    metrics jsonb DEFAULT '{"total_targets": 0, "sent": 0, "failed": 0}'::jsonb,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT check_campaign_status CHECK (
        status IN ('draft', 'scheduled', 'processing', 'completed', 'cancelled')
    )
);

-- 4. TẠO BẢNG MESSAGE_SEND_LOGS (NHẬT KÝ PHÁT HÀNH TRỰC TIẾP & TRUY VẾT SPAM)
CREATE TABLE IF NOT EXISTS public.message_send_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    recipient_email text NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    provider_message_id text,
    error_message text,
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT check_send_log_status CHECK (
        status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'frequency_capped', 'opt_out_skipped')
    )
);

-- ============================================================================
-- THIẾT LẬP HÀNG RÀO BẢO MẬT (ROW LEVEL SECURITY - RLS)
-- ============================================================================

-- Bật RLS
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_segments_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_send_logs ENABLE ROW LEVEL SECURITY;

-- Chính sách cho Admin/Sub-Admin toàn quyền quản lý
CREATE POLICY "Admins manage customer segments" ON public.customer_segments
    FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Admins manage segments map" ON public.customer_segments_map
    FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Admins manage marketing campaigns" ON public.marketing_campaigns
    FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Admins manage message send logs" ON public.message_send_logs
    FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));

-- Chính sách cho Sales/Người dùng nội bộ chỉ được đọc thông tin phục vụ tra cứu
CREATE POLICY "Sales view customer segments" ON public.customer_segments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales view segments map" ON public.customer_segments_map
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales view marketing campaigns" ON public.marketing_campaigns
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales view message send logs" ON public.message_send_logs
    FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- TỐI ƯU HÓA HIỆU NĂNG BẰNG CHỈ MỤC (INDEXES)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON public.marketing_campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_send_logs_campaign ON public.message_send_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_send_logs_customer ON public.message_send_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_send_logs_status ON public.message_send_logs(status);
CREATE INDEX IF NOT EXISTS idx_customers_opt_in ON public.customers(marketing_opt_in);

-- Làm mới bộ nhớ đệm PostgREST
NOTIFY pgrst, 'reload schema';
