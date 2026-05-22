-- ============================================================================
-- MIGRATION: Restore customers INSERT/UPDATE/DELETE policies
-- ============================================================================

-- Restore Admin ALL policy
DROP POLICY IF EXISTS "Admins manage all customers" ON public.customers;
CREATE POLICY "Admins manage all customers" 
ON public.customers
FOR ALL TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Restore Sale ALL policy
DROP POLICY IF EXISTS "Sales manage owned customers" ON public.customers;
CREATE POLICY "Sales manage owned customers" 
ON public.customers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'sale') AND owner_sale_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'sale') AND owner_sale_id = auth.uid());

-- Restore Tele Lead ALL policy
DROP POLICY IF EXISTS "Tele leads manage owned customers" ON public.customers;
CREATE POLICY "Tele leads manage owned customers" 
ON public.customers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'tele_lead') AND owner_tele_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'tele_lead') AND owner_tele_id = auth.uid());

-- Reload postgrest schema
NOTIFY pgrst, 'reload schema';
