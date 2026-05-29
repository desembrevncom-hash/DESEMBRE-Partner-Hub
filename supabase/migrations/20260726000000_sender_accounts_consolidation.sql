-- ============================================================
-- Phase M-Infra 2: Sender Account Consolidation
-- ============================================================

-- 1. Cập nhật record Gmail mặc định trong sender_accounts nếu có
UPDATE public.sender_accounts
SET provider = 'gmail/google', channel = 'email'
WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- 2. Di chuyển các tài khoản Google Calendar khác sang sender_accounts
INSERT INTO public.sender_accounts (
  name,
  sender_email,
  sender_name,
  provider,
  auth_type,
  calendar_id,
  secret_prefix,
  is_default,
  is_active,
  channel,
  status,
  health_status
)
SELECT 
  g.name,
  COALESCE(g.owner_email, 'info@desembrevn.com'),
  g.name,
  'gmail/google',
  'oauth_refresh_token',
  g.calendar_id,
  'GOOGLE_DEFAULT',
  g.is_default,
  g.is_active,
  'email',
  CASE WHEN g.is_active = true THEN 'active' ELSE 'inactive' END,
  'unknown'
FROM public.google_calendar_accounts g
WHERE NOT EXISTS (
  SELECT 1 FROM public.sender_accounts s
  WHERE s.sender_email = COALESCE(g.owner_email, 'info@desembrevn.com')
);

-- 3. Cập nhật các bản ghi có provider = 'google_calendar' sang 'gmail/google'
UPDATE public.sender_accounts
SET provider = 'gmail/google'
WHERE provider = 'google_calendar';

-- Làm mới schema
NOTIFY pgrst, 'reload schema';
