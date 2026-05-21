-- Tạo bảng Quản lý Tài khoản Nguồn gửi (Sender Accounts)
CREATE TABLE IF NOT EXISTS public.sender_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    sender_email text NOT NULL,
    sender_name text,
    provider text NOT NULL DEFAULT 'google_calendar',
    auth_type text NOT NULL DEFAULT 'oauth_refresh_token',
    calendar_id text,
    secret_prefix text NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chỉ mục hỗ trợ truy vấn nhanh
CREATE INDEX IF NOT EXISTS idx_sender_accounts_active ON public.sender_accounts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sender_accounts_default ON public.sender_accounts(is_default) WHERE is_default = true;

-- Kích hoạt Row Level Security (RLS)
ALTER TABLE public.sender_accounts ENABLE ROW LEVEL SECURITY;

-- Hàm tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn Trigger cập nhật thời gian
DROP TRIGGER IF EXISTS trg_sender_accounts_updated_at ON public.sender_accounts;
CREATE TRIGGER trg_sender_accounts_updated_at
    BEFORE UPDATE ON public.sender_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- RLS Policies
-- 1. Admin và Sub-Admin được toàn quyền CRUD
DROP POLICY IF EXISTS "Cho phép Admin và Sub-Admin quản lý sender_accounts" ON public.sender_accounts;
CREATE POLICY "Cho phép Admin và Sub-Admin quản lý sender_accounts"
    ON public.sender_accounts
    FOR ALL
    USING (public.is_admin_or_sub_admin(auth.uid()));

-- 2. Bộ phận Sale (Users thông thường) chỉ được phép đọc các tài khoản đang kích hoạt
DROP POLICY IF EXISTS "Cho phép người dùng xác thực đọc sender_accounts kích hoạt" ON public.sender_accounts;
CREATE POLICY "Cho phép người dùng xác thực đọc sender_accounts kích hoạt"
    ON public.sender_accounts
    FOR SELECT
    USING (
        is_active = true 
        AND auth.role() = 'authenticated'
    );

-- Seed dữ liệu tài khoản Gmail DESEMBRE mặc định
INSERT INTO public.sender_accounts (
    id,
    name,
    sender_email,
    sender_name,
    provider,
    auth_type,
    calendar_id,
    secret_prefix,
    is_default,
    is_active
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- UUID cố định dễ tra cứu
    'Gmail Desembre mặc định',
    'desembrevn.com@gmail.com',
    'DESEMBRE Partner Hub',
    'google_calendar',
    'oauth_refresh_token',
    'desembrevn.com@gmail.com',
    'GOOGLE_DEFAULT',
    true,
    true
) ON CONFLICT DO NOTHING;
