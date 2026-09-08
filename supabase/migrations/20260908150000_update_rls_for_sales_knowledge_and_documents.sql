-- Migration: Update RLS policies for product_knowledge, product_sales_sheets, and product_source_documents
-- Ensures:
-- 1. Staff/Sales can view approved, active product knowledge in read-only mode.
-- 2. Staff/Sales can view approved product sales sheets.
-- 3. Raw guidebook files and raw text remain internal-only, safe from unauthorized leakage.
-- 4. Public catalog can only view approved + is_public knowledge and sales sheets.

-- ============================================================================
-- 1. Policies for public.product_knowledge
-- ============================================================================

-- Admin & Sub Admin have full management rights
DROP POLICY IF EXISTS "Admin and Sub Admin can manage product knowledge" ON public.product_knowledge;
CREATE POLICY "Admin and Sub Admin can manage product knowledge"
ON public.product_knowledge
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Staff / Sales can view approved active product knowledge
DROP POLICY IF EXISTS "Sales staff can view active product knowledge" ON public.product_knowledge;
CREATE POLICY "Sales staff can view active product knowledge"
ON public.product_knowledge
FOR SELECT
TO authenticated
USING (
    (is_active = true AND qa_status = 'approved')
    OR public.is_admin_or_sub_admin(auth.uid())
);

-- Public / Anonymous can ONLY view approved, active, and public-toggled knowledge
DROP POLICY IF EXISTS "Public can view approved public product knowledge" ON public.product_knowledge;
CREATE POLICY "Public can view approved public product knowledge"
ON public.product_knowledge
FOR SELECT
TO anon, authenticated
USING (
    is_public = true 
    AND qa_status = 'approved' 
    AND is_active = true
);

-- ============================================================================
-- 2. Policies for public.product_sales_sheets
-- ============================================================================

-- Admins / Sub-admins can do everything
DROP POLICY IF EXISTS "Admins can do everything on product_sales_sheets" ON public.product_sales_sheets;
CREATE POLICY "Admins can do everything on product_sales_sheets"
ON public.product_sales_sheets
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Staff / Sales can read approved sales sheets
DROP POLICY IF EXISTS "Sales can read approved product_sales_sheets" ON public.product_sales_sheets;
CREATE POLICY "Sales can read approved product_sales_sheets"
ON public.product_sales_sheets
FOR SELECT
TO authenticated
USING (
    status = 'approved'
    OR public.is_admin_or_sub_admin(auth.uid())
);

-- Public / Anonymous can ONLY view approved and public-toggled sales sheets
DROP POLICY IF EXISTS "Public can view public approved sales sheets" ON public.product_sales_sheets;
CREATE POLICY "Public can view public approved sales sheets"
ON public.product_sales_sheets
FOR SELECT
TO anon, authenticated
USING (
    is_public = true 
    AND status = 'approved'
);

-- ============================================================================
-- 3. Policies for public.product_source_documents
-- ============================================================================

-- Admins / Sub-admins manage source documents
DROP POLICY IF EXISTS "Admins insert product source documents" ON public.product_source_documents;
CREATE POLICY "Admins insert product source documents"
ON public.product_source_documents
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update product source documents" ON public.product_source_documents;
CREATE POLICY "Admins update product source documents"
ON public.product_source_documents
FOR UPDATE
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete product source documents" ON public.product_source_documents;
CREATE POLICY "Admins delete product source documents"
ON public.product_source_documents
FOR DELETE
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Authenticated internal staff can view metadata for status indicators, but NEVER public/anon
DROP POLICY IF EXISTS "Authenticated users view product source documents" ON public.product_source_documents;
CREATE POLICY "Authenticated users view product source documents"
ON public.product_source_documents
FOR SELECT
TO authenticated
USING (true);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
