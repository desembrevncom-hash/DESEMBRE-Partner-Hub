-- Map legacy notification types to new allowed types
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
DECLARE
    v_mapped_type text := p_type;
BEGIN
    -- Map legacy types to allowed types in notification_type_check constraint
    IF p_type = 'customer_assigned' THEN
        v_mapped_type := 'lead_assigned';
    ELSIF p_type = 'task_assigned' THEN
        v_mapped_type := 'system';
    END IF;

    INSERT INTO public.notifications (
        recipient_user_id, title, message, notification_type, priority, related_type, related_id, deep_link
    ) VALUES (
        p_recipient_id, p_title, p_message, v_mapped_type, p_priority, p_entity_type, p_entity_id, p_action_url
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
