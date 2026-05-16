-- ============================================================================

-- 0. CHUẨN HOÁ TRẠNG THÁI ĐƠN HÀNG (BỔ SUNG 'delivered', 'completed')
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('draft', 'confirmed', 'delivered', 'completed', 'cancelled'));

-- 1. HÀM CHÍNH: CHẠY CÁC TÁC VỤ BẢO TRÌ VÀ NHẮC NHỞ CRM
CREATE OR REPLACE FUNCTION public.run_crm_maintenance_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_task RECORD;
    v_order RECORD;
    v_lead RECORD;
BEGIN
    -- 1.1 NHẮC NHỞ TASK QUÁ HẠN (Overdue Tasks)
    -- Tìm các task chưa hoàn thành, đã quá hạn và chưa được thông báo nhắc nhở "quá hạn"
    FOR v_task IN 
        SELECT ct.*, c.facility_name, c.name as customer_name
        FROM public.customer_tasks ct
        LEFT JOIN public.customers c ON ct.customer_id = c.id
        WHERE ct.status = 'pending' 
          AND ct.due_at < now()
          AND ct.due_at > now() - interval '24 hours' -- Chỉ nhắc trong vòng 24h đầu quá hạn
    LOOP
        -- Thông báo cho người được gán
        IF v_task.assigned_to IS NOT NULL THEN
            PERFORM public.create_system_notification(
                v_task.assigned_to,
                '⚠️ CẢNH BÁO: Task quá hạn!',
                'Task "' || v_task.title || '" cho ' || COALESCE(v_task.facility_name, v_task.customer_name) || ' đã quá hạn.',
                'task_overdue',
                'high',
                'task',
                v_task.id,
                '/workspace'
            );
        END IF;
        
        -- Nếu là task quan trọng, báo cho Tele Lead
        IF v_task.priority IN ('high', 'urgent') AND v_task.owner_tele_id IS NOT NULL THEN
            PERFORM public.create_system_notification(
                v_task.owner_tele_id,
                '🚨 Giám sát: Task của team quá hạn',
                'Nhân sự được gán chưa xử lý task "' || v_task.title || '" đúng hạn.',
                'team_task_overdue',
                'normal',
                'task',
                v_task.id,
                '/workspace'
            );
        END IF;
    END LOOP;

    -- 1.2 TỰ ĐỘNG TẠO TASK CHECK-IN SAU MUA (Post-Purchase Check-in)
    -- Tìm đơn hàng đã hoàn thành cách đây đúng 7 ngày và chưa có task check-in tiếp theo
    FOR v_order IN
        SELECT o.id, o.customer_id, o.owner_sale_id, c.facility_name
        FROM public.orders o
        JOIN public.customers c ON o.customer_id = c.id
        WHERE o.status = 'completed'
          AND o.updated_at::date = (now() - interval '7 days')::date
          AND NOT EXISTS (
              SELECT 1 FROM public.customer_tasks 
              WHERE customer_id = o.customer_id 
                AND task_type = 'follow_up' 
                AND created_at > o.updated_at
          )
    LOOP
        INSERT INTO public.customer_tasks (
            customer_id,
            assigned_to,
            task_type,
            title,
            note,
            priority,
            due_at
        ) VALUES (
            v_order.customer_id,
            v_order.owner_sale_id,
            'follow_up',
            '📞 Check-in khách hàng sau 7 ngày mua hàng',
            'Đơn hàng #' || v_order.id || ' đã hoàn thành được 1 tuần. Hãy gọi hỏi thăm trải nghiệm sản phẩm của khách.',
            'normal',
            now() + interval '1 day'
        );
    END LOOP;

    -- 1.3 CẢNH BÁO LEAD TỒN ĐỌNG (Stagnant Unassigned Leads)
    -- Tìm các Lead mới chưa được gán sau 24h
    FOR v_lead IN
        SELECT id, facility_name, name
        FROM public.customers
        WHERE owner_tele_id IS NULL
          AND lifecycle_stage = 'new_lead'
          AND created_at < now() - interval '24 hours'
    LOOP
        -- Thông báo cho toàn bộ Tele Lead (hoặc Admin nếu không có Lead)
        -- Ở đây tạm thời gửi cho Admin hoặc người tạo hệ thống
        INSERT INTO public.notifications (
            recipient_user_id, title, message, type, priority, entity_type, entity_id
        )
        SELECT user_id, '📥 Lead mới chưa được phân phối', 
               'Lead ' || COALESCE(v_lead.facility_name, v_lead.name) || ' đã tồn đọng hơn 24h.',
               'stagnant_lead', 'high', 'customer', v_lead.id
        FROM public.user_roles WHERE role = 'tele_lead';
    END LOOP;

END;
$$;

-- 2. ĐĂNG KÝ VÀO PG_CRON (CHẠY MỖI 6 GIỜ)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('crm_maintenance_job');
        PERFORM cron.schedule(
            'crm_maintenance_job',
            '0 */6 * * *', -- Chạy vào phút 0 mỗi 6 giờ
            'SELECT public.run_crm_maintenance_tasks()'
        );
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
