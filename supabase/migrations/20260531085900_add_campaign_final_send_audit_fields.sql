-- Add audit fields for Phase 6F.5

ALTER TABLE public.marketing_campaigns
ADD COLUMN IF NOT EXISTS final_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS final_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS paused_at timestamptz,
ADD COLUMN IF NOT EXISTS paused_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pause_reason text;
