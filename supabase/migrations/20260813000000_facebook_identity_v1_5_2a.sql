-- Migration: Phase v1.5.2A - Facebook Identity Foundation
-- Creates tables and RLS for customer_social_profiles, facebook_identity_events, facebook_identity_resolution_jobs

-- 1. Enums
CREATE TYPE public.social_platform AS ENUM ('facebook', 'zalo', 'tiktok', 'instagram', 'other');
CREATE TYPE public.resolver_status AS ENUM ('parsed_only', 'resolved', 'duplicate_candidate', 'unresolved', 'failed', 'manual_review');
CREATE TYPE public.fb_identity_event_type AS ENUM ('messenger_webhook', 'lead_ad_webhook', 'manual_entry', 'resolver_api');
CREATE TYPE public.fb_identity_processing_status AS ENUM ('unlinked', 'matched', 'ignored', 'lead_created', 'failed');
CREATE TYPE public.fb_resolution_job_status AS ENUM ('pending', 'resolved', 'failed', 'manual_review_required');

-- 2. customer_social_profiles
CREATE TABLE IF NOT EXISTS public.customer_social_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    platform public.social_platform NOT NULL DEFAULT 'facebook',
    
    facebook_page_id text,
    facebook_psid text,
    facebook_uid text,
    facebook_leadgen_id text,
    facebook_app_scoped_user_id text,
    facebook_username text,
    
    raw_url text,
    normalized_url text,
    
    resolver_status public.resolver_status NOT NULL DEFAULT 'parsed_only',
    resolver_method text,
    confidence_score numeric(5,2),
    
    metadata jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for customer_social_profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_profiles_page_psid ON public.customer_social_profiles (facebook_page_id, facebook_psid) WHERE facebook_psid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_profiles_leadgen_id ON public.customer_social_profiles (facebook_leadgen_id) WHERE facebook_leadgen_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_profiles_uid ON public.customer_social_profiles (facebook_uid) WHERE facebook_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_profiles_username ON public.customer_social_profiles (facebook_username);
CREATE INDEX IF NOT EXISTS idx_social_profiles_normalized_url ON public.customer_social_profiles (normalized_url);
CREATE INDEX IF NOT EXISTS idx_social_profiles_customer_id ON public.customer_social_profiles (customer_id);

-- RLS for customer_social_profiles
ALTER TABLE public.customer_social_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on customer_social_profiles" ON public.customer_social_profiles
FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'sub_admin'));

CREATE POLICY "Sale view own customer social profiles" ON public.customer_social_profiles
FOR SELECT USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

CREATE POLICY "Sale insert own customer social profiles" ON public.customer_social_profiles
FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

CREATE POLICY "Sale update own customer social profiles" ON public.customer_social_profiles
FOR UPDATE USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);


-- 3. facebook_identity_events
CREATE TABLE IF NOT EXISTS public.facebook_identity_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type public.fb_identity_event_type NOT NULL,
    
    facebook_page_id text,
    facebook_psid text,
    facebook_leadgen_id text,
    facebook_uid text,
    facebook_username text,
    
    display_name text,
    phone text,
    email text,
    
    matched_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    processing_status public.fb_identity_processing_status NOT NULL DEFAULT 'unlinked',
    
    source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_events_status ON public.facebook_identity_events (processing_status);
CREATE INDEX IF NOT EXISTS idx_fb_events_psid ON public.facebook_identity_events (facebook_page_id, facebook_psid);

-- RLS for facebook_identity_events
ALTER TABLE public.facebook_identity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on facebook_identity_events" ON public.facebook_identity_events
FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'sub_admin'));

CREATE POLICY "Sale view own facebook_identity_events" ON public.facebook_identity_events
FOR SELECT USING (
    matched_customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);


-- 4. facebook_identity_resolution_jobs
CREATE TABLE IF NOT EXISTS public.facebook_identity_resolution_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    raw_url text NOT NULL,
    
    status public.fb_resolution_job_status NOT NULL DEFAULT 'pending',
    
    provider_used text,
    resolver_method text,
    confidence_score numeric(5,2),
    result_json jsonb,
    error_message text,
    
    processed_at timestamptz,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_jobs_status ON public.facebook_identity_resolution_jobs (status);
CREATE INDEX IF NOT EXISTS idx_fb_jobs_customer_id ON public.facebook_identity_resolution_jobs (customer_id);

-- RLS for facebook_identity_resolution_jobs
ALTER TABLE public.facebook_identity_resolution_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs
FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'sub_admin'));

CREATE POLICY "Sale view own facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs
FOR SELECT USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

CREATE POLICY "Sale insert own facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs
FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

CREATE POLICY "Sale update own facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs
FOR UPDATE USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_social_profiles
BEFORE UPDATE ON public.customer_social_profiles
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_fb_jobs
BEFORE UPDATE ON public.facebook_identity_resolution_jobs
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
