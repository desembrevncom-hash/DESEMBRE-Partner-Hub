-- ============================================================================
-- MIGRATION: Marketing Audience Builder & Saved Segments v1 (Revised)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    filter_rules_json jsonb NOT NULL,
    visibility text NOT NULL DEFAULT 'private',
    version int NOT NULL DEFAULT 1,
    created_by uuid NOT NULL REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id),
    archived_at timestamptz,
    archived_by uuid REFERENCES auth.users(id),
    last_preview_count int,
    last_previewed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Safely add constraints (Idempotent)
ALTER TABLE public.marketing_segments DROP CONSTRAINT IF EXISTS marketing_segments_visibility_check;
ALTER TABLE public.marketing_segments ADD CONSTRAINT marketing_segments_visibility_check CHECK (visibility IN ('private', 'public_to_org'));

ALTER TABLE public.marketing_segments DROP CONSTRAINT IF EXISTS marketing_segments_name_check;
ALTER TABLE public.marketing_segments ADD CONSTRAINT marketing_segments_name_check CHECK (char_length(name) > 0);

ALTER TABLE public.marketing_segments DROP CONSTRAINT IF EXISTS marketing_segments_jsonb_check;
ALTER TABLE public.marketing_segments ADD CONSTRAINT marketing_segments_jsonb_check CHECK (jsonb_typeof(filter_rules_json) = 'object');

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_marketing_segments_created_by ON public.marketing_segments(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_visibility ON public.marketing_segments(visibility);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_archived_at ON public.marketing_segments(archived_at);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_created_at ON public.marketing_segments(created_at);

-- RLS
ALTER TABLE public.marketing_segments ENABLE ROW LEVEL SECURITY;

-- Explicit Table Privileges Reset
REVOKE ALL PRIVILEGES ON TABLE public.marketing_segments FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.marketing_segments FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.marketing_segments FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.marketing_segments TO authenticated;

-- Drop all existing policies to ensure idempotency
DROP POLICY IF EXISTS "Admins can view all segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Admins can manage all segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Admins can insert all segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Admins can update all segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users can view public segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users can view own private segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users can create private segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users can update own private segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users cannot delete segments" ON public.marketing_segments;

-- Admin: SELECT all
CREATE POLICY "Admins can view all segments" ON public.marketing_segments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

-- Admin: INSERT all
CREATE POLICY "Admins can insert all segments" ON public.marketing_segments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

-- Admin: UPDATE all
CREATE POLICY "Admins can update all segments" ON public.marketing_segments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

-- User: SELECT public
CREATE POLICY "Users can view public segments" ON public.marketing_segments FOR SELECT TO authenticated
USING (visibility = 'public_to_org');

-- User: SELECT own
CREATE POLICY "Users can view own private segments" ON public.marketing_segments FOR SELECT TO authenticated
USING (created_by = auth.uid());

-- User: INSERT private
CREATE POLICY "Users can create private segments" ON public.marketing_segments FOR INSERT TO authenticated
WITH CHECK (
    created_by = auth.uid() 
    AND visibility = 'private'
);

-- User: UPDATE private
CREATE POLICY "Users can update own private segments" ON public.marketing_segments FOR UPDATE TO authenticated
USING (
    created_by = auth.uid() 
    AND visibility = 'private'
)
WITH CHECK (
    created_by = auth.uid() 
    AND visibility = 'private'
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_marketing_segments_updated_at ON public.marketing_segments;
CREATE TRIGGER set_marketing_segments_updated_at
BEFORE UPDATE ON public.marketing_segments
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
