-- Migration: Fix AI Settings RPCs
-- 1. Fix get_ai_settings_masked: remove invalid Deno.env.get() calls
-- 2. Fix update_ai_settings: use public.is_admin_or_sub_admin()

-- ============================================================
-- 1. Replace get_ai_settings_masked (remove Deno.env.get which is invalid SQL)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_ai_settings_masked()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cfg RECORD;
BEGIN
    -- Access control: only admin / sub_admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT * INTO cfg FROM public.ai_settings WHERE id = 'default';

    -- Note: We cannot check Supabase Secrets from SQL.
    -- The frontend will call test-ai-connection Edge Function to verify key status.
    -- We return a static indicator; actual key check is done server-side via Edge Function.
    RETURN jsonb_build_object(
        'provider', cfg.provider,
        'chat_model', cfg.chat_model,
        'embedding_model', cfg.embedding_model,
        'module_product_tutor', cfg.module_product_tutor,
        'module_rewrite', cfg.module_rewrite,
        'module_customer_summary', cfg.module_customer_summary,
        'module_sales_assistant', cfg.module_sales_assistant,
        'max_tokens', cfg.max_tokens,
        'temperature', cfg.temperature,
        'system_tone', cfg.system_tone,
        'daily_token_limit', cfg.daily_token_limit,
        'monthly_cost_limit', cfg.monthly_cost_limit,
        'updated_at', cfg.updated_at,
        'updated_by', cfg.updated_by
    );
END;
$$;

-- ============================================================
-- 2. Replace update_ai_settings: use public.is_admin_or_sub_admin()
-- ============================================================
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
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
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
