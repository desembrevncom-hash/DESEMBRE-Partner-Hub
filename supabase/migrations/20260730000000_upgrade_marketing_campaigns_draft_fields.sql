-- ============================================================================
-- Phase 6D.1: Upgrade Marketing Campaigns with Draft Fields
-- ============================================================================

ALTER TABLE public.marketing_campaigns
    ADD COLUMN IF NOT EXISTS channel text,
    ADD COLUMN IF NOT EXISTS draft_subject text,
    ADD COLUMN IF NOT EXISTS draft_body text,
    ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS approved_by uuid,
    ADD COLUMN IF NOT EXISTS approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS audience_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_previewed_at timestamptz;

-- Add safe indexes for future UI queries
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_channel ON public.marketing_campaigns(channel);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_approval_status ON public.marketing_campaigns(approval_status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_at_desc ON public.marketing_campaigns(created_at DESC);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
