-- ============================================================================
-- MIGRATION: Khởi tạo hệ thống thông báo trung tâm (Notification Center)
-- ============================================================================

-- 1. TẠO BẢNG NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text,
    type text NOT NULL, -- e.g., 'lead_assigned', 'task_reminder', 'customer_handoff'
    priority text NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Tham chiếu đến đối tượng liên quan (Polymorphic-like reference)
    entity_type text, -- 'lead', 'customer', 'task', 'order', 'campaign'
    entity_id uuid,
    
    -- Hành động khi click
    action_url text,
    
    -- Trạng thái
    read_at timestamptz,
    dismissed_at timestamptz,
    
    -- Audit
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TẠO HỆ THỐNG CHỈ MỤC (INDEXES) TỐI ƯU TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at) WHERE (read_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);

-- 3. THIẾT LẬP RLS (ROW LEVEL SECURITY)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Chính sách: Người nhận chỉ xem được thông báo của mình
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
TO authenticated 
USING (recipient_user_id = auth.uid());

-- Chính sách: Người nhận có thể cập nhật trạng thái (read/dismiss) thông báo của mình
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
TO authenticated 
USING (recipient_user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid());

-- Chính sách: Admin/Sub Admin có quyền xem tất cả để hỗ trợ xử lý sự cố
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications" 
ON public.notifications 
FOR SELECT 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Kích hoạt Realtime cho bảng notifications (Chuẩn bị cho bước sau)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Làm mới PostgREST cache
NOTIFY pgrst, 'reload schema';
