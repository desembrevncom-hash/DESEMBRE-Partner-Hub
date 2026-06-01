-- Create webhook_events table
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    provider_event_id text,
    dedupe_key text NOT NULL,
    event_type text NOT NULL,
    event_version text,
    channel text,
    related_message_id text,
    related_campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
    related_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    payload jsonb NOT NULL,
    headers_redacted jsonb,
    signature_valid boolean DEFAULT false,
    status text DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
    error_message text,
    attempt_count int DEFAULT 0,
    received_at timestamptz DEFAULT now(),
    processed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_dedupe ON public.webhook_events(provider, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type ON public.webhook_events(provider, event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_campaign ON public.webhook_events(related_campaign_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_customer ON public.webhook_events(related_customer_id);

-- RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin/Sub Admin can read
CREATE POLICY "Admin can view webhook events" 
  ON public.webhook_events 
  FOR SELECT 
  USING (public.is_admin_or_sub_admin(auth.uid()));

-- No insert/update/delete from client
-- Edge functions using service role bypass RLS, so no INSERT policy needed here.

-- Rollback plan (Note for reference, not executed here):
-- DROP TABLE IF EXISTS public.webhook_events;
