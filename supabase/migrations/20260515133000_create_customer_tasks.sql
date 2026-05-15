-- ============================================================================
-- MIGRATION: Khởi tạo hệ thống Task/Checklist Core cho CRM
-- ============================================================================

-- 1. TẠO BẢNG CUSTOMER_TASKS
CREATE TABLE IF NOT EXISTS public.customer_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    
    -- Phân quyền và phụ trách
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Người thực hiện
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Người giao việc
    owner_tele_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Trưởng Tele phụ trách pool
    
    -- Thông tin công việc
    task_type text NOT NULL DEFAULT 'call', -- 'call', 'visit', 'quotation', 'contract', 'follow_up', 'onboarding'
    title text NOT NULL,
    note text,
    priority text NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
    
    -- Thời gian và Kết quả
    due_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    result text,
    next_action text,
    
    -- Audit
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TẠO HỆ THỐNG CHỈ MỤC (INDEXES)
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.customer_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.customer_tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_tele_id ON public.customer_tasks(owner_tele_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.customer_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.customer_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_customer_id ON public.customer_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.customer_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON public.customer_tasks(task_type);

-- 3. THIẾT LẬP RLS (ROW LEVEL SECURITY)
ALTER TABLE public.customer_tasks ENABLE ROW LEVEL SECURITY;

-- Chính sách: Admin/Sub Admin quản lý tất cả
CREATE POLICY "Admins manage all tasks" 
ON public.customer_tasks 
FOR ALL 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Chính sách: Trưởng Tele xem được các Task trong Pool mình phụ trách
CREATE POLICY "Tele Leads view their pool tasks" 
ON public.customer_tasks 
FOR SELECT 
TO authenticated 
USING (owner_tele_id = auth.uid());

-- Chính sách: User xem được Task gán cho mình
CREATE POLICY "Users view assigned tasks" 
ON public.customer_tasks 
FOR SELECT 
TO authenticated 
USING (assigned_to = auth.uid());

-- Chính sách: User cập nhật trạng thái Task gán cho mình
CREATE POLICY "Users update assigned tasks" 
ON public.customer_tasks 
FOR UPDATE 
TO authenticated 
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tasks_updated_at
    BEFORE UPDATE ON public.customer_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Làm mới PostgREST cache
NOTIFY pgrst, 'reload schema';
