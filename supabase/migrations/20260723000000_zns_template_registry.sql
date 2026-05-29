-- ============================================================
-- Phase ZNS-2: ZNS Template Registry Migration
-- ============================================================

CREATE TABLE IF NOT EXISTS public.zns_templates (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_account_id   uuid        NOT NULL REFERENCES public.sender_accounts(id) ON DELETE CASCADE,
  zalo_template_id    text        NOT NULL,
  template_name       text        NOT NULL,
  purpose             text,
  category            text,
  status              text        DEFAULT 'pending',
  required_params     jsonb       DEFAULT '[]'::jsonb,
  sample_payload      jsonb       DEFAULT '{}'::jsonb,
  is_active           boolean     DEFAULT true,
  last_synced_at      timestamptz,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  
  -- Prevent duplicate templates for the same Zalo OA
  UNIQUE (sender_account_id, zalo_template_id)
);

-- Enable RLS
ALTER TABLE public.zns_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Admin/SubAdmin full access
CREATE POLICY "Admin/SubAdmin can manage zns_templates"
ON public.zns_templates
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'sub_admin')
  )
);

-- Policy: Sale only read access to active templates
CREATE POLICY "Sale can read active zns_templates"
ON public.zns_templates
FOR SELECT TO authenticated
USING (
  is_active = true AND status = 'approved'
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_zns_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_zns_templates_timestamp
  BEFORE UPDATE ON public.zns_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_zns_templates_updated_at();

-- Index for querying templates by sender
CREATE INDEX IF NOT EXISTS idx_zns_templates_sender 
  ON public.zns_templates (sender_account_id);
