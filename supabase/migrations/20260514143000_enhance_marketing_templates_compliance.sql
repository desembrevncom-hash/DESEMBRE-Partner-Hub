-- ============================================================================
-- MIGRATION: Phân tách Mẫu Marketing, Bổ sung Quy tắc Chống Spam & Log Gửi
-- ============================================================================

-- 1. CẬP NHẬT BẢNG MESSAGE_TEMPLATES
ALTER TABLE public.message_templates
    ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'transactional',
    ADD COLUMN IF NOT EXISTS requires_opt_in boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS include_unsubscribe boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS max_send_frequency_days integer;

-- Thêm ràng buộc kiểm tra các giá trị purpose hợp lệ
ALTER TABLE public.message_templates
    DROP CONSTRAINT IF EXISTS check_message_templates_purpose;
ALTER TABLE public.message_templates
    ADD CONSTRAINT check_message_templates_purpose CHECK (
        purpose IN (
            'transactional',
            'reminder',
            'event_invite',
            'event_follow_up',
            'marketing_campaign',
            'product_launch',
            'quote_follow_up',
            'reorder_reminder',
            'post_purchase_checkin'
        )
    );

-- 2. CẬP NHẬT BẢNG CUSTOMERS
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS marketing_opt_in boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz,
    ADD COLUMN IF NOT EXISTS marketing_opt_out_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_marketing_sent_at timestamptz;

-- 3. TẠO BẢNG MESSAGE_SEND_LOGS
CREATE TABLE IF NOT EXISTS public.message_send_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    event_registration_id uuid REFERENCES public.event_registrations(id) ON DELETE SET NULL,
    channel text NOT NULL,
    purpose text NOT NULL,
    recipient_email text,
    recipient_phone text,
    sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending',
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Bật RLS và tạo Policies cho message_send_logs
ALTER TABLE public.message_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage message send logs" ON public.message_send_logs
    FOR ALL TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Users view and create their own send logs" ON public.message_send_logs
    FOR ALL TO authenticated
    USING (sent_by = auth.uid())
    WITH CHECK (sent_by = auth.uid());

-- 4. CẬP NHẬT & TẠO SEED TEMPLATE
-- Cập nhật mẫu mặc định calendar_invite_default
UPDATE public.message_templates
SET purpose = 'event_invite',
    requires_opt_in = false,
    include_unsubscribe = false
WHERE key = 'calendar_invite_default';

-- Chèn/Cập nhật mẫu Chiến dịch ưu đãi hàng tháng
INSERT INTO public.message_templates (
    key,
    name,
    description,
    channel,
    purpose,
    subject_template,
    body_template,
    sample_variables,
    requires_opt_in,
    include_unsubscribe,
    max_send_frequency_days,
    is_active
) VALUES (
    'monthly_campaign_default',
    'Mẫu chiến dịch ưu đãi hàng tháng',
    'Mẫu tiếp thị chuyên nghiệp gửi kèm các ưu đãi đặc quyền hàng tháng cho khách hàng thành viên.',
    'email',
    'marketing_campaign',
    '[DESEMBRE] Ưu đãi Độc quyền Tháng này dành riêng cho Quý đối tác',
    'Kính gửi Quý đối tác / Khách hàng: {{customer_name}}

DESEMBRE Việt Nam xin gửi tới Quý khách chương trình ưu đãi đặc quyền áp dụng duy nhất trong tháng này.

🎁 CHI TIẾT ƯU ĐÃI:
- Tên chương trình: {{campaign_title}}
- Nội dung: {{promotion_details}}
- Thời hạn áp dụng: {{valid_until}}

Mọi chi tiết xin vui lòng liên hệ chuyên viên phụ trách: {{sale_name}}
Hotline hỗ trợ nhanh: {{company_phone}}

Trân trọng cảm ơn sự đồng hành của Quý đối tác!
Ban Quản trị DESEMBRE Partner Hub',
    '{"customer_name": "Nguyễn Thị C", "campaign_title": "Tri ân Khách hàng VIP", "promotion_details": "Giảm ngay 15% cho đơn hàng Phác đồ Tảo chuyên sâu từ 10 triệu đồng.", "valid_until": "30/06/2026", "sale_name": "Lê Thị D", "company_phone": "0912345678"}'::jsonb,
    true,
    true,
    30,
    true
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    purpose = EXCLUDED.purpose,
    subject_template = EXCLUDED.subject_template,
    body_template = EXCLUDED.body_template,
    sample_variables = EXCLUDED.sample_variables,
    requires_opt_in = EXCLUDED.requires_opt_in,
    include_unsubscribe = EXCLUDED.include_unsubscribe,
    max_send_frequency_days = EXCLUDED.max_send_frequency_days;

-- Thông báo làm mới bộ đệm cấu trúc lược đồ cho PostgREST API
NOTIFY pgrst, 'reload schema';
