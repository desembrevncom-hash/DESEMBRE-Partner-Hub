-- 1. Drop existing policies on product_sales_sheets
DROP POLICY IF EXISTS "Admins can do everything on product_sales_sheets" ON public.product_sales_sheets;
DROP POLICY IF EXISTS "Sales can read approved product_sales_sheets" ON public.product_sales_sheets;

-- 2. Create updated policy for Admins / Sub-admins using helper function
CREATE POLICY "Admins can do everything on product_sales_sheets"
ON public.product_sales_sheets
FOR ALL
TO authenticated
USING ( public.is_admin_or_sub_admin(auth.uid()) )
WITH CHECK ( public.is_admin_or_sub_admin(auth.uid()) );

-- 3. Create updated policy for Sales / Telesales using helper function
CREATE POLICY "Sales can read approved product_sales_sheets"
ON public.product_sales_sheets
FOR SELECT
TO authenticated
USING (
  status = 'approved' AND 
  public.is_sales_member(auth.uid())
);

-- 4. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
