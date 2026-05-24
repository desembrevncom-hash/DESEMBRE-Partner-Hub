-- ============================================================================
-- MIGRATION: Phase P3.1 - Due / Overdue Notification Generator
-- ============================================================================

-- ============================================================================
-- RPC 1: get_due_notification_preview
-- Chức năng: Admin/SubAdmin có thể dùng để xem trước số lượng thông báo
--            chuẩn bị được tạo ra mà không thực sự ghi vào DB.
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_due_notification_preview();
CREATE OR REPLACE FUNCTION public.get_due_notification_preview()
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_overdue_tasks int;
    v_due_today_tasks int;
    v_upcoming_events int;
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Permission denied. Only Admins or SubAdmins can preview notifications.';
    END IF;

    -- 1. Tasks quá hạn (Chưa hoàn thành và due_at < now)
    SELECT count(*) INTO v_overdue_tasks
    FROM public.customer_tasks
    WHERE status != 'completed'
      AND due_at < now()
      AND assigned_to IS NOT NULL;

    -- 2. Tasks đến hạn hôm nay (Chưa hoàn thành và due_at trong ngày hôm nay, tính theo TZ database)
    SELECT count(*) INTO v_due_today_tasks
    FROM public.customer_tasks
    WHERE status != 'completed'
      AND due_at >= current_date
      AND due_at < current_date + interval '1 day'
      AND assigned_to IS NOT NULL;

    -- 3. Events sắp diễn ra (Trong vòng 2 giờ tới)
    SELECT count(*) INTO v_upcoming_events
    FROM public.calendar_events
    WHERE starts_at > now()
      AND starts_at <= now() + interval '2 hours'
      AND owner_user_id IS NOT NULL;

    RETURN jsonb_build_object(
        'overdue_tasks', v_overdue_tasks,
        'due_today_tasks', v_due_today_tasks,
        'upcoming_events', v_upcoming_events,
        'total_estimated', v_overdue_tasks + v_due_today_tasks + v_upcoming_events
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- RPC 2: generate_due_notifications
-- Chức năng: Quét các bảng và gọi create_notification_safe để sinh thông báo.
-- ============================================================================
DROP FUNCTION IF EXISTS public.generate_due_notifications();
CREATE OR REPLACE FUNCTION public.generate_due_notifications()
RETURNS jsonb AS $$
DECLARE
    v_is_admin boolean;
    v_created_overdue int := 0;
    v_created_due_today int := 0;
    v_created_upcoming int := 0;
    
    rec record;
    v_notif_type text;
    v_priority text;
    v_title text;
    v_message text;
BEGIN
    -- Bảo mật: Chỉ Admin / Sub Admin
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Permission denied. Only Admins or SubAdmins can generate notifications.';
    END IF;

    ---------------------------------------------------------------------------
    -- 1. Quét Task Quá hạn
    ---------------------------------------------------------------------------
    FOR rec IN 
        SELECT id, customer_id, title, task_type, due_at, assigned_to
        FROM public.customer_tasks
        WHERE status != 'completed'
          AND due_at < now()
          AND assigned_to IS NOT NULL
    LOOP
        IF rec.task_type = 'follow_up' THEN
            v_notif_type := 'followup_overdue';
            v_title := 'Quá hạn chăm sóc khách hàng';
            v_priority := 'urgent';
        ELSE
            v_notif_type := 'task_overdue';
            v_title := 'Công việc đã quá hạn';
            v_priority := 'high';
        END IF;

        v_message := 'Công việc "' || rec.title || '" đã quá hạn từ ' || to_char(rec.due_at, 'DD/MM/YYYY HH24:MI');

        PERFORM public.create_notification_safe(
            p_recipient_user_id := rec.assigned_to,
            p_notification_type := v_notif_type,
            p_title := v_title,
            p_message := v_message,
            p_priority := v_priority,
            p_customer_id := rec.customer_id,
            p_related_id := rec.id,
            p_related_type := 'customer_tasks',
            p_deep_link := '/workspace' -- Tạm thời hướng về workspace, nếu có KH thì link tới KH
        );
        v_created_overdue := v_created_overdue + 1;
    END LOOP;

    ---------------------------------------------------------------------------
    -- 2. Quét Task Đến hạn hôm nay
    ---------------------------------------------------------------------------
    FOR rec IN 
        SELECT id, customer_id, title, task_type, due_at, assigned_to
        FROM public.customer_tasks
        WHERE status != 'completed'
          AND due_at >= current_date
          AND due_at < current_date + interval '1 day'
          AND assigned_to IS NOT NULL
    LOOP
        IF rec.task_type = 'follow_up' THEN
            v_notif_type := 'followup_due';
            v_title := 'Có lịch chăm sóc hôm nay';
            v_priority := 'normal';
        ELSE
            v_notif_type := 'system'; -- Tạm fallback, hoặc ta xài logic khác
            v_title := 'Công việc đến hạn hôm nay';
            v_priority := 'normal';
        END IF;

        v_message := 'Cần xử lý: "' || rec.title || '" (Hạn chót: ' || to_char(rec.due_at, 'HH24:MI') || ')';

        PERFORM public.create_notification_safe(
            p_recipient_user_id := rec.assigned_to,
            p_notification_type := v_notif_type,
            p_title := v_title,
            p_message := v_message,
            p_priority := v_priority,
            p_customer_id := rec.customer_id,
            p_related_id := rec.id,
            p_related_type := 'customer_tasks',
            p_deep_link := '/workspace'
        );
        v_created_due_today := v_created_due_today + 1;
    END LOOP;

    ---------------------------------------------------------------------------
    -- 3. Quét Event sắp diễn ra (Trong vòng 2 giờ tới)
    ---------------------------------------------------------------------------
    FOR rec IN 
        SELECT id, customer_id, title, starts_at, owner_user_id, assigned_user_ids, event_type
        FROM public.calendar_events
        WHERE starts_at > now()
          AND starts_at <= now() + interval '2 hours'
    LOOP
        v_notif_type := 'event_upcoming';
        v_title := 'Sự kiện sắp diễn ra';
        v_priority := 'high';
        v_message := 'Lịch "' || rec.title || '" sẽ bắt đầu lúc ' || to_char(rec.starts_at, 'HH24:MI');

        -- Thu thập danh sách người nhận duy nhất (owner + mảng assigned_user_ids)
        DECLARE
            v_recipients uuid[];
            v_recipient uuid;
        BEGIN
            v_recipients := ARRAY[]::uuid[];
            
            IF rec.owner_user_id IS NOT NULL THEN
                v_recipients := array_append(v_recipients, rec.owner_user_id);
            END IF;

            -- Nếu có mảng assigned_user_ids, gộp vào
            IF rec.assigned_user_ids IS NOT NULL THEN
                SELECT array_agg(DISTINCT x) INTO v_recipients
                FROM (
                    SELECT unnest(v_recipients) AS x
                    UNION
                    SELECT unnest(rec.assigned_user_ids) AS x
                ) t;
            END IF;

            -- Gửi thông báo cho từng người nhận duy nhất
            IF v_recipients IS NOT NULL THEN
                FOREACH v_recipient IN ARRAY v_recipients
                LOOP
                    PERFORM public.create_notification_safe(
                        p_recipient_user_id := v_recipient,
                        p_notification_type := v_notif_type,
                        p_title := v_title,
                        p_message := v_message,
                        p_priority := v_priority,
                        p_customer_id := rec.customer_id,
                        p_related_id := rec.id,
                        p_related_type := 'calendar_events',
                        p_deep_link := '/workspace'
                    );
                    v_created_upcoming := v_created_upcoming + 1;
                END LOOP;
            END IF;
        END;
    END LOOP;

    ---------------------------------------------------------------------------
    -- Kết quả trả về
    ---------------------------------------------------------------------------
    RETURN jsonb_build_object(
        'success', true,
        'notifications_processed', jsonb_build_object(
            'overdue_tasks', v_created_overdue,
            'due_today_tasks', v_created_due_today,
            'upcoming_events', v_created_upcoming,
            'total', v_created_overdue + v_created_due_today + v_created_upcoming
        ),
        'message', 'Đã tạo thông báo thành công'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kích hoạt tải lại schema cho PostgREST
NOTIFY pgrst, 'reload schema';
