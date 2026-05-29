-- ============================================================
-- Phase ZNS-4: Update marketing_delivery_logs observability fields
-- ============================================================

-- Thêm các cột mới cho delivery observability
ALTER TABLE public.marketing_delivery_logs
  ADD COLUMN IF NOT EXISTS dedupe_key          text,
  ADD COLUMN IF NOT EXISTS normalized_error_code text,
  ADD COLUMN IF NOT EXISTS retry_count         int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at       timestamptz,
  ADD COLUMN IF NOT EXISTS provider_response   jsonb,
  ADD COLUMN IF NOT EXISTS delivery_metadata   jsonb;

-- Indexes để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_mdl_dedupe_key
  ON public.marketing_delivery_logs (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mdl_status
  ON public.marketing_delivery_logs (status);

CREATE INDEX IF NOT EXISTS idx_mdl_normalized_error_code
  ON public.marketing_delivery_logs (normalized_error_code)
  WHERE normalized_error_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mdl_created_at
  ON public.marketing_delivery_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mdl_sender_account_id
  ON public.marketing_delivery_logs (sender_account_id)
  WHERE sender_account_id IS NOT NULL;

-- ============================================================
-- Create marketing_retry_queue table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_retry_queue (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_log_id     uuid        REFERENCES public.marketing_delivery_logs(id) ON DELETE SET NULL,
  customer_id         uuid        REFERENCES public.customers(id) ON DELETE CASCADE,
  zns_template_id     uuid        REFERENCES public.zns_templates(id) ON DELETE SET NULL,
  sender_account_id   uuid        REFERENCES public.sender_accounts(id) ON DELETE SET NULL,
  payload             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  retry_reason        text,
  normalized_error_code text,
  retry_count         int         NOT NULL DEFAULT 0,
  max_retries         int         NOT NULL DEFAULT 3,
  next_retry_at       timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  status              text        NOT NULL DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_retry_queue ENABLE ROW LEVEL SECURITY;

-- Admin/SubAdmin can manage retry queue
CREATE POLICY "Admin/SubAdmin can manage retry queue"
ON public.marketing_retry_queue
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'sub_admin')
  )
);

-- Index for processing
CREATE INDEX IF NOT EXISTS idx_mrq_next_retry
  ON public.marketing_retry_queue (next_retry_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_mrq_status
  ON public.marketing_retry_queue (status);

CREATE INDEX IF NOT EXISTS idx_mrq_sender
  ON public.marketing_retry_queue (sender_account_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_marketing_retry_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_retry_queue_timestamp
  BEFORE UPDATE ON public.marketing_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_retry_queue_updated_at();
