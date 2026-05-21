-- Migration: Phase 7.3-7.5 — Hallucination Detector, Cost Control, Cache Layer

-- ===================================================
-- PHẦN 5: HALLUCINATION DETECTOR — banned phrases table
-- ===================================================

CREATE TABLE IF NOT EXISTS public.ai_banned_phrases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phrase text NOT NULL UNIQUE,
    category text NOT NULL DEFAULT 'medical_claim', -- medical_claim | legal_claim | competitor
    severity text NOT NULL DEFAULT 'high',           -- high | medium
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_banned_phrases_active ON public.ai_banned_phrases (is_active);

-- Enable RLS
ALTER TABLE public.ai_banned_phrases ENABLE ROW LEVEL SECURITY;

-- Admin manages banned phrases
DROP POLICY IF EXISTS "Admin can manage banned phrases" ON public.ai_banned_phrases;
CREATE POLICY "Admin can manage banned phrases"
ON public.ai_banned_phrases FOR ALL TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Edge function (service role) reads all
-- (no extra policy needed — service role bypasses RLS)

-- Seed default banned phrases
INSERT INTO public.ai_banned_phrases (phrase, category, severity) VALUES
  ('trị dứt điểm', 'medical_claim', 'high'),
  ('chữa khỏi', 'medical_claim', 'high'),
  ('chữa hoàn toàn', 'medical_claim', 'high'),
  ('cam kết hiệu quả', 'medical_claim', 'high'),
  ('đảm bảo 100%', 'medical_claim', 'high'),
  ('hiệu quả 100%', 'medical_claim', 'high'),
  ('tuyệt đối an toàn', 'medical_claim', 'high'),
  ('không tác dụng phụ', 'medical_claim', 'high'),
  ('điều trị y khoa', 'medical_claim', 'high'),
  ('kê đơn', 'medical_claim', 'high'),
  ('thuốc đặc trị', 'medical_claim', 'high'),
  ('trị nám dứt điểm', 'medical_claim', 'high'),
  ('xóa sẹo hoàn toàn', 'medical_claim', 'high'),
  ('trẻ hóa tức thì', 'medical_claim', 'medium'),
  ('kết quả ngay lập tức', 'medical_claim', 'medium'),
  ('thần kỳ', 'medical_claim', 'medium'),
  ('đột phá', 'medical_claim', 'medium')
ON CONFLICT (phrase) DO NOTHING;

-- ===================================================
-- PHẦN 6: TOKEN & COST CONTROL
-- ===================================================

-- Add hallucination blocked info to ai_conversations
ALTER TABLE public.ai_conversations
ADD COLUMN IF NOT EXISTS hallucination_blocked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_phrases text[];

-- ai_usage_logs: per-request cost tracking
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    mode text NOT NULL,
    provider text,                    -- openai | gemini
    model text,                       -- gpt-4o-mini etc
    prompt_tokens integer DEFAULT 0,
    completion_tokens integer DEFAULT 0,
    total_tokens integer DEFAULT 0,
    estimated_cost_usd numeric(10,6) DEFAULT 0, -- calculated at insert time
    cache_hit boolean DEFAULT false,  -- was this served from cache?
    latency_ms integer,               -- response time in ms
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_mode ON public.ai_usage_logs (mode);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Admin sees all
DROP POLICY IF EXISTS "Admin can view all usage logs" ON public.ai_usage_logs;
CREATE POLICY "Admin can view all usage logs"
ON public.ai_usage_logs FOR SELECT TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Daily usage summary view
CREATE OR REPLACE VIEW public.ai_daily_usage_summary AS
SELECT
    date_trunc('day', created_at) AS day,
    mode,
    COUNT(*) AS total_requests,
    SUM(total_tokens) AS total_tokens,
    SUM(estimated_cost_usd) AS total_cost_usd,
    AVG(total_tokens) AS avg_tokens_per_request,
    SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) AS cache_hits,
    ROUND(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS cache_hit_rate_pct
FROM public.ai_usage_logs
GROUP BY date_trunc('day', created_at), mode
ORDER BY day DESC, mode;

-- Top expensive users view
CREATE OR REPLACE VIEW public.ai_top_users AS
SELECT
    user_id,
    COUNT(*) AS total_requests,
    SUM(total_tokens) AS total_tokens,
    SUM(estimated_cost_usd) AS total_cost_usd
FROM public.ai_usage_logs
WHERE created_at >= now() - interval '30 days'
GROUP BY user_id
ORDER BY total_cost_usd DESC
LIMIT 20;

-- ===================================================
-- PHẦN 7: CACHE LAYER
-- ===================================================

CREATE TABLE IF NOT EXISTS public.ai_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key text NOT NULL UNIQUE,   -- sha256 hash of the input
    cache_type text NOT NULL,         -- embedding | summary | chunks | rewrite
    payload jsonb NOT NULL,           -- the cached result
    hit_count integer DEFAULT 0,      -- how many times it was served from cache
    expires_at timestamptz,           -- NULL = never expires (e.g. embeddings)
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON public.ai_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_type ON public.ai_cache (cache_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON public.ai_cache (expires_at);

-- No RLS (accessed via service role only from Edge Functions)
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- Admin can view cache stats
DROP POLICY IF EXISTS "Admin can view cache" ON public.ai_cache;
CREATE POLICY "Admin can view cache"
ON public.ai_cache FOR SELECT TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Function to delete expired cache entries (called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.ai_cache WHERE expires_at IS NOT NULL AND expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Cache stats function for admin dashboard
CREATE OR REPLACE FUNCTION public.get_cache_stats()
RETURNS TABLE (
    cache_type text,
    total_entries bigint,
    total_hits bigint,
    expired_entries bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ac.cache_type,
        COUNT(*) AS total_entries,
        SUM(ac.hit_count) AS total_hits,
        SUM(CASE WHEN ac.expires_at IS NOT NULL AND ac.expires_at < now() THEN 1 ELSE 0 END) AS expired_entries
    FROM public.ai_cache ac
    GROUP BY ac.cache_type
    ORDER BY total_entries DESC;
END;
$$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
