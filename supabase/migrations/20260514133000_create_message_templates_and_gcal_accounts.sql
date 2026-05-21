-- ============================================================================
-- MIGRATION: Tạo Module Quản lý Mẫu Tin nhắn & Tài khoản Lịch Google Nguồn
-- ============================================================================

-- 1. TẠO BẢNG QUẢN LÝ MẪU TIN NHẮN (MESSAGE TEMPLATES)
CREATE TABLE IF NOT EXISTS public.message_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    channel text NOT NULL DEFAULT 'calendar_invite',
    subject_template text,
    body_template text NOT NULL,
    sample_variables jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TẠO BẢNG QUẢN LÝ TÀI KHOẢN LỊCH GOOGLE NGUỒN GỬI
CREATE TABLE IF NOT EXISTS public.google_calendar_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    calendar_id text NOT NULL,
    owner_email text,
    provider text NOT NULL DEFAULT 'google_calendar',
    auth_type text NOT NULL DEFAULT 'service_account',
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. TẠO BẢNG LỊCH SỬ THỬ NGHIỆM MẪU TIN NHẮN (TEMPLATE TEST LOGS)
CREATE TABLE IF NOT EXISTS public.template_test_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
    calendar_account_id uuid REFERENCES public.google_calendar_accounts(id) ON DELETE SET NULL,
    tested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    test_email text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    error_message text,
    provider_response jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- THIẾT LẬP TRIGGER TỰ ĐỘNG CẬP NHẬT CỘT UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER update_message_templates_updated_at
    BEFORE UPDATE ON public.message_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_calendar_accounts_updated_at ON public.google_calendar_accounts;
CREATE TRIGGER update_google_calendar_accounts_updated_at
    BEFORE UPDATE ON public.google_calendar_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- BẬT ROW LEVEL SECURITY (RLS) & TẠO POLICIES
-- ============================================================================
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_test_logs ENABLE ROW LEVEL SECURITY;

-- Quyền trên Message Templates
DROP POLICY IF EXISTS "Admins manage message templates" ON public.message_templates;
CREATE POLICY "Admins manage message templates" ON public.message_templates
    FOR ALL TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone view active message templates" ON public.message_templates;
CREATE POLICY "Anyone view active message templates" ON public.message_templates
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Quyền trên Google Calendar Accounts
DROP POLICY IF EXISTS "Admins manage google calendar accounts" ON public.google_calendar_accounts;
CREATE POLICY "Admins manage google calendar accounts" ON public.google_calendar_accounts
    FOR ALL TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone view active calendar accounts" ON public.google_calendar_accounts;
CREATE POLICY "Anyone view active calendar accounts" ON public.google_calendar_accounts
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Quyền trên Template Test Logs
DROP POLICY IF EXISTS "Admins manage template test logs" ON public.template_test_logs;
CREATE POLICY "Admins manage template test logs" ON public.template_test_logs
    FOR ALL TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view and create their own test logs" ON public.template_test_logs;
CREATE POLICY "Users view and create their own test logs" ON public.template_test_logs
    FOR ALL TO authenticated
    USING (tested_by = auth.uid())
    WITH CHECK (tested_by = auth.uid());

-- ============================================================================
-- NẠP DỮ LIỆU MẪU BAN ĐẦU (SEEDING)
-- ============================================================================

-- Nạp Mẫu Thư mời Lịch Google mặc định
INSERT INTO public.message_templates (
    key, 
    name, 
    description, 
    channel, 
    subject_template, 
    body_template, 
    sample_variables, 
    is_active
) VALUES (
    'calendar_invite_default',
    'Mẫu mời sự kiện Google Calendar',
    'Mẫu nội dung chuẩn hóa gửi qua Google Calendar tới đối tác tham dự sự kiện doanh nghiệp.',
    'calendar_invite',
    '[DESEMBRE] Thư mời: {{event_title}}',
    'Kính gửi Quý đối tác / Khách mời: {{customer_name}}

Công ty {{company_name}} trân trọng kính mời Quý khách tham dự chương trình đào tạo và chuyển giao phác đồ chuyên sâu.

📌 THÔNG TIN SỰ KIỆN:
- Chủ đề: {{event_title}}
- Thời gian: {{event_time}}
- Địa điểm: {{event_location}}
- Link trực tuyến: {{meeting_url}}

Chuyên viên phụ trách: {{sale_name}}
Link nạp nhanh vào Lịch Google: {{calendar_link}}

Sự hiện diện của Quý khách là niềm vinh hạnh lớn cho công ty chúng tôi.
Trân trọng,
Ban Giám Đốc DESEMBRE Partner Hub',
    '{"customer_name": "Nguyễn Văn A", "event_title": "Đào tạo Phác đồ Trị mụn", "event_time": "08:30 ngày 20/05/2026", "event_location": "53 Triều Khúc, Hà Nội", "meeting_url": "https://zoom.us/j/123456", "sale_name": "Trần Thị B", "calendar_link": "https://calendar.google.com/...", "company_name": "DESEMBRE Việt Nam"}'::jsonb,
    true
) ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    subject_template = EXCLUDED.subject_template,
    body_template = EXCLUDED.body_template,
    sample_variables = EXCLUDED.sample_variables;

-- Nạp Tài khoản Lịch Google gốc mặc định
INSERT INTO public.google_calendar_accounts (
    name,
    calendar_id,
    owner_email,
    provider,
    auth_type,
    is_default,
    is_active
) SELECT 
    'Lịch Công Ty (Mặc định)',
    'primary',
    'desembrevn.com@gmail.com',
    'google_calendar',
    'service_account',
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.google_calendar_accounts WHERE calendar_id = 'primary'
);

-- Thông báo làm mới bộ đệm cấu trúc lược đồ cho PostgREST API
NOTIFY pgrst, 'reload schema';
