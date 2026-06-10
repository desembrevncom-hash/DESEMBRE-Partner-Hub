-- Migration: Phase v1.5.3B - Apify Background UID Resolver Integration
-- Adds tracking fields to jobs and an audit table for resolver results.

-- 1. Enums & Alter Jobs Table
ALTER TABLE public.facebook_identity_resolution_jobs
ADD COLUMN IF NOT EXISTS auto_resolve_status text DEFAULT 'not_attempted' CHECK (auto_resolve_status IN ('not_attempted', 'queued', 'resolving', 'resolved', 'failed', 'timeout', 'rate_limited', 'disabled', 'cached')),
ADD COLUMN IF NOT EXISTS auto_resolve_attempts int DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_auto_resolve_at timestamptz,
ADD COLUMN IF NOT EXISTS last_auto_resolve_error text,
ADD COLUMN IF NOT EXISTS auto_resolve_provider text,
ADD COLUMN IF NOT EXISTS social_profile_id uuid REFERENCES public.customer_social_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fb_jobs_auto_resolve_status ON public.facebook_identity_resolution_jobs (auto_resolve_status);

-- 2. Create Audit Table
CREATE TABLE IF NOT EXISTS public.facebook_uid_resolver_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid REFERENCES public.facebook_identity_resolution_jobs(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    social_profile_id uuid REFERENCES public.customer_social_profiles(id) ON DELETE SET NULL,
    
    raw_url text,
    normalized_url text,
    facebook_username text,
    returned_uid text,
    returned_name text,
    
    provider text NOT NULL DEFAULT 'apify',
    provider_status text CHECK (provider_status IN ('resolved', 'not_found', 'failed', 'timeout', 'rate_limited', 'disabled', 'cached')),
    provider_run_id text,
    
    latency_ms int,
    confidence_score int,
    error_message text,
    response_json jsonb DEFAULT '{}'::jsonb,
    
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Indexes for Audit Table
CREATE INDEX IF NOT EXISTS idx_fb_uid_results_normalized_url ON public.facebook_uid_resolver_results (normalized_url);
CREATE INDEX IF NOT EXISTS idx_fb_uid_results_returned_uid ON public.facebook_uid_resolver_results (returned_uid);
CREATE INDEX IF NOT EXISTS idx_fb_uid_results_status ON public.facebook_uid_resolver_results (provider_status);
CREATE INDEX IF NOT EXISTS idx_fb_uid_results_created_at ON public.facebook_uid_resolver_results (created_at);

-- 3. RLS for facebook_uid_resolver_results
ALTER TABLE public.facebook_uid_resolver_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on facebook_uid_resolver_results" ON public.facebook_uid_resolver_results
FOR ALL USING (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Sale view own facebook_uid_resolver_results" ON public.facebook_uid_resolver_results
FOR SELECT USING (
    customer_id IN (SELECT id FROM public.customers WHERE owner_sale_id = auth.uid() OR owner_tele_id = auth.uid() OR created_by = auth.uid())
);

-- Service Role (Edge Function) needs to insert into this table. No specific insert policy needed if using service_role key, 
-- but we can add one for safety if the function uses user's auth token. However, edge function uses service_role for inserts.
