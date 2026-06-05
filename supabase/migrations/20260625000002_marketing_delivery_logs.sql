-- ============================================================
-- Phase M-Infra 2: marketing_delivery_logs + RPC
-- ============================================================

-- 1. Delivery Logs table
CREATE TABLE IF NOT EXISTS marketing_delivery_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  campaign_id         uuid REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  template_id         uuid,                          -- references message_templates(id) - soft
  sender_account_id   uuid,                          -- business sender (soft ref)
  personal_sender_id  uuid,                          -- user_communication_accounts(id) (soft ref)
  channel             text NOT NULL,                 -- email | zalo | zalo_oa | phone | sms
  mode                text NOT NULL DEFAULT 'copy',  -- copy | open_app | provider_send
  status              text NOT NULL DEFAULT 'prepared',
    -- prepared | copied | opened | sent | failed | blocked
  reason              text,
  provider_message_id text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for common filters
CREATE INDEX IF NOT EXISTS idx_mdl_customer_id   ON marketing_delivery_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_mdl_campaign_id   ON marketing_delivery_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mdl_created_by    ON marketing_delivery_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_mdl_status        ON marketing_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_mdl_created_at    ON marketing_delivery_logs(created_at DESC);

-- 2. RLS
ALTER TABLE marketing_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mdl_admin_read" ON marketing_delivery_logs;
DROP POLICY IF EXISTS "mdl_sale_read_own" ON marketing_delivery_logs;
DROP POLICY IF EXISTS "mdl_insert_auth" ON marketing_delivery_logs;

-- Admin / SubAdmin: read all
CREATE POLICY "mdl_admin_read" ON marketing_delivery_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'sub_admin')
    )
  );

-- Sale: read own rows
CREATE POLICY "mdl_sale_read_own" ON marketing_delivery_logs
  FOR SELECT USING (created_by = auth.uid());

-- Any authenticated user can insert (gated by business logic in app/edge function)
CREATE POLICY "mdl_insert_auth" ON marketing_delivery_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. RPC: log_marketing_delivery_event
CREATE OR REPLACE FUNCTION log_marketing_delivery_event(
  p_customer_id         uuid,
  p_campaign_id         uuid DEFAULT NULL,
  p_template_id         uuid DEFAULT NULL,
  p_sender_account_id   uuid DEFAULT NULL,
  p_personal_sender_id  uuid DEFAULT NULL,
  p_channel             text DEFAULT 'zalo',
  p_mode                text DEFAULT 'copy',
  p_status              text DEFAULT 'copied',
  p_reason              text DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO marketing_delivery_logs (
    customer_id,
    campaign_id,
    template_id,
    sender_account_id,
    personal_sender_id,
    channel,
    mode,
    status,
    reason,
    provider_message_id,
    created_by
  ) VALUES (
    p_customer_id,
    p_campaign_id,
    p_template_id,
    p_sender_account_id,
    p_personal_sender_id,
    p_channel,
    p_mode,
    p_status,
    p_reason,
    p_provider_message_id,
    auth.uid()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION log_marketing_delivery_event TO authenticated;

-- 4. Update sender daily_usage when provider_send succeeds
CREATE OR REPLACE FUNCTION increment_sender_daily_usage(p_sender_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sender_accounts
  SET
    daily_usage   = COALESCE(daily_usage, 0) + 1,
    last_used_at  = now()
  WHERE id = p_sender_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_sender_daily_usage TO authenticated;
