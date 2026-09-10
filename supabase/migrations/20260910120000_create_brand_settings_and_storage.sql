-- Migration: Create brand_settings table and branding-assets storage bucket
-- Supports dynamic logo and favicon updates from the admin UI

-- 1. Create brand_settings table
CREATE TABLE IF NOT EXISTS public.brand_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    site_name TEXT DEFAULT 'DESEMBRE HUB',
    header_logo_url TEXT,
    logo_mark_url TEXT,
    favicon_url TEXT,
    apple_touch_icon_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

-- Policies for brand_settings
DROP POLICY IF EXISTS "Public read brand settings" ON public.brand_settings;
CREATE POLICY "Public read brand settings"
    ON public.brand_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins insert brand settings" ON public.brand_settings;
CREATE POLICY "Admins insert brand settings"
    ON public.brand_settings FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update brand settings" ON public.brand_settings;
CREATE POLICY "Admins update brand settings"
    ON public.brand_settings FOR UPDATE TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete brand settings" ON public.brand_settings;
CREATE POLICY "Admins delete brand settings"
    ON public.brand_settings FOR DELETE TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()));

-- Insert default row if not exists
INSERT INTO public.brand_settings (id, site_name, header_logo_url, logo_mark_url, favicon_url, apple_touch_icon_url, updated_at)
VALUES (
    'default',
    'DESEMBRE HUB',
    '/branding/default-header-logo.svg',
    '/branding/default-logo-mark.svg',
    '/branding/favicon.svg',
    '/branding/apple-touch-icon.png',
    timezone('utc'::text, now())
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create public storage bucket: branding-assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'branding-assets',
    'branding-assets',
    true,
    5242880, -- 5MB
    ARRAY['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];

-- Storage RLS Policies
DROP POLICY IF EXISTS "Public can view branding assets" ON storage.objects;
CREATE POLICY "Public can view branding assets"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'branding-assets');

DROP POLICY IF EXISTS "Admins upload branding assets" ON storage.objects;
CREATE POLICY "Admins upload branding assets"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'branding-assets'
        AND public.is_admin_or_sub_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Admins update branding assets" ON storage.objects;
CREATE POLICY "Admins update branding assets"
    ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'branding-assets'
        AND public.is_admin_or_sub_admin(auth.uid())
    )
    WITH CHECK (
        bucket_id = 'branding-assets'
        AND public.is_admin_or_sub_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Admins delete branding assets" ON storage.objects;
CREATE POLICY "Admins delete branding assets"
    ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'branding-assets'
        AND public.is_admin_or_sub_admin(auth.uid())
    );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
