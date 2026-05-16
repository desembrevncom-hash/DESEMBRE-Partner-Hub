-- ============================================================================
-- MIGRATION: Tối ưu hoá RLS (Phase 6) - Chuẩn hoá quyền truy cập theo Role
-- ============================================================================

-- 1. CẬP NHẬT HÀM KIỂM TRA QUYỀN (LOẠI BỎ HARD-CODED EMAIL)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role::text = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_sub_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
      AND role IN ('admin', 'sub_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tele_lead(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'tele_lead');
$$;

-- 2. TỐI ƯU HOÁ RLS CHO BẢNG CUSTOMERS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

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
  OR EXISTS (
    SELECT 1 FROM public.customer_tasks 
    WHERE customer_id = public.customers.id 
      AND assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users insert customers" ON public.customers;
CREATE POLICY "Users insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_sub_admin(auth.uid()) 
  OR public.has_role(auth.uid(), 'sale')
  OR public.has_role(auth.uid(), 'tele_lead')
);

DROP POLICY IF EXISTS "Users update customers" ON public.customers;
CREATE POLICY "Users update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  public.is_admin_or_sub_admin(auth.uid()) 
  OR owner_sale_id = auth.uid()
  OR owner_tele_id = auth.uid()
  OR user_id = auth.uid()
);

-- 3. TỐI ƯU HOÁ RLS CHO BẢNG CUSTOMER_TASKS
ALTER TABLE public.customer_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all tasks" ON public.customer_tasks;
CREATE POLICY "Admins manage all tasks" 
ON public.customer_tasks 
FOR ALL 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Tele Leads manage tasks" ON public.customer_tasks;
CREATE POLICY "Tele Leads manage tasks" 
ON public.customer_tasks 
FOR ALL 
TO authenticated 
USING (public.is_tele_lead(auth.uid()))
WITH CHECK (public.is_tele_lead(auth.uid()));

DROP POLICY IF EXISTS "Users view tasks" ON public.customer_tasks;
CREATE POLICY "Users view tasks" 
ON public.customer_tasks 
FOR SELECT 
TO authenticated 
USING (
  assigned_to = auth.uid() 
  OR owner_tele_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = public.customer_tasks.customer_id 
      AND owner_sale_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users update assigned tasks" ON public.customer_tasks;
CREATE POLICY "Users update assigned tasks" 
ON public.customer_tasks 
FOR UPDATE 
TO authenticated 
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

-- 4. TỐI ƯU HOÁ RLS CHO BẢNG CUSTOMER_ACTIVITIES
ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all activities" ON public.customer_activities;
CREATE POLICY "Admins manage all activities" 
ON public.customer_activities 
FOR ALL 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Tele Leads view all activities" ON public.customer_activities;
CREATE POLICY "Tele Leads view all activities" 
ON public.customer_activities 
FOR SELECT 
TO authenticated 
USING (public.is_tele_lead(auth.uid()));

DROP POLICY IF EXISTS "Users view relevant activities" ON public.customer_activities;
CREATE POLICY "Users view relevant activities" 
ON public.customer_activities 
FOR SELECT 
TO authenticated 
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.customers c 
        WHERE c.id = public.customer_activities.customer_id 
        AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
    )
    OR EXISTS (
        SELECT 1 FROM public.customer_tasks ct 
        WHERE ct.customer_id = public.customer_activities.customer_id 
        AND ct.assigned_to = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users create activities" ON public.customer_activities;
CREATE POLICY "Users create activities" 
ON public.customer_activities 
FOR INSERT 
TO authenticated 
WITH CHECK (
    public.is_admin_or_sub_admin(auth.uid()) 
    OR public.is_tele_lead(auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.customers c 
        WHERE c.id = customer_id 
        AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
    ) 
    OR EXISTS (
        SELECT 1 FROM public.customer_tasks ct 
        WHERE ct.customer_id = customer_id 
        AND ct.assigned_to = auth.uid()
    )
);

-- 5. LÀM MỚI SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
