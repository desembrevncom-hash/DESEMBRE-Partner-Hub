-- Migration: Cập nhật Row Level Security (RLS) cho phép PHÓ ADMIN (sub_admin) vận hành toàn diện CRM
-- Các bảng áp dụng: customers, calendar_events, orders, company_events, event_registrations, profiles

-- 1. Bảng customers: Cho phép Phó Admin Đọc, Thêm, Sửa, Xóa tương tự Admin
DROP POLICY IF EXISTS "Users view customers" ON public.customers;
CREATE POLICY "Users view customers" ON public.customers FOR SELECT TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()) OR user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users insert customers" ON public.customers;
CREATE POLICY "Users insert customers" ON public.customers FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()) OR user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users update customers" ON public.customers;
CREATE POLICY "Users update customers" ON public.customers FOR UPDATE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()) OR user_id = auth.uid())
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete customers" ON public.customers;
CREATE POLICY "Users delete customers" ON public.customers FOR DELETE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()) OR user_id = auth.uid());

-- 2. Bảng calendar_events: Cho phép Phó Admin vận hành lịch hẹn
DROP POLICY IF EXISTS "Users view allowed calendar events" ON public.calendar_events;
CREATE POLICY "Users view allowed calendar events" ON public.calendar_events FOR SELECT TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()) OR assigned_sale_id = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users insert calendar events" ON public.calendar_events;
CREATE POLICY "Users insert calendar events" ON public.calendar_events FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()) OR public.has_role(auth.uid(), 'sale') OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users update allowed calendar events" ON public.calendar_events;
CREATE POLICY "Users update allowed calendar events" ON public.calendar_events FOR UPDATE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()) OR assigned_sale_id = auth.uid() OR created_by = auth.uid())
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()) OR assigned_sale_id = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "Admins delete calendar events" ON public.calendar_events;
CREATE POLICY "Admins delete calendar events" ON public.calendar_events FOR DELETE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- 3. Bảng orders: Cho phép Phó Admin xem, sửa và quản lý đơn hàng
DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;
CREATE POLICY "Admins view all orders" ON public.orders FOR SELECT TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- 4. Bảng company_events & event_registrations (Enterprise Lịch): Cho phép Phó Admin vận hành
DROP POLICY IF EXISTS "Admins manage company events" ON public.company_events;
CREATE POLICY "Admins manage company events" ON public.company_events FOR ALL TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage all event registrations" ON public.event_registrations;
CREATE POLICY "Admins manage all event registrations" ON public.event_registrations FOR ALL TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- 5. Bảng profiles: Cho phép Phó Admin xem và nạp danh sách nhân sự
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- 6. Thông báo nạp lại lược đồ PostgREST
NOTIFY pgrst, 'reload schema';
