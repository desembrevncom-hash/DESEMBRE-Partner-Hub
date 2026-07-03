-- =================================================================================
-- M3 Sender Accounts Readiness v1
-- =================================================================================

-- [clean-replay compatibility repair]
-- Forward-declare columns added in 20260625000001_sender_governance.sql to prevent 'column does not exist' during local clean reset
-- Note: Remote databases that have already applied this version will not be affected by this repair.
-- Fresh/local environments will run this repaired logic. Migration history must be checked before future deployments.

-- 1. ADDITIVE COLUMNS ONLY (Do not touch legacy status or is_active)
ALTER TABLE public.sender_accounts
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS readiness_status text,
  ADD COLUMN IF NOT EXISTS readiness_note text,
  ADD COLUMN IF NOT EXISTS readiness_last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS readiness_updated_by uuid references auth.users(id);

ALTER TABLE public.sender_accounts ALTER COLUMN readiness_status SET DEFAULT 'needs_review';

-- 2. SAFE BACKFILL
-- Using is_active as the true source of truth. Do not use the newly added 'status' column which defaults to 'active'.
UPDATE public.sender_accounts
SET readiness_status = CASE
  WHEN is_active IS TRUE THEN 'ready'
  WHEN is_active IS FALSE THEN 'disabled'
  ELSE 'needs_review'
END
WHERE readiness_status IS NULL
   OR readiness_status NOT IN ('not_configured', 'needs_review', 'ready', 'disabled');

-- 3. CONSTRAINTS & INDEXES
ALTER TABLE public.sender_accounts DROP CONSTRAINT IF EXISTS check_sender_readiness_status;
ALTER TABLE public.sender_accounts ADD CONSTRAINT check_sender_readiness_status CHECK (readiness_status IN ('not_configured', 'needs_review', 'ready', 'disabled'));

CREATE INDEX IF NOT EXISTS idx_sender_accounts_readiness_status ON public.sender_accounts(readiness_status);
CREATE INDEX IF NOT EXISTS idx_sender_accounts_channel ON public.sender_accounts(channel);
CREATE INDEX IF NOT EXISTS idx_sender_accounts_health_status ON public.sender_accounts(health_status);

-- 4. SAFE VIEW (No last_error, no secrets, filter Admin/Sub-admin)
CREATE OR REPLACE VIEW public.v_sender_accounts_readiness_safe
WITH (security_invoker = true)
AS SELECT
  id,
  name,
  channel,
  provider,
  sender_email,
  sender_name,
  status as legacy_status,
  readiness_status,
  health_status,
  last_checked_at,
  readiness_note,
  readiness_last_reviewed_at,
  created_at,
  updated_at
FROM public.sender_accounts
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'sub_admin')
);

REVOKE ALL ON public.v_sender_accounts_readiness_safe FROM PUBLIC;
REVOKE ALL ON public.v_sender_accounts_readiness_safe FROM anon;
REVOKE ALL ON public.v_sender_accounts_readiness_safe FROM authenticated;
GRANT SELECT ON public.v_sender_accounts_readiness_safe TO authenticated;

-- 5. SAFE RPC FOR UPDATING READINESS
CREATE OR REPLACE FUNCTION public.update_sender_account_readiness(
  p_account_id uuid,
  p_readiness_status text,
  p_readiness_note text
) RETURNS void AS $$
BEGIN
  -- Validate Admin/Sub-admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'sub_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Only Admins can update readiness.';
  END IF;

  -- Validate allowed status
  IF p_readiness_status NOT IN ('not_configured', 'needs_review', 'ready', 'disabled') THEN
    RAISE EXCEPTION 'Invalid readiness status';
  END IF;

  -- Update ONLY readiness fields (Do not update legacy status, is_active, provider, auth_type, etc.)
  UPDATE public.sender_accounts
  SET 
    readiness_status = p_readiness_status,
    readiness_note = p_readiness_note,
    readiness_last_reviewed_at = now(),
    readiness_updated_by = auth.uid()
  WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.update_sender_account_readiness(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_sender_account_readiness(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_sender_account_readiness(uuid, text, text) TO authenticated;

-- 6. RELOAD POSTGREST
NOTIFY pgrst, 'reload schema';
