CREATE TABLE IF NOT EXISTS public.system_ai_provider_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openai',
  provider_label text,
  api_base_url text,
  encrypted_api_key text,
  key_mask text,
  chat_model text not null default 'gpt-4o-mini',
  embedding_model text not null default 'text-embedding-3-small',
  is_enabled boolean not null default true,
  rag_use_rpc_brand_filter boolean not null default false,
  last_tested_at timestamptz,
  last_test_status text default 'untested',
  last_test_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id) on delete set null,
  
  CONSTRAINT valid_provider CHECK (provider in ('openai', 'openrouter', 'anthropic', 'gemini', 'custom')),
  CONSTRAINT valid_test_status CHECK (last_test_status in ('untested', 'success', 'failed'))
);

-- Bật RLS
ALTER TABLE public.system_ai_provider_settings ENABLE ROW LEVEL SECURITY;

-- Policies
-- (Admin/Sub-admin có quyền đọc cấu hình, nhưng cột encrypted_api_key sẽ cần xử lý an toàn qua Edge Function
-- vì PostgREST trả về nguyên record nếu có quyền select. Để chặn select cột encrypted_api_key qua GraphQL/REST,
-- ta không grant quyền select cột đó cho authenticated role, hoặc Edge function dùng Service Role Key.
-- Phương pháp đơn giản nhất là: chỉ Service Role được đọc mọi thứ, client không thể đọc trực tiếp.)

-- Drop policy nếu đã tồn tại (để có thể chạy lại an toàn)
DROP POLICY IF EXISTS "Admin and Sub-admin can read settings" ON public.system_ai_provider_settings;

CREATE POLICY "Admin and Sub-admin can read settings"
  ON public.system_ai_provider_settings
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_sub_admin(auth.uid())
  );

-- Tuy nhiên, policy select bình thường sẽ cho đọc mọi cột. 
-- Để bảo vệ tuyệt đối encrypted_api_key, ta chỉ nên thao tác qua Edge Function (dùng Service Role).
-- Nhưng nếu cần cho client xem, ta thu hồi quyền SELECT trực tiếp từ bảng:
REVOKE SELECT ON public.system_ai_provider_settings FROM authenticated;
REVOKE SELECT ON public.system_ai_provider_settings FROM anon;

-- Tạo một View an toàn để Frontend đọc metadata nếu cần (tùy chọn)
CREATE OR REPLACE VIEW public.vw_ai_provider_settings AS
  SELECT 
    id, provider, provider_label, api_base_url, key_mask, chat_model, 
    embedding_model, is_enabled, rag_use_rpc_brand_filter, last_tested_at, 
    last_test_status, last_test_message, created_at, updated_at
  FROM public.system_ai_provider_settings;

GRANT SELECT ON public.vw_ai_provider_settings TO authenticated;

-- Seed default data
INSERT INTO public.system_ai_provider_settings (id, provider) 
VALUES ('00000000-0000-0000-0000-000000000000', 'openai')
ON CONFLICT (id) DO NOTHING;
