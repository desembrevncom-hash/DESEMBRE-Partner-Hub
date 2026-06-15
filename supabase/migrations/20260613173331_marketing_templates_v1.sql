-- Create Base Table
CREATE TABLE IF NOT EXISTS public.marketing_templates (
    id uuid primary key default gen_random_uuid()
);

-- ADD COLUMN IF NOT EXISTS for partial/stale table safety
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS variables_json jsonb default '[]'::jsonb;
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS status text default 'draft';
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS version int default 1;
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS created_by uuid references auth.users(id);
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS updated_by uuid references auth.users(id);
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS archived_by uuid references auth.users(id);
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS created_at timestamptz default now();
ALTER TABLE public.marketing_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

-- Default Hardening
ALTER TABLE public.marketing_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.marketing_templates ALTER COLUMN variables_json SET DEFAULT '[]'::jsonb;
ALTER TABLE public.marketing_templates ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.marketing_templates ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE public.marketing_templates ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.marketing_templates ALTER COLUMN updated_at SET DEFAULT now();

-- Enforce NOT NULL constraints (will fail if invalid data exists, which is acceptable on Staging)
ALTER TABLE public.marketing_templates ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.marketing_templates ALTER COLUMN channel SET NOT NULL;
ALTER TABLE public.marketing_templates ALTER COLUMN body SET NOT NULL;
ALTER TABLE public.marketing_templates ALTER COLUMN variables_json SET NOT NULL;
ALTER TABLE public.marketing_templates ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.marketing_templates ALTER COLUMN version SET NOT NULL;
ALTER TABLE public.marketing_templates ALTER COLUMN created_by SET NOT NULL;

-- Constraints
ALTER TABLE public.marketing_templates DROP CONSTRAINT IF EXISTS check_templates_name_length;
ALTER TABLE public.marketing_templates ADD CONSTRAINT check_templates_name_length CHECK (char_length(name) > 0);

ALTER TABLE public.marketing_templates DROP CONSTRAINT IF EXISTS check_templates_body_length;
ALTER TABLE public.marketing_templates ADD CONSTRAINT check_templates_body_length CHECK (char_length(body) > 0);

ALTER TABLE public.marketing_templates DROP CONSTRAINT IF EXISTS check_templates_variables_type;
ALTER TABLE public.marketing_templates ADD CONSTRAINT check_templates_variables_type CHECK (jsonb_typeof(variables_json) = 'array');

ALTER TABLE public.marketing_templates DROP CONSTRAINT IF EXISTS check_templates_channel;
ALTER TABLE public.marketing_templates ADD CONSTRAINT check_templates_channel CHECK (channel IN ('email', 'zalo_manual', 'facebook_manual', 'call_script', 'export_only'));

ALTER TABLE public.marketing_templates DROP CONSTRAINT IF EXISTS check_templates_status;
ALTER TABLE public.marketing_templates ADD CONSTRAINT check_templates_status CHECK (status IN ('draft', 'active', 'archived'));

ALTER TABLE public.marketing_templates DROP CONSTRAINT IF EXISTS check_templates_version;
ALTER TABLE public.marketing_templates ADD CONSTRAINT check_templates_version CHECK (version >= 1);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_templates_channel ON public.marketing_templates(channel);
CREATE INDEX IF NOT EXISTS idx_marketing_templates_status ON public.marketing_templates(status);
CREATE INDEX IF NOT EXISTS idx_marketing_templates_archived_at ON public.marketing_templates(archived_at);
CREATE INDEX IF NOT EXISTS idx_marketing_templates_created_by ON public.marketing_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_templates_created_at ON public.marketing_templates(created_at);

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_marketing_templates_updated_at ON public.marketing_templates;
CREATE TRIGGER set_marketing_templates_updated_at
BEFORE UPDATE ON public.marketing_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- RLS & Security
ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.marketing_templates FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.marketing_templates FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.marketing_templates FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.marketing_templates TO authenticated;

-- Policies (Admin/Sub-admin ONLY)
DROP POLICY IF EXISTS "Admins can view templates" ON public.marketing_templates;
CREATE POLICY "Admins can view templates" ON public.marketing_templates
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'sub_admin')
  )
);

DROP POLICY IF EXISTS "Admins can insert templates" ON public.marketing_templates;
CREATE POLICY "Admins can insert templates" ON public.marketing_templates
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'sub_admin')
  )
);

DROP POLICY IF EXISTS "Admins can update templates" ON public.marketing_templates;
CREATE POLICY "Admins can update templates" ON public.marketing_templates
FOR UPDATE TO authenticated
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

NOTIFY pgrst, 'reload schema';
