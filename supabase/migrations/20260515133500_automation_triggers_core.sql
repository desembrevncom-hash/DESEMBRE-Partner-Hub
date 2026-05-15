-- ============================================================================
-- MIGRATION: Tự động hóa thông báo (Automation Triggers Core)
-- ============================================================================

-- 1. HÀM HELPER: TỰ ĐỘNG CHÈN THÔNG BÁO (Generic Function)
CREATE OR REPLACE FUNCTION public.create_system_notification(
    p_recipient_id uuid,
    p_title text,
    p_message text,
    p_type text,
    p_priority text,
    p_entity_type text,
    p_entity_id uuid,
    p_action_url text
) RETURNS void AS $$
BEGIN
    INSERT INTO public.notifications (
        recipient_user_id, title, message, type, priority, entity_type, entity_id, action_url
    ) VALUES (
        p_recipient_id, p_title, p_message, p_type, p_priority, p_entity_type, p_entity_id, p_action_url
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER: THÔNG BÁO KHI CÓ TASK MỚI HOẶC ĐỔI NGƯỜI PHỤ TRÁCH
CREATE OR REPLACE FUNCTION public.on_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
    -- Nếu có người được gán mới (INSERT) hoặc đổi người được gán (UPDATE)
    IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to)) THEN
        
        PERFORM public.create_system_notification(
            NEW.assigned_to,
            '📌 Bạn có công việc mới: ' || NEW.title,
            'Hạn chót: ' || COALESCE(to_char(NEW.due_at, 'HH24:MI dd/MM'), 'Chưa gán'),
            'task_assigned',
            NEW.priority,
            'task',
            NEW.id,
            '/workspace'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_task_assigned ON public.customer_tasks;
CREATE TRIGGER tr_task_assigned
    AFTER INSERT OR UPDATE ON public.customer_tasks
    FOR EACH ROW EXECUTE FUNCTION public.on_task_assigned();

-- 3. TRIGGER: THÔNG BÁO KHI ĐƯỢC GÁN QUYỀN SỞ HỮU KHÁCH HÀNG (CUSTOMER OWNERSHIP)
CREATE OR REPLACE FUNCTION public.on_customer_ownership_assigned()
RETURNS TRIGGER AS $$
BEGIN
    -- Kiểm tra gán Sale Owner
    IF (NEW.owner_sale_id IS NOT NULL AND (OLD.owner_sale_id IS NULL OR NEW.owner_sale_id != OLD.owner_sale_id)) THEN
        PERFORM public.create_system_notification(
            NEW.owner_sale_id,
            '🤝 Bạn được gán phụ trách Khách hàng mới',
            'Khách hàng: ' || NEW.facility_name || ' (' || NEW.name || ')',
            'customer_assigned',
            'normal',
            'customer',
            NEW.id,
            '/customers'
        );
    END IF;

    -- Kiểm tra gán Tele Owner
    IF (NEW.owner_tele_id IS NOT NULL AND (OLD.owner_tele_id IS NULL OR NEW.owner_tele_id != OLD.owner_tele_id)) THEN
        PERFORM public.create_system_notification(
            NEW.owner_tele_id,
            '🎧 Bạn được gán phụ trách Tele cho Khách hàng mới',
            'Khách hàng: ' || NEW.facility_name,
            'customer_assigned',
            'normal',
            'customer',
            NEW.id,
            '/customers'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_customer_ownership_assigned ON public.customers;
CREATE TRIGGER tr_customer_ownership_assigned
    AFTER UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.on_customer_ownership_assigned();

-- 4. LÀM MỚI SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
