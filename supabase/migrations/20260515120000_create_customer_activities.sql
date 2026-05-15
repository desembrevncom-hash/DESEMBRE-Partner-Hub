-- ============================================================================
-- MIGRATION: Tạo bảng Customer Activities lưu lịch sử chăm sóc khách hàng
-- ============================================================================

-- 1. TẠO BẢNG CUSTOMER_ACTIVITIES
CREATE TABLE IF NOT EXISTS public.customer_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    event_registration_id uuid REFERENCES public.event_registrations(id) ON DELETE SET NULL,
    task_id uuid REFERENCES public.customer_tasks(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    activity_type text NOT NULL DEFAULT 'note',
    title text NOT NULL,
    content text,
    result text,
    next_follow_up_at timestamptz,
    location text,
    channel text,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ràng buộc kiểm tra các loại activity hợp lệ
    CONSTRAINT check_activity_type CHECK (
        activity_type IN (
            'note', 'call', 'zalo_message', 'direct_visit', 
            'showroom_meeting', 'online_consultation', 'quote_sent', 
            'order_created', 'event_registered', 'event_attended', 
            'check_in', 'follow_up', 'task_completed', 'handoff'
        )
    )
);

-- 2. TẠO HỆ THỐNG CHỈ MỤC (INDEXES) TỐI ƯU TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_activities_customer_id ON public.customer_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON public.customer_activities(created_by);
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.customer_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.customer_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_next_follow_up ON public.customer_activities(next_follow_up_at);

-- 3. THIẾT LẬP BẢO MẬT HÀNG (ROW LEVEL SECURITY - RLS)
ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admin và Sub-Admin có toàn quyền
DROP POLICY IF EXISTS "Admins manage all activities" ON public.customer_activities;
CREATE POLICY "Admins manage all activities" 
ON public.customer_activities 
FOR ALL 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Policy 2: Sale và Trưởng Tele xem activity của khách mình phụ trách
DROP POLICY IF EXISTS "Owners view activities" ON public.customer_activities;
CREATE POLICY "Owners view activities" 
ON public.customer_activities 
FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.customers c 
        WHERE c.id = customer_activities.customer_id 
        AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
    )
);

-- Policy 3: Telesale xem activity của khách được giao nhiệm vụ
DROP POLICY IF EXISTS "Assigned telesales view activities" ON public.customer_activities;
CREATE POLICY "Assigned telesales view activities" 
ON public.customer_activities 
FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.customer_tasks ct 
        WHERE ct.customer_id = customer_activities.customer_id 
        AND ct.assigned_to = auth.uid()
    )
);

-- Policy 4: Cho phép thêm activity nếu có quyền xem khách hàng (Insert)
DROP POLICY IF EXISTS "Users create activities for their customers" ON public.customer_activities;
CREATE POLICY "Users create activities for their customers" 
ON public.customer_activities 
FOR INSERT 
TO authenticated 
WITH CHECK (
    public.is_admin_or_sub_admin(auth.uid()) OR
    EXISTS (
        SELECT 1 FROM public.customers c 
        WHERE c.id = customer_id 
        AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
    ) OR
    EXISTS (
        SELECT 1 FROM public.customer_tasks ct 
        WHERE ct.customer_id = customer_id 
        AND ct.assigned_to = auth.uid()
    )
);

-- Kích hoạt tải lại schema cho PostgREST
NOTIFY pgrst, 'reload schema';
