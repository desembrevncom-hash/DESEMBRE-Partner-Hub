-- ============================================================================
-- MIGRATION: Phase P3 - Notification Center MVP
-- ============================================================================

-- 1. Xử lý đổi tên cột an toàn (idempotent)
DO $$ 
BEGIN
    -- Rename 'type' -> 'notification_type'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='notification_type') THEN
        ALTER TABLE public.notifications RENAME COLUMN type TO notification_type;
    END IF;

    -- Rename 'entity_type' -> 'related_type'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='entity_type') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='related_type') THEN
        ALTER TABLE public.notifications RENAME COLUMN entity_type TO related_type;
    END IF;

    -- Rename 'entity_id' -> 'related_id'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='entity_id') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='related_id') THEN
        ALTER TABLE public.notifications RENAME COLUMN entity_id TO related_id;
    END IF;

    -- Rename 'action_url' -> 'deep_link'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='action_url') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='deep_link') THEN
        ALTER TABLE public.notifications RENAME COLUMN action_url TO deep_link;
    END IF;

    -- Rename 'created_by' -> 'actor_user_id'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='created_by') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='actor_user_id') THEN
        ALTER TABLE public.notifications RENAME COLUMN created_by TO actor_user_id;
    END IF;
END $$;

-- 2. Thêm các cột mới (idempotent)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS status text DEFAULT 'unread';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL; -- Just in case rename failed or it didn't exist

-- Chuẩn hoá dữ liệu status cũ dựa vào read_at và dismissed_at
UPDATE public.notifications SET status = 'read' WHERE read_at IS NOT NULL AND status = 'unread';
UPDATE public.notifications SET status = 'dismissed' WHERE dismissed_at IS NOT NULL AND status IN ('unread', 'read');

-- 3. Xử lý ràng buộc (Check Constraints)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_priority_check;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_priority_check 
    CHECK (priority IN ('low','normal','high','urgent'));

ALTER TABLE public.notifications ADD CONSTRAINT notifications_status_check 
    CHECK (status IN ('unread','read','dismissed'));

-- Fix existing data to avoid constraint violation
UPDATE public.notifications 
SET notification_type = 'system' 
WHERE notification_type NOT IN (
    'lead_assigned',
    'followup_due',
    'followup_overdue',
    'event_upcoming',
    'task_overdue',
    'duplicate_risk',
    'channel_approval_required',
    'order_attention',
    'system'
);

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
    CHECK (notification_type IN (
        'lead_assigned',
        'followup_due',
        'followup_overdue',
        'event_upcoming',
        'task_overdue',
        'duplicate_risk',
        'channel_approval_required',
        'order_attention',
        'system'
    ));

-- 4. Thêm Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON public.notifications(customer_id);

-- 5. RLS (Row Level Security)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;

-- Khôi phục và thắt chặt policies
-- SELECT
DROP POLICY IF EXISTS "Admin/SubAdmin can select all notifications" ON public.notifications;
CREATE POLICY "Admin/SubAdmin can select all notifications" 
ON public.notifications FOR SELECT 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can select own notifications" ON public.notifications;
CREATE POLICY "Users can select own notifications" 
ON public.notifications FOR SELECT 
TO authenticated 
USING (recipient_user_id = auth.uid());

-- UPDATE (Chỉ cho phép update status, read_at, dismissed_at)
DROP POLICY IF EXISTS "Users can update own notification status" ON public.notifications;
CREATE POLICY "Users can update own notification status" 
ON public.notifications FOR UPDATE 
TO authenticated 
USING (recipient_user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid());

-- Admin DELETE
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can delete notifications" 
ON public.notifications FOR DELETE 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Insert bị cấm qua API thông thường (Chỉ cho service role hoặc SECURITY DEFINER rpc)
DROP POLICY IF EXISTS "No direct insert for normal users" ON public.notifications;
CREATE POLICY "No direct insert for normal users" 
ON public.notifications FOR INSERT 
TO authenticated 
WITH CHECK (false);

-- 6. RPC Functions

-- RPC: create_notification_safe (Security Definer)
DROP FUNCTION IF EXISTS public.create_notification_safe;
CREATE OR REPLACE FUNCTION public.create_notification_safe(
    p_recipient_user_id uuid,
    p_notification_type text,
    p_title text,
    p_message text DEFAULT NULL,
    p_priority text DEFAULT 'normal',
    p_actor_user_id uuid DEFAULT NULL,
    p_customer_id uuid DEFAULT NULL,
    p_related_id uuid DEFAULT NULL,
    p_related_type text DEFAULT NULL,
    p_deep_link text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
    v_existing_id uuid;
BEGIN
    -- Deduplicate check
    SELECT id INTO v_existing_id
    FROM public.notifications
    WHERE recipient_user_id = p_recipient_user_id
      AND notification_type = p_notification_type
      AND related_id IS NOT DISTINCT FROM p_related_id
      AND status = 'unread'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Update message and created_at instead of inserting new
        UPDATE public.notifications
        SET message = COALESCE(p_message, message),
            created_at = now()
        WHERE id = v_existing_id;
        
        RETURN v_existing_id;
    END IF;

    -- Insert new notification
    INSERT INTO public.notifications (
        recipient_user_id,
        notification_type,
        title,
        message,
        priority,
        actor_user_id,
        customer_id,
        related_id,
        related_type,
        deep_link,
        metadata
    ) VALUES (
        p_recipient_user_id,
        p_notification_type,
        p_title,
        p_message,
        p_priority,
        p_actor_user_id,
        p_customer_id,
        p_related_id,
        p_related_type,
        p_deep_link,
        p_metadata
    ) RETURNING id INTO v_existing_id;

    RETURN v_existing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: get_my_notifications
DROP FUNCTION IF EXISTS public.get_my_notifications;
CREATE OR REPLACE FUNCTION public.get_my_notifications(
    p_limit int DEFAULT 30,
    p_status text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_unread_count int;
    v_results jsonb;
BEGIN
    SELECT count(*) INTO v_unread_count
    FROM public.notifications
    WHERE recipient_user_id = v_user_id AND status = 'unread';

    WITH user_notifs AS (
        SELECT *
        FROM public.notifications
        WHERE recipient_user_id = v_user_id
          AND (p_status IS NULL OR status = p_status)
        ORDER BY created_at DESC
        LIMIT p_limit
    )
    SELECT COALESCE(jsonb_agg(row_to_json(user_notifs)), '[]'::jsonb) INTO v_results
    FROM user_notifs;

    RETURN jsonb_build_object(
        'unread_count', v_unread_count,
        'notifications', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: mark_notification_read
DROP FUNCTION IF EXISTS public.mark_notification_read;
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET status = 'read',
        read_at = now()
    WHERE id = p_notification_id
      AND (recipient_user_id = auth.uid() OR public.is_admin_or_sub_admin(auth.uid()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: mark_all_notifications_read
DROP FUNCTION IF EXISTS public.mark_all_notifications_read;
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET status = 'read',
        read_at = now()
    WHERE recipient_user_id = auth.uid()
      AND status = 'unread';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: dismiss_notification
DROP FUNCTION IF EXISTS public.dismiss_notification;
CREATE OR REPLACE FUNCTION public.dismiss_notification(p_notification_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET status = 'dismissed',
        dismissed_at = now()
    WHERE id = p_notification_id
      AND (recipient_user_id = auth.uid() OR public.is_admin_or_sub_admin(auth.uid()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kích hoạt tải lại schema cho PostgREST
NOTIFY pgrst, 'reload schema';
