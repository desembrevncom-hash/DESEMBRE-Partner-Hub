-- Fix RLS Policies for Facebook Identity tables

-- 1. customer_social_profiles
DROP POLICY IF EXISTS "Admin full access on customer_social_profiles" ON public.customer_social_profiles;
DROP POLICY IF EXISTS "Sale view own customer social profiles" ON public.customer_social_profiles;
DROP POLICY IF EXISTS "Sale insert own customer social profiles" ON public.customer_social_profiles;
DROP POLICY IF EXISTS "Sale update own customer social profiles" ON public.customer_social_profiles;

CREATE POLICY "Admin full access on customer_social_profiles" ON public.customer_social_profiles
FOR ALL USING (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Sale view own customer social profiles" ON public.customer_social_profiles
FOR SELECT USING (
    customer_id IN (SELECT id FROM public.customers WHERE owner_sale_id = auth.uid() OR owner_tele_id = auth.uid() OR created_by = auth.uid())
);

CREATE POLICY "Sale insert own customer social profiles" ON public.customer_social_profiles
FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE owner_sale_id = auth.uid() OR owner_tele_id = auth.uid() OR created_by = auth.uid())
);

CREATE POLICY "Sale update own customer social profiles" ON public.customer_social_profiles
FOR UPDATE USING (
    customer_id IN (SELECT id FROM public.customers WHERE owner_sale_id = auth.uid() OR owner_tele_id = auth.uid() OR created_by = auth.uid())
);

-- 2. facebook_identity_events
DROP POLICY IF EXISTS "Admin full access on facebook_identity_events" ON public.facebook_identity_events;
DROP POLICY IF EXISTS "Sale view own facebook_identity_events" ON public.facebook_identity_events;

CREATE POLICY "Admin full access on facebook_identity_events" ON public.facebook_identity_events
FOR ALL USING (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Sale view own facebook_identity_events" ON public.facebook_identity_events
FOR SELECT USING (
    matched_customer_id IN (SELECT id FROM public.customers WHERE owner_sale_id = auth.uid() OR owner_tele_id = auth.uid() OR created_by = auth.uid())
);

-- 3. facebook_identity_resolution_jobs
DROP POLICY IF EXISTS "Admin full access on facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs;
DROP POLICY IF EXISTS "Sale view own facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs;
DROP POLICY IF EXISTS "Sale insert own facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs;
DROP POLICY IF EXISTS "Sale update own facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs;

CREATE POLICY "Admin full access on facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs
FOR ALL USING (public.is_admin_or_sub_admin(auth.uid()));

CREATE POLICY "Sale view own facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs
FOR SELECT USING (
    customer_id IN (SELECT id FROM public.customers WHERE owner_sale_id = auth.uid() OR owner_tele_id = auth.uid() OR created_by = auth.uid())
);

CREATE POLICY "Sale insert own facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs
FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE owner_sale_id = auth.uid() OR owner_tele_id = auth.uid() OR created_by = auth.uid())
);

CREATE POLICY "Sale update own facebook_identity_resolution_jobs" ON public.facebook_identity_resolution_jobs
FOR UPDATE USING (
    customer_id IN (SELECT id FROM public.customers WHERE owner_sale_id = auth.uid() OR owner_tele_id = auth.uid() OR created_by = auth.uid())
);
