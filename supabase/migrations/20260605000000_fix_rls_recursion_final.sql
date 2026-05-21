-- ============================================================================
-- MIGRATION: Break RLS circular dependency between customers and customer_tasks
-- ============================================================================

-- 1. Redefine user_has_customer_task with explicit search_path for safety
CREATE OR REPLACE FUNCTION public.user_has_customer_task(c_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_tasks 
    WHERE customer_id = c_id AND assigned_to = u_id
  );
$$;

-- 2. Define user_owns_customer_of_task to break the reverse dependency
CREATE OR REPLACE FUNCTION public.user_owns_customer_of_task(task_customer_id uuid, u_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = task_customer_id AND owner_sale_id = u_id
  );
$$;

-- 3. Drop all old/redundant policies on customers that might execute direct subqueries
DROP POLICY IF EXISTS "Admins manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Sales manage owned customers" ON public.customers;
DROP POLICY IF EXISTS "Tele leads manage owned customers" ON public.customers;
DROP POLICY IF EXISTS "Telesales view assigned customers" ON public.customers;

-- 4. Recreate the clean "Users view customers" policy using the helper function
DROP POLICY IF EXISTS "Users view customers" ON public.customers;
CREATE POLICY "Users view customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_sub_admin(auth.uid()) 
  OR public.is_tele_lead(auth.uid())
  OR owner_sale_id = auth.uid()
  OR owner_tele_id = auth.uid()
  OR user_id = auth.uid()
  OR public.user_has_customer_task(id, auth.uid())
);

-- 5. Recreate the "Users view tasks" policy using the helper function
DROP POLICY IF EXISTS "Users view tasks" ON public.customer_tasks;
CREATE POLICY "Users view tasks" 
ON public.customer_tasks 
FOR SELECT 
TO authenticated 
USING (
  assigned_to = auth.uid() 
  OR owner_tele_id = auth.uid()
  OR public.user_owns_customer_of_task(customer_id, auth.uid())
);

-- 6. Reload postgrest schema
NOTIFY pgrst, 'reload schema';
