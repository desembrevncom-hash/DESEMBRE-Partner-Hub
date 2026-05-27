-- Fix legacy notification trigger function to use new column names
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
        recipient_user_id, title, message, notification_type, priority, related_type, related_id, deep_link
    ) VALUES (
        p_recipient_id, p_title, p_message, p_type, p_priority, p_entity_type, p_entity_id, p_action_url
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
