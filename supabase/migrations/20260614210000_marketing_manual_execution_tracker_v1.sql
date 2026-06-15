-- ============================================================================
-- A. ADDITIVE FIELDS ON MARKETING_CAMPAIGNS
-- ============================================================================
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS manual_execution_status text;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS manual_execution_started_at timestamptz;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS manual_execution_started_by uuid references auth.users(id);
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS manual_execution_completed_at timestamptz;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS manual_execution_completed_by uuid references auth.users(id);

-- Backfill
UPDATE public.marketing_campaigns SET manual_execution_status = 'not_started' WHERE manual_execution_status IS NULL;

-- Defaults & NOT NULL
ALTER TABLE public.marketing_campaigns ALTER COLUMN manual_execution_status SET DEFAULT 'not_started';
ALTER TABLE public.marketing_campaigns ALTER COLUMN manual_execution_status SET NOT NULL;

-- Constraints
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS check_marketing_manual_execution_status;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT check_marketing_manual_execution_status 
  CHECK (manual_execution_status IN ('not_started', 'in_progress', 'completed'));


-- ============================================================================
-- B. NEW TABLE: RECIPIENT EXECUTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketing_campaign_recipient_executions (
    id uuid primary key default gen_random_uuid()
);

ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS campaign_id uuid;
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS snapshot_id uuid;
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS snapshot_version int;
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS execution_status text;
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS assigned_to uuid references auth.users(id);
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS execution_note text;
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS contacted_at timestamptz;
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS created_by uuid references auth.users(id);
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.marketing_campaign_recipient_executions ADD COLUMN IF NOT EXISTS updated_by uuid references auth.users(id);

-- Defaults & NOT NULL
ALTER TABLE public.marketing_campaign_recipient_executions ALTER COLUMN execution_status SET DEFAULT 'pending';
ALTER TABLE public.marketing_campaign_recipient_executions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.marketing_campaign_recipient_executions ALTER COLUMN updated_at SET DEFAULT now();

-- Ensure fields cannot be null after potential backfills (if table wasn't empty)
UPDATE public.marketing_campaign_recipient_executions SET execution_status = 'pending' WHERE execution_status IS NULL;
UPDATE public.marketing_campaign_recipient_executions SET created_at = now() WHERE created_at IS NULL;
UPDATE public.marketing_campaign_recipient_executions SET updated_at = now() WHERE updated_at IS NULL;

-- Set NOT NULL only when we are sure data is clean. Note: brand new table has no data, so it's safe.
ALTER TABLE public.marketing_campaign_recipient_executions ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE public.marketing_campaign_recipient_executions ALTER COLUMN snapshot_id SET NOT NULL;
ALTER TABLE public.marketing_campaign_recipient_executions ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE public.marketing_campaign_recipient_executions ALTER COLUMN snapshot_version SET NOT NULL;
ALTER TABLE public.marketing_campaign_recipient_executions ALTER COLUMN execution_status SET NOT NULL;

-- Foreign Keys (ON DELETE RESTRICT)
ALTER TABLE public.marketing_campaign_recipient_executions DROP CONSTRAINT IF EXISTS mcre_campaign_fkey;
ALTER TABLE public.marketing_campaign_recipient_executions ADD CONSTRAINT mcre_campaign_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE RESTRICT;

ALTER TABLE public.marketing_campaign_recipient_executions DROP CONSTRAINT IF EXISTS mcre_snapshot_fkey;
ALTER TABLE public.marketing_campaign_recipient_executions ADD CONSTRAINT mcre_snapshot_fkey FOREIGN KEY (snapshot_id) REFERENCES public.marketing_campaign_recipients_snapshot(id) ON DELETE RESTRICT;

ALTER TABLE public.marketing_campaign_recipient_executions DROP CONSTRAINT IF EXISTS mcre_customer_fkey;
ALTER TABLE public.marketing_campaign_recipient_executions ADD CONSTRAINT mcre_customer_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

-- Constraints
ALTER TABLE public.marketing_campaign_recipient_executions DROP CONSTRAINT IF EXISTS check_mcre_execution_status;
ALTER TABLE public.marketing_campaign_recipient_executions ADD CONSTRAINT check_mcre_execution_status 
  CHECK (execution_status IN ('pending', 'in_progress', 'contacted', 'no_answer', 'unreachable', 'success', 'failed'));

ALTER TABLE public.marketing_campaign_recipient_executions DROP CONSTRAINT IF EXISTS check_mcre_snapshot_version;
ALTER TABLE public.marketing_campaign_recipient_executions ADD CONSTRAINT check_mcre_snapshot_version CHECK (snapshot_version >= 1);

ALTER TABLE public.marketing_campaign_recipient_executions DROP CONSTRAINT IF EXISTS unique_mcre_snapshot_id;
ALTER TABLE public.marketing_campaign_recipient_executions ADD CONSTRAINT unique_mcre_snapshot_id UNIQUE(snapshot_id);

ALTER TABLE public.marketing_campaign_recipient_executions DROP CONSTRAINT IF EXISTS unique_mcre_camp_cust_vers;
ALTER TABLE public.marketing_campaign_recipient_executions ADD CONSTRAINT unique_mcre_camp_cust_vers UNIQUE(campaign_id, customer_id, snapshot_version);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcre_campaign_id ON public.marketing_campaign_recipient_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mcre_campaign_version ON public.marketing_campaign_recipient_executions(campaign_id, snapshot_version);
CREATE INDEX IF NOT EXISTS idx_mcre_execution_status ON public.marketing_campaign_recipient_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_mcre_assigned_to ON public.marketing_campaign_recipient_executions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_mcre_customer_id ON public.marketing_campaign_recipient_executions(customer_id);
CREATE INDEX IF NOT EXISTS idx_mcre_contacted_at ON public.marketing_campaign_recipient_executions(contacted_at);


-- ============================================================================
-- C. NEW TABLE: EXECUTION LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marketing_campaign_execution_logs (
    id uuid primary key default gen_random_uuid()
);

ALTER TABLE public.marketing_campaign_execution_logs ADD COLUMN IF NOT EXISTS campaign_id uuid;
ALTER TABLE public.marketing_campaign_execution_logs ADD COLUMN IF NOT EXISTS execution_id uuid;
ALTER TABLE public.marketing_campaign_execution_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.marketing_campaign_execution_logs ADD COLUMN IF NOT EXISTS old_status text;
ALTER TABLE public.marketing_campaign_execution_logs ADD COLUMN IF NOT EXISTS new_status text;
ALTER TABLE public.marketing_campaign_execution_logs ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.marketing_campaign_execution_logs ADD COLUMN IF NOT EXISTS actor_id uuid references auth.users(id);
ALTER TABLE public.marketing_campaign_execution_logs ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- Defaults & NOT NULL
ALTER TABLE public.marketing_campaign_execution_logs ALTER COLUMN created_at SET DEFAULT now();
UPDATE public.marketing_campaign_execution_logs SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE public.marketing_campaign_execution_logs ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE public.marketing_campaign_execution_logs ALTER COLUMN action SET NOT NULL;

-- Foreign Keys (ON DELETE RESTRICT)
ALTER TABLE public.marketing_campaign_execution_logs DROP CONSTRAINT IF EXISTS mcel_campaign_fkey;
ALTER TABLE public.marketing_campaign_execution_logs ADD CONSTRAINT mcel_campaign_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE RESTRICT;

ALTER TABLE public.marketing_campaign_execution_logs DROP CONSTRAINT IF EXISTS mcel_execution_fkey;
ALTER TABLE public.marketing_campaign_execution_logs ADD CONSTRAINT mcel_execution_fkey FOREIGN KEY (execution_id) REFERENCES public.marketing_campaign_recipient_executions(id) ON DELETE RESTRICT;

-- Constraints
ALTER TABLE public.marketing_campaign_execution_logs DROP CONSTRAINT IF EXISTS check_mcel_action;
ALTER TABLE public.marketing_campaign_execution_logs ADD CONSTRAINT check_mcel_action 
  CHECK (action IN ('initialized', 'assigned', 'status_changed', 'note_updated', 'bulk_updated', 'completed'));


-- ============================================================================
-- D. RLS & GRANTS
-- ============================================================================
ALTER TABLE public.marketing_campaign_recipient_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_execution_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketing_campaign_recipient_executions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.marketing_campaign_execution_logs FROM PUBLIC, anon, authenticated;

-- Minimum SELECT ONLY
GRANT SELECT ON public.marketing_campaign_recipient_executions TO authenticated;
GRANT SELECT ON public.marketing_campaign_execution_logs TO authenticated;

-- Remove old policies before recreating
DROP POLICY IF EXISTS "Admin SELECT executions" ON public.marketing_campaign_recipient_executions;
CREATE POLICY "Admin SELECT executions" ON public.marketing_campaign_recipient_executions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

DROP POLICY IF EXISTS "Staff SELECT assigned executions" ON public.marketing_campaign_recipient_executions;
CREATE POLICY "Staff SELECT assigned executions" ON public.marketing_campaign_recipient_executions FOR SELECT TO authenticated USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Admin SELECT logs" ON public.marketing_campaign_execution_logs;
CREATE POLICY "Admin SELECT logs" ON public.marketing_campaign_execution_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

DROP POLICY IF EXISTS "Staff SELECT logs" ON public.marketing_campaign_execution_logs;
CREATE POLICY "Staff SELECT logs" ON public.marketing_campaign_execution_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.marketing_campaign_recipient_executions e WHERE e.id = execution_id AND e.assigned_to = auth.uid())
);


-- ============================================================================
-- E. RPC: SAFE DATA ACCESS FOR TRACKER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_manual_execution_rows(p_campaign_id uuid)
RETURNS TABLE (
  execution_id uuid,
  campaign_id uuid,
  snapshot_id uuid,
  customer_id uuid,
  customer_name_snapshot text,
  phone_snapshot text,
  email_snapshot text,
  facebook_uid_snapshot text,
  execution_status text,
  assigned_to uuid,
  execution_note text,
  contacted_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_staff boolean;
BEGIN
  v_is_admin := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin'));
  v_is_staff := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('sale', 'tele_lead', 'telesale'));

  IF NOT v_is_admin AND NOT v_is_staff THEN
    RAISE EXCEPTION 'Access denied. Valid role required.';
  END IF;

  RETURN QUERY
  SELECT 
    e.id AS execution_id,
    e.campaign_id,
    e.snapshot_id,
    e.customer_id,
    s.customer_name_snapshot,
    s.phone_snapshot,
    s.email_snapshot,
    s.facebook_uid_snapshot,
    e.execution_status,
    e.assigned_to,
    e.execution_note,
    e.contacted_at,
    e.updated_at
  FROM public.marketing_campaign_recipient_executions e
  JOIN public.marketing_campaign_recipients_snapshot s ON s.id = e.snapshot_id
  WHERE e.campaign_id = p_campaign_id
    AND (v_is_admin OR e.assigned_to = auth.uid());
END;
$$;


-- ============================================================================
-- F. RPC: INITIALIZE EXECUTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.initialize_manual_campaign_execution(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign record;
  v_snapshot_count int;
  v_inserted_count int;
  v_final_count int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')) THEN
    RAISE EXCEPTION 'Access denied. Requires admin or sub_admin.';
  END IF;

  -- Lock row FOR UPDATE
  SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found.'; END IF;
  
  IF v_campaign.approval_status != 'approved' THEN RAISE EXCEPTION 'Campaign must be approved.'; END IF;
  IF coalesce(v_campaign.approved_snapshot_version, 0) < 1 THEN RAISE EXCEPTION 'Campaign approved_snapshot_version must be >= 1.'; END IF;
  
  IF v_campaign.manual_execution_status IN ('in_progress', 'completed') THEN
    RAISE EXCEPTION 'Manual execution already initialized or completed.';
  END IF;

  SELECT count(*) INTO v_snapshot_count FROM public.marketing_campaign_recipients_snapshot 
  WHERE campaign_id = p_campaign_id AND snapshot_version = v_campaign.approved_snapshot_version;
  IF v_snapshot_count != v_campaign.approved_recipients_count THEN
    RAISE EXCEPTION 'Snapshot count (%) does not match approved_recipients_count (%). Data corrupted.', v_snapshot_count, v_campaign.approved_recipients_count;
  END IF;

  -- Insert ON CONFLICT DO NOTHING
  WITH inserted AS (
    INSERT INTO public.marketing_campaign_recipient_executions (
      campaign_id, snapshot_id, customer_id, snapshot_version, execution_status, created_by
    )
    SELECT p_campaign_id, id, customer_id, snapshot_version, 'pending', auth.uid()
    FROM public.marketing_campaign_recipients_snapshot
    WHERE campaign_id = p_campaign_id AND snapshot_version = v_campaign.approved_snapshot_version
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_inserted_count FROM inserted;

  -- Verify exact match after insertion
  SELECT count(*) INTO v_final_count FROM public.marketing_campaign_recipient_executions 
  WHERE campaign_id = p_campaign_id AND snapshot_version = v_campaign.approved_snapshot_version;
  IF v_final_count != v_campaign.approved_recipients_count THEN
    RAISE EXCEPTION 'Final execution row count (%) does not match approved count (%). Rollback.', v_final_count, v_campaign.approved_recipients_count;
  END IF;
  
  -- Idempotent setup
  IF v_campaign.manual_execution_status = 'not_started' THEN
      UPDATE public.marketing_campaigns
      SET manual_execution_status = 'in_progress', manual_execution_started_at = now(), manual_execution_started_by = auth.uid()
      WHERE id = p_campaign_id;

      INSERT INTO public.marketing_campaign_execution_logs (campaign_id, action, note, actor_id)
      VALUES (p_campaign_id, 'initialized', 'Initialized ' || v_inserted_count || ' execution rows.', auth.uid());
  END IF;
END;
$$;


-- ============================================================================
-- G. RPC: ASSIGN ROWS
-- ============================================================================
DROP FUNCTION IF EXISTS public.assign_manual_execution_rows(uuid[], uuid);
CREATE OR REPLACE FUNCTION public.assign_manual_execution_rows(p_execution_ids text[], p_assigned_to uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unique_ids uuid[];
  v_selected_count int;
  v_campaign_count int;
  v_campaign_id uuid;
  v_campaign_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')) THEN
    RAISE EXCEPTION 'Access denied. Requires admin or sub_admin.';
  END IF;

  IF p_execution_ids IS NULL OR array_length(p_execution_ids, 1) IS NULL THEN RAISE EXCEPTION 'No execution IDs provided.'; END IF;

  SELECT array_agg(DISTINCT id) INTO v_unique_ids FROM unnest(p_execution_ids::uuid[]) as id;

  -- Use CTE for locking and aggregation
  WITH locked_rows AS (
    SELECT * FROM public.marketing_campaign_recipient_executions 
    WHERE id = ANY(v_unique_ids) FOR UPDATE
  )
  SELECT count(*), count(DISTINCT campaign_id), (array_agg(campaign_id))[1] 
  INTO v_selected_count, v_campaign_count, v_campaign_id 
  FROM locked_rows;

  IF v_selected_count != array_length(v_unique_ids, 1) THEN RAISE EXCEPTION 'One or more execution rows do not exist.'; END IF;
  IF v_campaign_count > 1 THEN RAISE EXCEPTION 'Selected rows span multiple campaigns. Rejected.'; END IF;

  -- Verify campaign is in_progress
  SELECT manual_execution_status INTO v_campaign_status FROM public.marketing_campaigns WHERE id = v_campaign_id;
  IF v_campaign_status != 'in_progress' THEN RAISE EXCEPTION 'Manual execution must be in_progress.'; END IF;

  -- Validate assignee
  IF p_assigned_to IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_assigned_to) THEN RAISE EXCEPTION 'Assigned user does not exist.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_assigned_to AND role IN ('admin', 'sub_admin', 'sale', 'tele_lead', 'telesale')) THEN
      RAISE EXCEPTION 'Assigned user does not have a valid role for execution.';
    END IF;
  END IF;

  UPDATE public.marketing_campaign_recipient_executions
  SET assigned_to = p_assigned_to, updated_by = auth.uid(), updated_at = now()
  WHERE id = ANY(v_unique_ids);

  INSERT INTO public.marketing_campaign_execution_logs (campaign_id, action, note, actor_id)
  VALUES (v_campaign_id, 'assigned', 'Assigned ' || v_selected_count || ' rows to ' || p_assigned_to, auth.uid());
END;
$$;


-- ============================================================================
-- H. RPC: SINGLE UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_manual_execution_status(p_execution_id uuid, p_status text, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_staff boolean;
  v_exec record;
  v_campaign_status text;
BEGIN
  v_is_admin := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin'));
  v_is_staff := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('sale', 'tele_lead', 'telesale'));

  IF NOT v_is_admin AND NOT v_is_staff THEN RAISE EXCEPTION 'Access denied. Valid role required.'; END IF;
  IF p_status NOT IN ('pending', 'in_progress', 'contacted', 'no_answer', 'unreachable', 'success', 'failed') THEN
    RAISE EXCEPTION 'Invalid status.';
  END IF;

  SELECT * INTO v_exec FROM public.marketing_campaign_recipient_executions WHERE id = p_execution_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Execution not found.'; END IF;

  -- Verify campaign is in_progress
  SELECT manual_execution_status INTO v_campaign_status FROM public.marketing_campaigns WHERE id = v_exec.campaign_id;
  IF v_campaign_status != 'in_progress' THEN RAISE EXCEPTION 'Manual execution must be in_progress.'; END IF;

  -- Staff constraint
  IF v_is_staff AND NOT v_is_admin THEN
    IF v_exec.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Access denied. Row not assigned to you.'; END IF;
  END IF;

  UPDATE public.marketing_campaign_recipient_executions
  SET execution_status = p_status,
      execution_note = COALESCE(p_note, execution_note),
      contacted_at = CASE WHEN p_status IN ('contacted', 'success', 'failed', 'no_answer', 'unreachable') THEN now() ELSE contacted_at END,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_execution_id;

  INSERT INTO public.marketing_campaign_execution_logs (campaign_id, execution_id, action, old_status, new_status, note, actor_id)
  VALUES (v_exec.campaign_id, p_execution_id, 'status_changed', v_exec.execution_status, p_status, p_note, auth.uid());
END;
$$;


-- ============================================================================
-- I. RPC: BULK UPDATE
-- ============================================================================
DROP FUNCTION IF EXISTS public.bulk_update_manual_execution_status(uuid[], text, text);
CREATE OR REPLACE FUNCTION public.bulk_update_manual_execution_status(p_execution_ids text[], p_status text, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_staff boolean;
  v_unique_ids uuid[];
  v_selected_count int;
  v_campaign_count int;
  v_campaign_id uuid;
  v_unassigned_count int;
  v_campaign_status text;
BEGIN
  IF p_execution_ids IS NULL OR array_length(p_execution_ids, 1) IS NULL THEN RAISE EXCEPTION 'No execution IDs provided.'; END IF;
  IF p_status NOT IN ('pending', 'in_progress', 'contacted', 'no_answer', 'unreachable', 'success', 'failed') THEN
    RAISE EXCEPTION 'Invalid status.';
  END IF;

  v_is_admin := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin'));
  v_is_staff := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('sale', 'tele_lead', 'telesale'));

  IF NOT v_is_admin AND NOT v_is_staff THEN RAISE EXCEPTION 'Access denied. Valid role required.'; END IF;

  SELECT array_agg(DISTINCT id) INTO v_unique_ids FROM unnest(p_execution_ids::uuid[]) as id;

  WITH locked_rows AS (
    SELECT * FROM public.marketing_campaign_recipient_executions 
    WHERE id = ANY(v_unique_ids) FOR UPDATE
  )
  SELECT count(*), count(DISTINCT campaign_id), (array_agg(campaign_id))[1],
         count(*) FILTER (WHERE assigned_to IS DISTINCT FROM auth.uid())
  INTO v_selected_count, v_campaign_count, v_campaign_id, v_unassigned_count
  FROM locked_rows;

  IF v_selected_count != array_length(v_unique_ids, 1) THEN RAISE EXCEPTION 'One or more rows do not exist.'; END IF;
  IF v_campaign_count > 1 THEN RAISE EXCEPTION 'Bulk update across multiple campaigns is rejected.'; END IF;

  -- Verify campaign is in_progress
  SELECT manual_execution_status INTO v_campaign_status FROM public.marketing_campaigns WHERE id = v_campaign_id;
  IF v_campaign_status != 'in_progress' THEN RAISE EXCEPTION 'Manual execution must be in_progress.'; END IF;

  IF v_is_staff AND NOT v_is_admin AND v_unassigned_count > 0 THEN
    RAISE EXCEPTION 'Access denied. You cannot bulk update rows not assigned to you.';
  END IF;

  UPDATE public.marketing_campaign_recipient_executions
  SET execution_status = p_status,
      execution_note = COALESCE(p_note, execution_note),
      contacted_at = CASE WHEN p_status IN ('contacted', 'success', 'failed', 'no_answer', 'unreachable') THEN now() ELSE contacted_at END,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = ANY(v_unique_ids);

  INSERT INTO public.marketing_campaign_execution_logs (campaign_id, action, note, actor_id)
  VALUES (v_campaign_id, 'bulk_updated', 'Bulk updated ' || v_selected_count || ' rows to ' || p_status, auth.uid());
END;
$$;


-- ============================================================================
-- J. RPC: COMPLETE CAMPAIGN
-- ============================================================================
CREATE OR REPLACE FUNCTION public.complete_manual_campaign_execution(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')) THEN
    RAISE EXCEPTION 'Access denied. Requires admin or sub_admin.';
  END IF;

  SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found.'; END IF;
  IF v_campaign.manual_execution_status != 'in_progress' THEN RAISE EXCEPTION 'Campaign manual execution must be in_progress.'; END IF;

  UPDATE public.marketing_campaigns
  SET manual_execution_status = 'completed',
      manual_execution_completed_at = now(),
      manual_execution_completed_by = auth.uid()
  WHERE id = p_campaign_id;

  INSERT INTO public.marketing_campaign_execution_logs (campaign_id, action, note, actor_id)
  VALUES (p_campaign_id, 'completed', 'Execution marked as completed.', auth.uid());
END;
$$;


-- ============================================================================
-- K. RPC SECURITY REVOKE & GRANTS
-- ============================================================================
-- Revoke execution
REVOKE EXECUTE ON FUNCTION public.get_manual_execution_rows(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.initialize_manual_campaign_execution(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_manual_execution_rows(text[], uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_manual_execution_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bulk_update_manual_execution_status(text[], text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_manual_campaign_execution(uuid) FROM PUBLIC, anon;

-- Grant explicitly only to authenticated users
GRANT EXECUTE ON FUNCTION public.get_manual_execution_rows(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_manual_campaign_execution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_manual_execution_rows(text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_manual_execution_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_manual_execution_status(text[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_manual_campaign_execution(uuid) TO authenticated;

-- Notify
NOTIFY pgrst, 'reload schema';
