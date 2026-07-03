-- Fix ambiguous customer_id by properly aliasing the columns
-- Drop the SECURITY DEFINER to rely on RLS
CREATE OR REPLACE FUNCTION public.get_customer_channel_summary(p_customer_ids uuid[])
 RETURNS TABLE(customer_id uuid, channels_summary jsonb, channel_health_score integer, has_phone boolean, has_facebook boolean, has_zalo boolean, has_email boolean, has_tiktok boolean, has_website boolean, has_primary boolean, has_remarketing boolean, private_count integer, duplicate_risk jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH valid_customers AS (
    SELECT c.id as valid_customer_id
    FROM public.customers c
    WHERE c.id = ANY(p_customer_ids)
      AND c.deleted_at IS NULL
  ),
  channels AS (
    SELECT 
      cc.customer_id as cc_customer_id,
      cc.channel_type,
      cc.channel_value,
      cc.normalized_value,
      cc.is_primary,
      cc.is_verified,
      cc.resolve_status,
      cc.remarketing_enabled,
      cc.scope,
      cc.owner_user_id,
      cc.external_id
    FROM public.customer_contact_channels cc
    WHERE cc.customer_id = ANY(p_customer_ids)
  ),
  aggregated_channels AS (
    SELECT 
      c.cc_customer_id as ac_customer_id,
      jsonb_agg(
        jsonb_build_object(
          'type', c.channel_type,
          'value', c.channel_value,
          'normalized_value', c.normalized_value,
          'is_primary', c.is_primary,
          'is_verified', c.is_verified,
          'resolve_status', c.resolve_status,
          'remarketing_enabled', c.remarketing_enabled,
          'scope', c.scope,
          'owner_user_id', c.owner_user_id,
          'external_id', c.external_id
        )
      ) as channels_summary,
      
      BOOL_OR(c.channel_type = 'phone') as has_phone,
      BOOL_OR(c.channel_type = 'facebook') as has_facebook,
      BOOL_OR(c.channel_type = 'zalo') as has_zalo,
      BOOL_OR(c.channel_type = 'email') as has_email,
      BOOL_OR(c.channel_type = 'tiktok') as has_tiktok,
      BOOL_OR(c.channel_type = 'website') as has_website,
      BOOL_OR(c.is_primary) as has_primary,
      BOOL_OR(c.remarketing_enabled) as has_remarketing,
      BOOL_OR(c.is_verified OR c.resolve_status = 'verified') as has_verified,
      
      COUNT(CASE WHEN c.scope = 'private' THEN 1 ELSE NULL END)::INT as private_count,
      
      -- Duplicate Value Check
      (
        SELECT COUNT(*) > 0
        FROM (
            SELECT sub.normalized_value 
            FROM channels sub 
            WHERE sub.cc_customer_id = c.cc_customer_id AND sub.normalized_value IS NOT NULL AND sub.normalized_value != ''
            GROUP BY sub.normalized_value 
            HAVING COUNT(*) > 1
        ) dup_vals
      ) as has_value_duplicates,

      -- Duplicate External ID Check
      (
        SELECT COUNT(*) > 0
        FROM (
            SELECT sub.external_id 
            FROM channels sub 
            WHERE sub.cc_customer_id = c.cc_customer_id AND sub.external_id IS NOT NULL AND sub.external_id != ''
            GROUP BY sub.external_id 
            HAVING COUNT(*) > 1
        ) dup_ext
      ) as has_external_id_duplicates,
      
      -- Duplicate Primary Check
      (
        SELECT COUNT(*) > 0
        FROM (
            SELECT sub.scope, COALESCE(sub.owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid) as o_uid
            FROM channels sub 
            WHERE sub.cc_customer_id = c.cc_customer_id AND sub.is_primary = true
            GROUP BY sub.scope, COALESCE(sub.owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
            HAVING COUNT(*) > 1
        ) dup_primaries
      ) as has_primary_duplicates

    FROM channels c
    GROUP BY c.cc_customer_id
  )
  SELECT 
    uc.valid_customer_id as customer_id,
    COALESCE(ac.channels_summary, '[]'::jsonb) as channels_summary,
    
    LEAST(100, 
      (CASE WHEN ac.has_phone THEN 30 ELSE 0 END) +
      (CASE WHEN (ac.has_facebook OR ac.has_zalo OR ac.has_tiktok OR ch_types.max_channel_type = 'instagram') THEN 20 ELSE 0 END) +
      (CASE WHEN ac.has_primary THEN 20 ELSE 0 END) +
      (CASE WHEN ac.has_verified THEN 20 ELSE 0 END) +
      (CASE WHEN ac.has_remarketing THEN 10 ELSE 0 END)
    )::INT as channel_health_score,
    
    COALESCE(ac.has_phone, false) as has_phone,
    COALESCE(ac.has_facebook, false) as has_facebook,
    COALESCE(ac.has_zalo, false) as has_zalo,
    COALESCE(ac.has_email, false) as has_email,
    COALESCE(ac.has_tiktok, false) as has_tiktok,
    COALESCE(ac.has_website, false) as has_website,
    COALESCE(ac.has_primary, false) as has_primary,
    COALESCE(ac.has_remarketing, false) as has_remarketing,
    COALESCE(ac.private_count, 0) as private_count,
    
    jsonb_build_object(
      'has_value_duplicates', COALESCE(ac.has_value_duplicates, false),
      'has_external_id_duplicates', COALESCE(ac.has_external_id_duplicates, false),
      'has_primary_duplicates', COALESCE(ac.has_primary_duplicates, false)
    ) as duplicate_risk
    
  FROM valid_customers uc
  LEFT JOIN aggregated_channels ac ON ac.ac_customer_id = uc.valid_customer_id
  LEFT JOIN (SELECT ch.cc_customer_id, MAX(ch.channel_type) as max_channel_type FROM channels ch GROUP BY ch.cc_customer_id) ch_types ON ch_types.cc_customer_id = uc.valid_customer_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_customer_channel_summary(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_customer_channel_summary(uuid[]) TO authenticated;

-- run_automation_rule
CREATE OR REPLACE FUNCTION public.run_automation_rule(p_rule_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_is_admin boolean;
    v_rule record;
    v_matched_count int := 0;
    v_action_count int := 0;
    v_error_message text := NULL;
    v_customer record;
    v_task record;
    v_existing_task uuid;
    
    -- Governance
    v_auto_enabled boolean;
    v_pilot_enabled boolean;
    v_daily_limit int;
    v_today_runs int;
    v_lock_key text := 'automation_rule:' || p_rule_id;
    v_locked boolean;
BEGIN
    v_is_admin := public.is_admin_or_sub_admin(auth.uid());
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Permission denied.'; END IF;

    -- Governance Checks
    SELECT automation_enabled, pilot_mode_enabled, automation_daily_limit 
    INTO v_auto_enabled, v_pilot_enabled, v_daily_limit 
    FROM public.system_settings LIMIT 1;

    -- Nếu tắt automation toàn cục
    IF NOT COALESCE(v_auto_enabled, false) THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'message', 'Automation is disabled globally.');
    END IF;

    -- Check Daily Limit
    SELECT count(*) INTO v_today_runs FROM public.automation_run_logs WHERE created_at >= current_date;
    IF v_today_runs >= COALESCE(v_daily_limit, 200) THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'message', 'Daily automation run limit reached.');
    END IF;

    -- Execution Lock
    v_locked := public.acquire_execution_lock(v_lock_key, 300);
    IF NOT v_locked THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'message', 'Locked. Rule is already running.');
    END IF;

    -- Logic bắt đầu
    BEGIN
        SELECT * INTO v_rule FROM public.automation_rules WHERE id = p_rule_id;
        IF v_rule IS NULL OR NOT v_rule.is_active THEN
            v_error_message := 'Rule is inactive or not found.';
            RAISE EXCEPTION '%', v_error_message;
        END IF;

        IF v_rule.trigger_type = 'customer_stale' THEN
            DECLARE v_days int := COALESCE((v_rule.condition_json->>'days')::int, 7);
            BEGIN
                FOR v_customer IN 
                    SELECT c.id, c.owner_sale_id, c.name
                    FROM public.customers c
                    WHERE c.owner_sale_id IS NOT NULL
                      -- PILOT CHECK: Chỉ cho pilot user hoặc tất cả
                      AND (v_pilot_enabled = false OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = c.owner_sale_id AND ur.role IN ('admin', 'sub_admin', 'tele_lead')))
                      AND NOT EXISTS (
                          SELECT 1 FROM public.customer_activities a 
                          WHERE a.customer_id = c.id AND a.created_at > (now() - (v_days || ' days')::interval)
                      )
                LOOP
                    v_matched_count := v_matched_count + 1;
                    SELECT id INTO v_existing_task FROM public.customer_tasks 
                    WHERE customer_id = v_customer.id AND status != 'completed' AND title = 'Chăm sóc khách lâu không tương tác' AND created_at > now() - interval '24 hours' LIMIT 1;

                    IF v_existing_task IS NULL THEN
                        IF v_rule.action_type IN ('create_task', 'create_task_and_notification') THEN
                            INSERT INTO public.customer_tasks (customer_id, assigned_to, title, note, task_type, due_at, assigned_by)
                            VALUES (v_customer.id, v_customer.owner_sale_id, 'Chăm sóc khách lâu không tương tác', 'Khách hàng ' || v_customer.name || ' đã ' || v_days || ' ngày chưa có tương tác.', 'follow_up', now() + interval '1 day', auth.uid());
                            v_action_count := v_action_count + 1;
                        END IF;
                        
                        IF v_rule.action_type IN ('create_notification', 'create_task_and_notification') THEN
                            PERFORM public.create_notification_safe(v_customer.owner_sale_id, 'followup_due', 'Khách hàng bị bỏ quên', 'Khách hàng ' || v_customer.name || ' đã ' || v_days || ' ngày chưa được chăm sóc.', 'normal', NULL, v_customer.id, NULL, NULL, '/customers?id=' || v_customer.id);
                            v_action_count := v_action_count + 1;
                        END IF;
                    END IF;
                END LOOP;
            END;

        ELSIF v_rule.trigger_type = 'followup_overdue' THEN
            DECLARE v_days_overdue int := COALESCE((v_rule.condition_json->>'days_overdue')::int, 1);
            BEGIN
                FOR v_task IN 
                    SELECT t.id, t.customer_id, t.assigned_to, t.title, c.name
                    FROM public.customer_tasks t LEFT JOIN public.customers c ON c.id = t.customer_id
                    WHERE t.status != 'completed' AND t.due_at < (now() - (v_days_overdue || ' days')::interval) AND t.assigned_to IS NOT NULL
                      -- PILOT CHECK: Chỉ cho pilot user hoặc tất cả
                      AND (v_pilot_enabled = false OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = t.assigned_to AND ur.role IN ('admin', 'sub_admin', 'tele_lead')))
                LOOP
                    v_matched_count := v_matched_count + 1;
                    
                    IF v_rule.action_type IN ('create_notification') THEN
                        PERFORM public.create_notification_safe(v_task.assigned_to, 'task_overdue', 'Nhắc nhở Task quá hạn nặng', 'Task "' || v_task.title || '" (Khách: ' || COALESCE(v_task.name, 'N/A') || ') đã quá hạn ' || v_days_overdue || ' ngày.', 'high', NULL, v_task.customer_id, v_task.id, 'customer_tasks', '/workspace');
                        v_action_count := v_action_count + 1;
                    END IF;
                END LOOP;
            END;
        END IF;

        -- Log run
        INSERT INTO public.automation_run_logs (rule_id, status, matched_count, action_count)
        VALUES (p_rule_id, 'success', v_matched_count, v_action_count);

    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.automation_run_logs (rule_id, status, error_message)
        VALUES (p_rule_id, 'failed', SQLERRM);
        PERFORM public.release_execution_lock(v_lock_key);
        RETURN pg_catalog.jsonb_build_object('success', false, 'message', SQLERRM);
    END;

    PERFORM public.release_execution_lock(v_lock_key);
    RETURN pg_catalog.jsonb_build_object('success', true, 'matched_count', v_matched_count, 'action_count', v_action_count);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.run_automation_rule(text) FROM public;
GRANT EXECUTE ON FUNCTION public.run_automation_rule(text) TO service_role, authenticated;

-- log_quick_call_result
CREATE OR REPLACE FUNCTION public.log_quick_call_result(p_customer_id uuid, p_result_type text, p_note text, p_next_follow_up_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_customer RECORD;
    v_is_admin boolean;
    v_has_access boolean;
    v_activity_content text;
    v_result_label text;
    v_weight integer;
    v_quality text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id;
    IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    v_is_admin := public.is_admin_or_sub_admin(v_user_id);
    v_has_access := COALESCE(v_is_admin OR v_customer.owner_sale_id = v_user_id OR v_customer.owner_tele_id = v_user_id OR v_customer.user_id = v_user_id OR public.user_has_customer_task(p_customer_id, v_user_id), false);
    
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permission denied. You do not have access to this customer.';
    END IF;

    v_result_label := CASE p_result_type
        WHEN 'no_answer' THEN 'Không nghe máy'
        WHEN 'interested' THEN 'Quan tâm'
        WHEN 'call_back' THEN 'Hẹn gọi lại'
        WHEN 'sent_quote' THEN 'Đã gửi báo giá'
        WHEN 'wrong_number' THEN 'Sai số'
        WHEN 'unreachable' THEN 'Không liên hệ được'
        ELSE p_result_type
    END;

    -- Calculate Weight & Quality
    v_weight := CASE p_result_type
        WHEN 'interested' THEN 5
        WHEN 'call_back' THEN 4
        WHEN 'no_answer' THEN 1
        WHEN 'wrong_number' THEN 0
        WHEN 'unreachable' THEN 1
        WHEN 'sent_quote' THEN 8
        ELSE 1
    END;

    v_quality := CASE p_result_type
        WHEN 'interested' THEN 'high'
        WHEN 'call_back' THEN 'medium'
        WHEN 'no_answer' THEN 'low'
        WHEN 'wrong_number' THEN 'negative'
        WHEN 'unreachable' THEN 'low'
        WHEN 'sent_quote' THEN 'high'
        ELSE 'neutral'
    END;

    INSERT INTO public.customer_interactions (
        customer_id,
        user_id,
        direction,
        interaction_type,
        platform,
        content_preview,
        interaction_weight,
        interaction_quality
    ) VALUES (
        p_customer_id,
        v_user_id,
        'outbound',
        'call',
        'phone',
        'Kết quả gọi: ' || v_result_label || CHR(10) || COALESCE(p_note, ''),
        v_weight,
        v_quality
    );

    v_activity_content := 'Đã log cuộc gọi nhanh: ' || v_result_label;
    IF p_note IS NOT NULL AND p_note != '' THEN
        v_activity_content := v_activity_content || CHR(10) || 'Ghi chú: ' || p_note;
    END IF;
    IF p_next_follow_up_at IS NOT NULL THEN
        v_activity_content := v_activity_content || CHR(10) || 'Lịch hẹn lại: ' || to_char(p_next_follow_up_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI');
    END IF;

    INSERT INTO public.customer_activities (
        customer_id,
        created_by,
        activity_type,
        title,
        content,
        interaction_weight,
        interaction_quality
    ) VALUES (
        p_customer_id,
        v_user_id,
        'call',
        'Gọi điện chăm sóc',
        v_activity_content,
        v_weight,
        v_quality
    );

    UPDATE public.customers
    SET 
        last_activity_at = NOW(),
        last_contacted_at = NOW(),
        next_follow_up_at = COALESCE(p_next_follow_up_at, next_follow_up_at),
        ownership_status = CASE WHEN p_result_type = 'wrong_number' THEN 'inactive' ELSE ownership_status END,
        updated_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_customer_id;

    IF p_next_follow_up_at IS NOT NULL THEN
        INSERT INTO public.customer_tasks (
            customer_id,
            assigned_to,
            assigned_by,
            title,
            task_type,
            priority,
            status,
            due_at
        ) VALUES (
            p_customer_id,
            v_user_id,
            v_user_id,
            'Hẹn gọi lại sau khi liên hệ',
            'follow_up',
            'high',
            'pending',
            p_next_follow_up_at
        );
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'message', 'Log cuộc gọi thành công',
        'customer_id', p_customer_id,
        'weight', v_weight,
        'quality', v_quality
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_quick_call_result(uuid, text, text, timestamp with time zone) FROM public;
GRANT EXECUTE ON FUNCTION public.log_quick_call_result(uuid, text, text, timestamp with time zone) TO authenticated;
