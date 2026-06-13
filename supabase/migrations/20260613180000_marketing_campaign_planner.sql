CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    objective text,
    segment_id uuid not null references public.marketing_segments(id),
    segment_name_snapshot text not null,
    segment_rules_snapshot_json jsonb not null,
    intended_channel text not null,
    message_content text,
    notes text,
    status text not null default 'draft',
    audience_snapshot_count integer not null default 0,
    created_by uuid not null references auth.users(id),
    updated_by uuid references auth.users(id),
    archived_at timestamptz,
    archived_by uuid references auth.users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Constraints
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_name_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_name_check CHECK (char_length(name) > 0);

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_status_check CHECK (status IN ('draft', 'ready_for_export', 'archived'));

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_channel_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_channel_check CHECK (intended_channel IN ('call', 'zalo_manual', 'email_manual', 'facebook_manual', 'export_only'));

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_rules_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_rules_check CHECK (jsonb_typeof(segment_rules_snapshot_json) = 'object');

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_count_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_count_check CHECK (audience_snapshot_count >= 0);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_by ON public.marketing_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_segment_id ON public.marketing_campaigns(segment_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_archived_at ON public.marketing_campaigns(archived_at);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_at ON public.marketing_campaigns(created_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_marketing_campaigns_updated_at ON public.marketing_campaigns;
CREATE TRIGGER set_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Revoke everything
REVOKE ALL PRIVILEGES ON TABLE public.marketing_campaigns FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.marketing_campaigns FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.marketing_campaigns FROM authenticated;

-- Grant base authenticated permissions (No DELETE/TRUNCATE/REFERENCES/TRIGGER)
GRANT SELECT, INSERT, UPDATE ON TABLE public.marketing_campaigns TO authenticated;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Admins can insert campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Admins can update campaigns" ON public.marketing_campaigns;

-- Create Policies (Admin/Sub-admin only)
CREATE POLICY "Admins can view campaigns" 
  ON public.marketing_campaigns FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE public.user_roles.user_id = auth.uid() 
      AND public.user_roles.role IN ('admin', 'sub_admin')
    )
  );

CREATE POLICY "Admins can insert campaigns" 
  ON public.marketing_campaigns FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE public.user_roles.user_id = auth.uid() 
      AND public.user_roles.role IN ('admin', 'sub_admin')
    )
  );

CREATE POLICY "Admins can update campaigns" 
  ON public.marketing_campaigns FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE public.user_roles.user_id = auth.uid() 
      AND public.user_roles.role IN ('admin', 'sub_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE public.user_roles.user_id = auth.uid() 
      AND public.user_roles.role IN ('admin', 'sub_admin')
    )
  );

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
