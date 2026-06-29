-- ============================================================================
-- M39.1 STAGING SQL MIGRATION - MARKETING PREFERENCE TABLES
-- TARGET: Staging (wmhfvggbthyikqvlyqup)
-- ============================================================================

-- 1. Create Current State Table (customer_marketing_preferences)
CREATE TABLE IF NOT EXISTS public.customer_marketing_preferences (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  email_opt_in BOOLEAN NOT NULL DEFAULT false,
  zalo_opt_in BOOLEAN NOT NULL DEFAULT false,
  global_opt_out BOOLEAN NOT NULL DEFAULT false,
  last_source TEXT CHECK (
    last_source IS NULL OR 
    last_source IN (
      'admin_panel', 'customer_preference_center', 'unsubscribe_link', 
      'webform', 'manual_import', 'verbal_request', 'paper_form', 
      'system', 'other'
    )
  ),
  last_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Append-Only Audit Table (customer_consent_events)
CREATE TABLE IF NOT EXISTS public.customer_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (
    action IN (
      'email_opt_in', 'email_opt_out', 'zalo_opt_in', 'zalo_opt_out', 
      'global_opt_out', 'global_opt_in', 'preference_update'
    )
  ),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'zalo', 'global')),
  source TEXT NOT NULL CHECK (
    source IN (
      'admin_panel', 'customer_preference_center', 'unsubscribe_link', 
      'webform', 'manual_import', 'verbal_request', 'paper_form', 
      'system', 'other'
    )
  ),
  old_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 3. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_customer_mktg_pref_customer ON public.customer_marketing_preferences(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_cons_events_customer_time ON public.customer_consent_events(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_cons_events_action ON public.customer_consent_events(action);
CREATE INDEX IF NOT EXISTS idx_customer_cons_events_channel ON public.customer_consent_events(channel);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.customer_marketing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_consent_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: customer_marketing_preferences
DROP POLICY IF EXISTS "Admins can select preferences" ON public.customer_marketing_preferences;
CREATE POLICY "Admins can select preferences" ON public.customer_marketing_preferences
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert preferences" ON public.customer_marketing_preferences;
CREATE POLICY "Admins can insert preferences" ON public.customer_marketing_preferences
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update preferences" ON public.customer_marketing_preferences;
CREATE POLICY "Admins can update preferences" ON public.customer_marketing_preferences
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
  );
-- INTENTIONALLY NO DELETE POLICY for customer_marketing_preferences

-- 6. RLS Policies: customer_consent_events
DROP POLICY IF EXISTS "Admins can select consent events" ON public.customer_consent_events;
CREATE POLICY "Admins can select consent events" ON public.customer_consent_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert consent events" ON public.customer_consent_events;
CREATE POLICY "Admins can insert consent events" ON public.customer_consent_events
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
  );
-- INTENTIONALLY NO UPDATE POLICY for customer_consent_events
-- INTENTIONALLY NO DELETE POLICY for customer_consent_events
