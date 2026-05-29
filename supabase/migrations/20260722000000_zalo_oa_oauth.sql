-- ============================================================
-- Phase ZNS-1: Zalo OA OAuth — DB Migration
-- ============================================================

-- 1. Bổ sung các cột phục vụ OAuth và mapping Zalo OA vào sender_accounts
ALTER TABLE public.sender_accounts
  ADD COLUMN IF NOT EXISTS external_account_id text,         -- Zalo OA ID
  ADD COLUMN IF NOT EXISTS external_app_id     text,         -- Zalo App ID (để match app secret env)
  ADD COLUMN IF NOT EXISTS display_name        text;         -- Tên OA hiển thị lấy từ Zalo API

-- 2. Tạo bảng riêng lưu trữ credentials OAuth — tách biệt khỏi sender_accounts
--    để đảm bảo tuyệt đối không bao giờ trả về token về phía client.
CREATE TABLE IF NOT EXISTS public.sender_account_tokens (
  sender_account_id     uuid        PRIMARY KEY REFERENCES public.sender_accounts(id) ON DELETE CASCADE,
  -- Token lưu dạng mã hóa AES-GCM server-side, không bao giờ giải mã ở client
  access_token_enc      text        NOT NULL DEFAULT '',
  refresh_token_enc     text        NOT NULL DEFAULT '',
  token_expires_at      timestamptz NOT NULL DEFAULT now(),
  token_scope           text[],
  -- Metadata
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Index để look-up nhanh khi refresh token
CREATE INDEX IF NOT EXISTS idx_sat_expires_at
  ON public.sender_account_tokens (token_expires_at ASC);

-- 3. Kích hoạt RLS — BẢO MẬT THEN CHỐT:
--    Không cấu hình bất kỳ policy nào cho 'authenticated' hay 'anon'.
--    Chỉ service_role key (Deno Edge Functions) mới vượt qua được RLS.
ALTER TABLE public.sender_account_tokens ENABLE ROW LEVEL SECURITY;

-- KHÔNG có CREATE POLICY nào cho public/authenticated ở đây.
-- Đây là thiết kế có chủ ý để ngăn frontend Postgrest queries.

-- 4. Bổ sung action types mới vào sender_action_logs (comment documentation only)
-- Các actions có thể log: zalo_oauth_started | zalo_oauth_connected | zalo_oauth_failed
--                         zalo_token_refreshed | zalo_connection_failed | zalo_test_ok

-- 5. Index hỗ trợ query theo external_app_id (để refresh token cho đúng app)
CREATE INDEX IF NOT EXISTS idx_sa_external_app_id
  ON public.sender_accounts (external_app_id)
  WHERE external_app_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sa_provider_channel
  ON public.sender_accounts (provider, channel)
  WHERE is_active = true;
