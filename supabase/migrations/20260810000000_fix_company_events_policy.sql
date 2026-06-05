-- Migration: Restore missing RLS policy for company_events
-- Fixes company_events RLS "Permission denied" error for admin/subadmin roles on Staging

DROP POLICY IF EXISTS "Management manage company events" ON public.company_events;

CREATE POLICY "Management manage company events"
ON public.company_events FOR ALL TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
