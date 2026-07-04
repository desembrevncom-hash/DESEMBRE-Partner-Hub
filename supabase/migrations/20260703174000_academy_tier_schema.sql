-- customer_tiers
CREATE TABLE public.customer_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  rank integer UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- customer_tier_memberships
-- Required extension for exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.customer_tier_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.customer_tiers(id) ON DELETE CASCADE,
  source text,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_membership_dates CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT exclude_overlapping_memberships EXCLUDE USING gist (
    customer_id WITH =,
    tstzrange(starts_at, COALESCE(ends_at, 'infinity'), '[)') WITH &&
  )
);
