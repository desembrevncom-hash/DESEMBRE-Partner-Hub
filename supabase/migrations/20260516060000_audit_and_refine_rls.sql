-- ============================================================================
-- MIGRATION: Kiểm tra và Tối ưu RLS liên bảng (Phase 7 Audit & Refinement)
-- Mục tiêu: Đảm bảo quyền truy cập chéo giữa Sale và Tele Lead đồng bộ.
-- ============================================================================

-- 1. BẢNG ORDERS (ĐƠN HÀNG)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sale view own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;
CREATE POLICY "Orders select access"
ON public.orders FOR SELECT TO authenticated
USING (
    public.is_admin_or_sub_admin(auth.uid())
    OR sale_user_id = auth.uid()
    OR public.is_tele_lead(auth.uid()) -- Tele Lead giám sát đơn để biết hiệu quả Lead
    OR EXISTS (
        SELECT 1 FROM public.customers c 
        WHERE c.id = public.orders.customer_id 
        AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Sale create orders" ON public.orders;
CREATE POLICY "Orders insert access"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (
    public.is_admin_or_sub_admin(auth.uid())
    OR public.has_role(auth.uid(), 'sale')
);

DROP POLICY IF EXISTS "Sale update own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Orders update access"
ON public.orders FOR UPDATE TO authenticated
USING (
    public.is_admin_or_sub_admin(auth.uid())
    OR sale_user_id = auth.uid()
);

-- 2. BẢNG CALENDAR_EVENTS (LỊCH CÁ NHÂN/FOLLOW-UP)
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view allowed calendar events" ON public.calendar_events;
CREATE POLICY "Calendar events select access"
ON public.calendar_events FOR SELECT TO authenticated
USING (
    public.is_admin_or_sub_admin(auth.uid())
    OR assigned_sale_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_tele_lead(auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.customers c 
        WHERE c.id = public.calendar_events.customer_id 
        AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Users insert calendar events" ON public.calendar_events;
CREATE POLICY "Calendar events insert access"
ON public.calendar_events FOR INSERT TO authenticated
WITH CHECK (
    public.is_admin_or_sub_admin(auth.uid())
    OR public.has_role(auth.uid(), 'sale')
    OR public.has_role(auth.uid(), 'tele_lead')
    OR public.has_role(auth.uid(), 'telesale')
);

-- 3. BẢNG COMPANY_EVENTS (SỰ KIỆN CÔNG TY)
ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage company events" ON public.company_events;
DROP POLICY IF EXISTS "Sales view active company events" ON public.company_events;
CREATE POLICY "Company events view all"
ON public.company_events FOR SELECT TO authenticated
USING (true); -- Mọi nhân sự đều được xem sự kiện công ty

CREATE POLICY "Management manage company events"
ON public.company_events FOR ALL TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- 4. BẢNG EVENT_REGISTRATIONS (ĐĂNG KÝ SỰ KIỆN)
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all event registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Sales view own event registrations" ON public.event_registrations;
CREATE POLICY "Event registrations select access"
ON public.event_registrations FOR SELECT TO authenticated
USING (
    public.is_admin_or_sub_admin(auth.uid())
    OR registered_by = auth.uid()
    OR assigned_sale_id = auth.uid()
    OR public.is_tele_lead(auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.customers c 
        WHERE c.id = public.event_registrations.customer_id 
        AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
    )
);

-- 5. LÀM MỚI SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
