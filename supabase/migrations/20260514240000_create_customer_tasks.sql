-- ============================================================================
-- MIGRATION: Khởi tạo bảng Customer Tasks phục vụ phân phối công việc Sale/Tele
-- ============================================================================

-- 1. TẠO BẢNG CUSTOMER_TASKS
CREATE TABLE IF NOT EXISTS public.customer_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    owner_tele_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    task_type text NOT NULL DEFAULT 'call',
    title text NOT NULL,
    note text,
    priority text NOT NULL DEFAULT 'normal',
    status text NOT NULL DEFAULT 'pending',
    due_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    result text,
    next_action text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TẠO CHỈ MỤC TỐI ƯU HÓA HIỆU NĂNG
CREATE INDEX IF NOT EXISTS idx_customer_tasks_assigned_to ON public.customer_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_assigned_by ON public.customer_tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_owner_tele_id ON public.customer_tasks(owner_tele_id);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_status ON public.customer_tasks(status);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_due_at ON public.customer_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_customer_id ON public.customer_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_lead_id ON public.customer_tasks(lead_id);

-- 3. BẬT ROW LEVEL SECURITY (RLS) VÀ THIẾT LẬP CHÍNH SÁCH
ALTER TABLE public.customer_tasks ENABLE ROW LEVEL SECURITY;

-- Chính sách cho Admin/Sub Admin: Quản lý tất cả
CREATE POLICY "Admins manage all customer tasks" ON public.customer_tasks
    FOR ALL TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Chính sách cho User: Xem task assigned_to = auth.uid()
CREATE POLICY "Users view assigned tasks" ON public.customer_tasks
    FOR SELECT TO authenticated
    USING (assigned_to = auth.uid());

-- Chính sách cho Tele Lead: Xem task owner_tele_id = auth.uid()
CREATE POLICY "Tele leads view owned tasks" ON public.customer_tasks
    FOR SELECT TO authenticated
    USING (
        public.has_role(auth.uid(), 'tele_lead') 
        AND owner_tele_id = auth.uid()
    );

-- Chính sách cho User: Update task assigned_to = auth.uid()
CREATE POLICY "Users update assigned tasks" ON public.customer_tasks
    FOR UPDATE TO authenticated
    USING (assigned_to = auth.uid())
    WITH CHECK (assigned_to = auth.uid());

-- Cho phép người dùng được gán việc tạo mới hoặc tác vụ phân công tự do
CREATE POLICY "Staff insert customer tasks" ON public.customer_tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        assigned_to = auth.uid() 
        OR assigned_by = auth.uid()
        OR (public.has_role(auth.uid(), 'tele_lead') AND owner_tele_id = auth.uid())
    );

-- 4. TÍCH HỢP TRIGGER TỰ ĐỘNG CẬP NHẬT UPDATED_AT NẾU CHƯA CÓ
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'customer_tasks_touch_updated_at'
    ) THEN
        CREATE TRIGGER customer_tasks_touch_updated_at
            BEFORE UPDATE ON public.customer_tasks
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END
$$;

-- 5. KÍCH HOẠT TẢI LẠI SCHEMA CHO POSTGREST
NOTIFY pgrst, 'reload schema';
