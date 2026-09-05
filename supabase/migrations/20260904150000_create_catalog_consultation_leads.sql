-- Migration: Create catalog_consultation_leads table for public catalog inquiries
-- Date: 2026-09-04

CREATE TABLE IF NOT EXISTS public.catalog_consultation_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    phone text NOT NULL,
    business_name text,
    message text,
    source text NOT NULL DEFAULT 'public_catalog',
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Performance & ordering indexes
CREATE INDEX IF NOT EXISTS idx_catalog_leads_created_at ON public.catalog_consultation_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_leads_phone ON public.catalog_consultation_leads(phone);
CREATE INDEX IF NOT EXISTS idx_catalog_leads_source ON public.catalog_consultation_leads(source);

-- Enable Row Level Security (RLS)
ALTER TABLE public.catalog_consultation_leads ENABLE ROW LEVEL SECURITY;

-- 1. Public / Anon INSERT ONLY: Anyone can submit a consultation request
-- Strictly limited to INSERT. Anonymous users have NO SELECT privilege (prevents reading customer data/PII).
DROP POLICY IF EXISTS "Public can insert catalog consultation leads" ON public.catalog_consultation_leads;
CREATE POLICY "Public can insert catalog consultation leads"
    ON public.catalog_consultation_leads
    FOR INSERT
    TO public
    WITH CHECK (
        length(trim(full_name)) > 0 AND
        length(trim(phone)) >= 9
    );

-- 2. Authenticated users (Staff / Admin) can READ leads
DROP POLICY IF EXISTS "Authenticated users can read catalog consultation leads" ON public.catalog_consultation_leads;
CREATE POLICY "Authenticated users can read catalog consultation leads"
    ON public.catalog_consultation_leads
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. Authenticated users (Staff / Admin) can UPDATE lead status
DROP POLICY IF EXISTS "Authenticated users can update catalog consultation leads" ON public.catalog_consultation_leads;
CREATE POLICY "Authenticated users can update catalog consultation leads"
    ON public.catalog_consultation_leads
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
