-- ============================================================
-- Phase M-Infra 3A: Sender Provisioning & Lifecycle - Archive & Domain Support
-- ============================================================

-- 1. Bổ sung các cột lưu trữ cho sender_accounts
ALTER TABLE public.sender_accounts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS domain text DEFAULT NULL;

-- 2. Thêm chỉ mục để tăng tốc độ truy vấn trạng thái
CREATE INDEX IF NOT EXISTS idx_sender_accounts_archived ON public.sender_accounts(archived_at);
CREATE INDEX IF NOT EXISTS idx_sender_accounts_status_lookup ON public.sender_accounts(status);
