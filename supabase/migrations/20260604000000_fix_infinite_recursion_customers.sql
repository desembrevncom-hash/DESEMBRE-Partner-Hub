-- ============================================================================
-- MIGRATION: Fix Infinite Recursion in Customers Policy
-- Bỏ lỗi "infinite recursion detected in policy for relation customers"
-- ============================================================================

-- 1. Create a SECURITY DEFINER function to check if a user is assigned to any task of a customer.
-- This bypasses RLS on customer_tasks and breaks the cyclic dependency between customers and customer_tasks.
CREATE OR REPLACE FUNCTION public.user_has_customer_task(c_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_tasks 
    WHERE customer_id = c_id AND assigned_to = u_id
  );
$$;

-- 2. Update the "Users view customers" policy to use the new function
DROP POLICY IF EXISTS "Users view customers" ON public.customers;
CREATE POLICY "Users view customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_sub_admin(auth.uid()) 
  OR public.is_tele_lead(auth.uid()) -- Tele Lead xem được tất cả Lead để điều phối
  OR owner_sale_id = auth.uid()
  OR owner_tele_id = auth.uid()
  OR user_id = auth.uid()
  OR public.user_has_customer_task(id, auth.uid())
);

-- Notify postgrest to reload schema cache
NOTIFY pgrst, 'reload schema';
