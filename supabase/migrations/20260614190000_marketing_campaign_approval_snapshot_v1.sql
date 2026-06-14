-- ============================================================================
-- MIGRATION: M4 Campaign Approval + Recipient Snapshot v1
-- ============================================================================

-- 1. ADDITIVE FIELDS FOR MARKETING_CAMPAIGNS
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS approval_status text;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamptz;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS submitted_by uuid references auth.users(id);
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS approved_by uuid references auth.users(id);
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS rejected_by uuid references auth.users(id);
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS approval_note text;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS approved_snapshot_version int;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS approved_recipients_count int;

ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS template_id uuid references public.marketing_templates(id) ON DELETE RESTRICT;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS template_name_snapshot text;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS template_body_snapshot text;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS template_channel_snapshot text;

-- Temporarily drop the NOT VALID constraint to allow backfill updates on legacy rows
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;

-- Backfill
UPDATE public.marketing_campaigns SET approval_status = 'draft' WHERE approval_status IS NULL;
UPDATE public.marketing_campaigns SET approved_snapshot_version = 0 WHERE approved_snapshot_version IS NULL;
UPDATE public.marketing_campaigns SET approved_recipients_count = 0 WHERE approved_recipients_count IS NULL;

-- Restore the NOT VALID status constraint exactly as it was
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_status_check 
  CHECK (status IN ('draft', 'ready_for_export', 'archived')) NOT VALID;

-- Set NOT NULL & DEFAULT
ALTER TABLE public.marketing_campaigns ALTER COLUMN approval_status SET DEFAULT 'draft';
ALTER TABLE public.marketing_campaigns ALTER COLUMN approval_status SET NOT NULL;
ALTER TABLE public.marketing_campaigns ALTER COLUMN approved_snapshot_version SET DEFAULT 0;
ALTER TABLE public.marketing_campaigns ALTER COLUMN approved_snapshot_version SET NOT NULL;
ALTER TABLE public.marketing_campaigns ALTER COLUMN approved_recipients_count SET DEFAULT 0;
ALTER TABLE public.marketing_campaigns ALTER COLUMN approved_recipients_count SET NOT NULL;

-- Constraints
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS check_marketing_approval_status;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT check_marketing_approval_status 
  CHECK (approval_status IN ('draft', 'pending_review', 'approved', 'rejected'));

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS check_marketing_snapshot_version;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT check_marketing_snapshot_version CHECK (approved_snapshot_version >= 0);

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS check_marketing_recipients_count;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT check_marketing_recipients_count CHECK (approved_recipients_count >= 0);


-- ============================================================================
-- 2. SNAPSHOT TABLE HARDENING
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketing_campaign_recipients_snapshot (
    id uuid primary key default gen_random_uuid()
);

ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS campaign_id uuid;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS customer_name_snapshot text;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS phone_snapshot text;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS email_snapshot text;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS facebook_uid_snapshot text;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS zalo_uid_snapshot text;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS contact_quality_json jsonb;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS source_segment_rules_json jsonb;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS snapshot_version int;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD COLUMN IF NOT EXISTS created_by uuid references auth.users(id);

-- Set NOT NULL & Defaults
ALTER TABLE public.marketing_campaign_recipients_snapshot ALTER COLUMN contact_quality_json SET DEFAULT '{}'::jsonb;
ALTER TABLE public.marketing_campaign_recipients_snapshot ALTER COLUMN snapshot_version SET DEFAULT 1;
ALTER TABLE public.marketing_campaign_recipients_snapshot ALTER COLUMN created_at SET DEFAULT now();

-- 5 required NOT NULL fields
ALTER TABLE public.marketing_campaign_recipients_snapshot ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE public.marketing_campaign_recipients_snapshot ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE public.marketing_campaign_recipients_snapshot ALTER COLUMN source_segment_rules_json SET NOT NULL;
ALTER TABLE public.marketing_campaign_recipients_snapshot ALTER COLUMN snapshot_version SET NOT NULL;
ALTER TABLE public.marketing_campaign_recipients_snapshot ALTER COLUMN created_at SET NOT NULL;

-- FK ON DELETE RESTRICT (Never Cascade)
ALTER TABLE public.marketing_campaign_recipients_snapshot DROP CONSTRAINT IF EXISTS mcr_snapshot_campaign_fkey;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD CONSTRAINT mcr_snapshot_campaign_fkey 
  FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE RESTRICT;

ALTER TABLE public.marketing_campaign_recipients_snapshot DROP CONSTRAINT IF EXISTS mcr_snapshot_customer_fkey;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD CONSTRAINT mcr_snapshot_customer_fkey 
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

-- Safe Constraints
ALTER TABLE public.marketing_campaign_recipients_snapshot DROP CONSTRAINT IF EXISTS check_mcr_contact_quality_json;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD CONSTRAINT check_mcr_contact_quality_json CHECK (jsonb_typeof(contact_quality_json) = 'object');

ALTER TABLE public.marketing_campaign_recipients_snapshot DROP CONSTRAINT IF EXISTS check_mcr_source_segment_rules;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD CONSTRAINT check_mcr_source_segment_rules CHECK (jsonb_typeof(source_segment_rules_json) = 'object');

ALTER TABLE public.marketing_campaign_recipients_snapshot DROP CONSTRAINT IF EXISTS check_mcr_snapshot_version;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD CONSTRAINT check_mcr_snapshot_version CHECK (snapshot_version >= 1);

ALTER TABLE public.marketing_campaign_recipients_snapshot DROP CONSTRAINT IF EXISTS unique_mcr_campaign_customer_version;
ALTER TABLE public.marketing_campaign_recipients_snapshot ADD CONSTRAINT unique_mcr_campaign_customer_version UNIQUE(campaign_id, customer_id, snapshot_version);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcr_campaign_id ON public.marketing_campaign_recipients_snapshot(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mcr_campaign_version ON public.marketing_campaign_recipients_snapshot(campaign_id, snapshot_version);
CREATE INDEX IF NOT EXISTS idx_mcr_customer_id ON public.marketing_campaign_recipients_snapshot(customer_id);
CREATE INDEX IF NOT EXISTS idx_mcr_created_at ON public.marketing_campaign_recipients_snapshot(created_at);
CREATE INDEX IF NOT EXISTS idx_mcr_phone ON public.marketing_campaign_recipients_snapshot(phone_snapshot);
CREATE INDEX IF NOT EXISTS idx_mcr_email ON public.marketing_campaign_recipients_snapshot(email_snapshot);


-- ============================================================================
-- 3. APPROVAL LOG TABLE HARDENING
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketing_campaign_approval_logs (
    id uuid primary key default gen_random_uuid()
);

ALTER TABLE public.marketing_campaign_approval_logs ADD COLUMN IF NOT EXISTS campaign_id uuid;
ALTER TABLE public.marketing_campaign_approval_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.marketing_campaign_approval_logs ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.marketing_campaign_approval_logs ADD COLUMN IF NOT EXISTS actor_id uuid references auth.users(id);
ALTER TABLE public.marketing_campaign_approval_logs ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- Set NOT NULL & Defaults
ALTER TABLE public.marketing_campaign_approval_logs ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.marketing_campaign_approval_logs ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE public.marketing_campaign_approval_logs ALTER COLUMN action SET NOT NULL;

-- FK ON DELETE RESTRICT (Never Cascade)
ALTER TABLE public.marketing_campaign_approval_logs DROP CONSTRAINT IF EXISTS mcal_campaign_fkey;
ALTER TABLE public.marketing_campaign_approval_logs ADD CONSTRAINT mcal_campaign_fkey 
  FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE RESTRICT;

ALTER TABLE public.marketing_campaign_approval_logs DROP CONSTRAINT IF EXISTS check_approval_log_action;
ALTER TABLE public.marketing_campaign_approval_logs ADD CONSTRAINT check_approval_log_action 
  CHECK (action IN ('submitted', 'approved', 'rejected', 'reopened', 'archived'));


-- ============================================================================
-- 4. RLS ENABLE & POLICIES
-- ============================================================================
ALTER TABLE public.marketing_campaign_recipients_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_approval_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketing_campaign_recipients_snapshot FROM PUBLIC;
REVOKE ALL ON public.marketing_campaign_recipients_snapshot FROM anon;
REVOKE ALL ON public.marketing_campaign_recipients_snapshot FROM authenticated;

REVOKE ALL ON public.marketing_campaign_approval_logs FROM PUBLIC;
REVOKE ALL ON public.marketing_campaign_approval_logs FROM anon;
REVOKE ALL ON public.marketing_campaign_approval_logs FROM authenticated;

GRANT SELECT, INSERT ON public.marketing_campaign_recipients_snapshot TO authenticated;
GRANT SELECT, INSERT ON public.marketing_campaign_approval_logs TO authenticated;

-- Policies for Snapshot
DROP POLICY IF EXISTS "Admin and Sub-admin SELECT snapshot" ON public.marketing_campaign_recipients_snapshot;
CREATE POLICY "Admin and Sub-admin SELECT snapshot" ON public.marketing_campaign_recipients_snapshot
  FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

DROP POLICY IF EXISTS "Admin and Sub-admin INSERT snapshot" ON public.marketing_campaign_recipients_snapshot;
CREATE POLICY "Admin and Sub-admin INSERT snapshot" ON public.marketing_campaign_recipients_snapshot
  FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

-- Policies for Approval Logs
DROP POLICY IF EXISTS "Admin and Sub-admin SELECT approval logs" ON public.marketing_campaign_approval_logs;
CREATE POLICY "Admin and Sub-admin SELECT approval logs" ON public.marketing_campaign_approval_logs
  FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

DROP POLICY IF EXISTS "Admin and Sub-admin INSERT approval logs" ON public.marketing_campaign_approval_logs;
CREATE POLICY "Admin and Sub-admin INSERT approval logs" ON public.marketing_campaign_approval_logs
  FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));


-- ============================================================================
-- 5. RPCs
-- ============================================================================

-- 5.1. Submit for review
CREATE OR REPLACE FUNCTION public.submit_marketing_campaign_for_review(p_campaign_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_campaign record;
BEGIN
  -- Admin/Sub-admin check
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Requires admin or sub_admin.';
  END IF;

  -- Lock row FOR UPDATE
  SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  IF v_campaign.approval_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Campaign approval_status must be draft or rejected.';
  END IF;

  UPDATE public.marketing_campaigns
  SET approval_status = 'pending_review',
      submitted_for_review_at = now(),
      submitted_by = auth.uid(),
      approval_note = p_note
  WHERE id = p_campaign_id;

  INSERT INTO public.marketing_campaign_approval_logs(campaign_id, action, note, actor_id)
  VALUES (p_campaign_id, 'submitted', p_note, auth.uid());
END;
$$;

-- 5.2. Approve with Recipients (Atomic DB Insert)
CREATE OR REPLACE FUNCTION public.approve_marketing_campaign_with_recipients(
  p_campaign_id uuid,
  p_customer_ids uuid[],
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_campaign record;
  v_inserted_count int;
  v_new_version int;
BEGIN
  -- Admin/Sub-admin check
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Requires admin or sub_admin.';
  END IF;

  IF p_customer_ids IS NULL OR array_length(p_customer_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Customer list cannot be empty.';
  END IF;

  -- Lock row FOR UPDATE
  SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  IF v_campaign.approval_status != 'pending_review' THEN
    RAISE EXCEPTION 'Campaign must be pending_review to approve. Current status: %', v_campaign.approval_status;
  END IF;

  IF v_campaign.segment_rules_snapshot_json IS NULL OR jsonb_typeof(v_campaign.segment_rules_snapshot_json) <> 'object' THEN
    RAISE EXCEPTION 'Campaign segment_rules_snapshot_json must be a JSON object.';
  END IF;

  v_new_version := COALESCE(v_campaign.approved_snapshot_version, 0) + 1;

  -- Insert snapshot from DB using deduplicated customer_ids
  WITH unique_ids AS (
    SELECT DISTINCT unnest(p_customer_ids) as cust_id
  ),
  inserted AS (
    INSERT INTO public.marketing_campaign_recipients_snapshot(
      campaign_id,
      customer_id,
      customer_name_snapshot,
      phone_snapshot,
      email_snapshot,
      facebook_uid_snapshot,
      source_segment_rules_json,
      snapshot_version,
      created_by
    )
    SELECT
      p_campaign_id,
      c.id,
      c.name,
      c.phone,
      c.email,
      NULL, -- facebook_uid_snapshot
      v_campaign.segment_rules_snapshot_json,
      v_new_version,
      auth.uid()
    FROM unique_ids u
    JOIN public.customers c ON c.id = u.cust_id
    RETURNING id
  )
  SELECT count(*) INTO v_inserted_count FROM inserted;

  IF v_inserted_count = 0 THEN
    RAISE EXCEPTION 'Failed to create snapshots or no valid customers found matching the IDs.';
  END IF;

  UPDATE public.marketing_campaigns
  SET approval_status = 'approved',
      approved_snapshot_version = v_new_version,
      approved_recipients_count = v_inserted_count,
      approved_at = now(),
      approved_by = auth.uid(),
      approval_note = p_note
  WHERE id = p_campaign_id;

  INSERT INTO public.marketing_campaign_approval_logs(campaign_id, action, note, actor_id)
  VALUES (p_campaign_id, 'approved', p_note, auth.uid());
END;
$$;

-- 5.3. Reject
CREATE OR REPLACE FUNCTION public.reject_marketing_campaign(p_campaign_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_campaign record;
BEGIN
  -- Admin/Sub-admin check
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Requires admin or sub_admin.';
  END IF;

  -- Lock row FOR UPDATE
  SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  IF v_campaign.approval_status != 'pending_review' THEN
    RAISE EXCEPTION 'Campaign must be pending_review to reject.';
  END IF;

  UPDATE public.marketing_campaigns
  SET approval_status = 'rejected',
      rejected_at = now(),
      rejected_by = auth.uid(),
      approval_note = p_note
  WHERE id = p_campaign_id;

  INSERT INTO public.marketing_campaign_approval_logs(campaign_id, action, note, actor_id)
  VALUES (p_campaign_id, 'rejected', p_note, auth.uid());
END;
$$;

-- 5.4. Reopen
CREATE OR REPLACE FUNCTION public.reopen_marketing_campaign(p_campaign_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_campaign record;
BEGIN
  -- Admin/Sub-admin check
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Requires admin or sub_admin.';
  END IF;

  -- Lock row FOR UPDATE
  SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  IF v_campaign.approval_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Campaign must be approved or rejected to reopen.';
  END IF;

  UPDATE public.marketing_campaigns
  SET approval_status = 'draft',
      approval_note = p_note
  WHERE id = p_campaign_id;

  INSERT INTO public.marketing_campaign_approval_logs(campaign_id, action, note, actor_id)
  VALUES (p_campaign_id, 'reopened', p_note, auth.uid());
END;
$$;

-- Grant Execute
GRANT EXECUTE ON FUNCTION public.submit_marketing_campaign_for_review(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_marketing_campaign_with_recipients(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_marketing_campaign(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_marketing_campaign(uuid, text) TO authenticated;

-- Notify
NOTIFY pgrst, 'reload schema';
