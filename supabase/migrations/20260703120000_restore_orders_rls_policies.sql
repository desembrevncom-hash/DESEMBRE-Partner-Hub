-- Migration: Khôi phục RLS policy cho bảng orders
-- Timestamp: 20260703120000
-- Khôi phục lại các policy SELECT, INSERT, UPDATE đã bị mất regression.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Cấp quyền cơ bản cho authenticated để RLS có thể hoạt động
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
-- Orders policy phụ thuộc vào bảng customers, nên cần grant select
GRANT SELECT ON public.customers TO authenticated;

-- Phục hồi SELECT policy
DROP POLICY IF EXISTS "Orders select access" ON public.orders;
CREATE POLICY "Orders select access"
ON public.orders FOR SELECT TO authenticated
USING (
    public.is_admin_or_sub_admin(auth.uid())
    OR sale_user_id = auth.uid()
    OR public.is_tele_lead(auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.customers c 
        WHERE c.id = public.orders.customer_id 
        AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
    )
);

-- Phục hồi INSERT policy
DROP POLICY IF EXISTS "Orders insert access" ON public.orders;
CREATE POLICY "Orders insert access"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (
    public.is_admin_or_sub_admin(auth.uid())
    OR public.has_role(auth.uid(), 'sale')
);

-- Phục hồi UPDATE policy
DROP POLICY IF EXISTS "Orders update access" ON public.orders;
CREATE POLICY "Orders update access"
ON public.orders FOR UPDATE TO authenticated
USING (
    public.is_admin_or_sub_admin(auth.uid())
    OR sale_user_id = auth.uid()
)
WITH CHECK (
    public.is_admin_or_sub_admin(auth.uid())
    OR sale_user_id = auth.uid()
);
