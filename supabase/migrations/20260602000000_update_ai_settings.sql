-- Migration: Create RPC to update AI settings (singleton)
CREATE OR REPLACE FUNCTION public.update_ai_settings(
    p_provider TEXT DEFAULT NULL,
    p_chat_model TEXT DEFAULT NULL,
    p_embedding_model TEXT DEFAULT NULL,
    p_module_product_tutor BOOLEAN DEFAULT NULL,
    p_module_rewrite BOOLEAN DEFAULT NULL,
    p_module_customer_summary BOOLEAN DEFAULT NULL,
    p_module_sales_assistant BOOLEAN DEFAULT NULL,
    p_max_tokens INTEGER DEFAULT NULL,
    p_temperature NUMERIC DEFAULT NULL,
    p_system_tone TEXT DEFAULT NULL,
    p_daily_token_limit INTEGER DEFAULT NULL,
    p_monthly_cost_limit NUMERIC DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Access control: only admins or sub_admins
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'sub_admin')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    UPDATE public.ai_settings SET
        provider = COALESCE(p_provider, provider),
        chat_model = COALESCE(p_chat_model, chat_model),
        embedding_model = COALESCE(p_embedding_model, embedding_model),
        module_product_tutor = COALESCE(p_module_product_tutor, module_product_tutor),
        module_rewrite = COALESCE(p_module_rewrite, module_rewrite),
        module_customer_summary = COALESCE(p_module_customer_summary, module_customer_summary),
        module_sales_assistant = COALESCE(p_module_sales_assistant, module_sales_assistant),
        max_tokens = COALESCE(p_max_tokens, max_tokens),
        temperature = COALESCE(p_temperature, temperature),
        system_tone = COALESCE(p_system_tone, system_tone),
        daily_token_limit = COALESCE(p_daily_token_limit, daily_token_limit),
        monthly_cost_limit = COALESCE(p_monthly_cost_limit, monthly_cost_limit),
        updated_by = auth.uid()
    WHERE id = 'default';
END;
$$;
