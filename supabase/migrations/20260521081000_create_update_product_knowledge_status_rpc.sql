-- Migration: Create RPC function update_product_knowledge_status with security check

CREATE OR REPLACE FUNCTION public.update_product_knowledge_status(
    p_id uuid,
    new_status text,
    note text,
    status_reason_type text
) RETURNS void AS $$
DECLARE
    current_status text;
BEGIN
    -- Ensure caller is Admin or Sub Admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Permission denied: only Admin/Sub Admin can change QA status';
    END IF;

    -- Validate new_status
    IF new_status NOT IN ('draft','review','approved','archived') THEN
        RAISE EXCEPTION 'Invalid status %', new_status;
    END IF;

    -- Fetch current status
    SELECT qa_status INTO current_status FROM public.product_knowledge WHERE id = p_id;
    IF current_status IS NULL THEN
        RAISE EXCEPTION 'product_knowledge with id % not found', p_id;
    END IF;

    -- Update product_knowledge fields based on status transition
    UPDATE public.product_knowledge
    SET qa_status = new_status,
        approved_by = CASE WHEN new_status = 'approved' THEN auth.uid() ELSE NULL END,
        approved_at = CASE WHEN new_status = 'approved' THEN now() ELSE NULL END
    WHERE id = p_id;

    -- Insert audit record
    INSERT INTO public.product_knowledge_status_changes (
        product_knowledge_id,
        from_status,
        to_status,
        changed_by,
        note,
        status_reason_type
    ) VALUES (
        p_id,
        current_status,
        new_status,
        auth.uid(),
        note,
        status_reason_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (function will enforce internal check)
GRANT EXECUTE ON FUNCTION public.update_product_knowledge_status(uuid, text, text, text) TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
