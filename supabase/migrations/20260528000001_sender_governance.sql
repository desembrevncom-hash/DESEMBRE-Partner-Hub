-- ============================================================
-- Phase M-Infra 1: Sender Governance - DB Migration
-- ============================================================

-- 1. Bổ sung fields cho sender_accounts (business senders)
ALTER TABLE sender_accounts
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_limit int DEFAULT 500,
  ADD COLUMN IF NOT EXISTS daily_usage int DEFAULT 0;

-- 2. Bổ sung fields cho user_communication_accounts (personal senders)
ALTER TABLE user_communication_accounts
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

-- 3. Tạo bảng sender_action_logs để ghi audit
CREATE TABLE IF NOT EXISTS sender_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,              -- test_connection | disable | enable | mark_reconnect
  sender_id uuid,
  sender_type text NOT NULL,         -- business | personal
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result text,                       -- healthy | warning | error | ok
  note text,
  created_at timestamptz DEFAULT now()
);

-- Index để query nhanh
CREATE INDEX IF NOT EXISTS idx_sender_action_logs_sender ON sender_action_logs(sender_id, sender_type);
CREATE INDEX IF NOT EXISTS idx_sender_action_logs_created ON sender_action_logs(created_at DESC);

-- RLS cho bảng sender_action_logs
ALTER TABLE sender_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_subadmin_read_sender_logs" ON sender_action_logs;
CREATE POLICY "admin_subadmin_read_sender_logs"
  ON sender_action_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'sub_admin')
    )
  );

DROP POLICY IF EXISTS "admin_subadmin_insert_sender_logs" ON sender_action_logs;
CREATE POLICY "admin_subadmin_insert_sender_logs"
  ON sender_action_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'sub_admin')
    )
  );
