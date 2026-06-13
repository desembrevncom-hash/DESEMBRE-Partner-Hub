-- ============================================================================
-- MIGRATION: Marketing Audience Builder & Saved Segments v1
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

-- Safely add constraints
DO $$ 
BEGIN
    ALTER TABLE public.marketing_segments DROP CONSTRAINT IF EXISTS marketing_segments_visibility_check;
    ALTER TABLE public.marketing_segments ADD CONSTRAINT marketing_segments_visibility_check CHECK (visibility IN ('private', 'public_to_org'));

    ALTER TABLE public.marketing_segments DROP CONSTRAINT IF EXISTS marketing_segments_name_check;
    ALTER TABLE public.marketing_segments ADD CONSTRAINT marketing_segments_name_check CHECK (char_length(name) > 0);

    ALTER TABLE public.marketing_segments DROP CONSTRAINT IF EXISTS marketing_segments_jsonb_check;
    ALTER TABLE public.marketing_segments ADD CONSTRAINT marketing_segments_jsonb_check CHECK (jsonb_typeof(filter_rules_json) = 'object');
EXCEPTION
    WHEN others THEN null;
END $$;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_marketing_segments_created_by ON public.marketing_segments(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_visibility ON public.marketing_segments(visibility);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_archived_at ON public.marketing_segments(archived_at);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_created_at ON public.marketing_segments(created_at);

-- RLS
ALTER TABLE public.marketing_segments ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to ensure idempotency
DROP POLICY IF EXISTS "Admins can view all segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Admins can manage all segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users can view public segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users can view own private segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users can create private segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users can update own segments" ON public.marketing_segments;
DROP POLICY IF EXISTS "Users cannot delete segments" ON public.marketing_segments;

-- Policy 1 & 2: Admins manage all (except DELETE)
CREATE POLICY "Admins can view all segments" ON public.marketing_segments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

CREATE POLICY "Admins can manage all segments" ON public.marketing_segments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')));

-- Policy 3 & 4: Normal users read public or own
CREATE POLICY "Users can view public segments" ON public.marketing_segments FOR SELECT TO authenticated
USING (visibility = 'public_to_org');

CREATE POLICY "Users can view own private segments" ON public.marketing_segments FOR SELECT TO authenticated
USING (created_by = auth.uid());

-- Policy 5: Normal users insert own private segments
CREATE POLICY "Users can create private segments" ON public.marketing_segments FOR INSERT TO authenticated
WITH CHECK (
    created_by = auth.uid() 
    AND visibility = 'private'
);

-- Policy 6: Normal users update/archive own segments
CREATE POLICY "Users can update own segments" ON public.marketing_segments FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Policy 7: NO HARD DELETES (Applies to EVERYONE including admins)
CREATE POLICY "Users cannot delete segments" ON public.marketing_segments FOR DELETE TO authenticated
USING (false);

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
