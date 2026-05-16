
-- ============================================================================
-- MIGRATION: Customer Axis Alignment (Chuẩn hoá trục dữ liệu Khách hàng)
-- Mục tiêu: Đảm bảo mọi vệ tinh (Task, Order, Event, Notify) đều nối về Customer
-- ============================================================================

-- 1. Bổ sung cột customer_id vào notifications để truy vết trực tiếp
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE;

-- 2. Tối ưu hóa hiệu năng truy vấn cho Customer 360 Dashboard (Indexes)
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON public.notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_customer_id ON public.customer_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer_id ON public.calendar_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_customer_id ON public.event_registrations(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_activities_customer_id ON public.customer_activities(customer_id);

-- 3. Chuẩn hoá tính toàn vẹn dữ liệu (Foreign Keys with Cascade)
-- Orders
ALTER TABLE public.orders 
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey,
  ADD CONSTRAINT orders_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- Customer Tasks
ALTER TABLE public.customer_tasks
  DROP CONSTRAINT IF EXISTS customer_tasks_customer_id_fkey,
  ADD CONSTRAINT customer_tasks_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- 4. Làm mới PostgREST cache
NOTIFY pgrst, 'reload schema';
