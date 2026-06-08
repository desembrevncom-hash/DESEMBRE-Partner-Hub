-- ============================================================================
-- UNIFIED RLS POLICY PATCH FOR PRODUCT SALES SHEETS & DOCUMENT TEMPLATES
-- Run this on your Supabase Staging SQL Editor
-- ============================================================================

-- 1. Patch for public.product_sales_sheets
DROP POLICY IF EXISTS "Admins can do everything on product_sales_sheets" ON public.product_sales_sheets;
DROP POLICY IF EXISTS "Sales can read approved product_sales_sheets" ON public.product_sales_sheets;

CREATE POLICY "Admins can do everything on product_sales_sheets"
ON public.product_sales_sheets
FOR ALL
TO authenticated
USING ( public.is_admin_or_sub_admin(auth.uid()) )
WITH CHECK ( public.is_admin_or_sub_admin(auth.uid()) );

CREATE POLICY "Sales can read approved product_sales_sheets"
ON public.product_sales_sheets
FOR SELECT
TO authenticated
USING (
  status = 'approved' AND 
  public.is_sales_member(auth.uid())
);

-- 2. Patch for public.document_templates
DROP POLICY IF EXISTS "Admins can do everything on document_templates" ON public.document_templates;
DROP POLICY IF EXISTS "Sales can read approved document_templates" ON public.document_templates;

CREATE POLICY "Admins can do everything on document_templates"
ON public.document_templates
FOR ALL
TO authenticated
USING ( public.is_admin_or_sub_admin(auth.uid()) )
WITH CHECK ( public.is_admin_or_sub_admin(auth.uid()) );

CREATE POLICY "Sales can read approved document_templates"
ON public.document_templates
FOR SELECT
TO authenticated
USING (
  status = 'approved' AND 
  public.is_sales_member(auth.uid())
);

-- 3. Notify PostgREST to reload schemas
NOTIFY pgrst, 'reload schema';
