-- =================================================================================
-- Fix AI Settings Database Lint Errors
-- =================================================================================

-- 1. FIX: get_ai_settings_masked
-- Removes Deno.env.get (cross-database references error).
-- Replaces with safe database lookup on public.system_ai_provider_settings.
-- Enforces admin/sub_admin access control inside the SECURITY DEFINER function.
-- Revokes PUBLIC access.

CREATE OR REPLACE FUNCTION public.get_ai_settings_masked()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    cfg RECORD;
    v_openai_configured BOOLEAN;
    v_gemini_configured BOOLEAN;
    v_anthropic_configured BOOLEAN;
BEGIN
    -- Access control: only admin / sub_admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Only Admins can view masked AI settings.';
    END IF;

    -- Fetch AI settings
    SELECT * INTO cfg FROM public.ai_settings WHERE id = 'default';

    -- Check if keys are configured in system_ai_provider_settings
    SELECT EXISTS (
        SELECT 1 FROM public.system_ai_provider_settings 
        WHERE provider = 'openai' AND encrypted_api_key IS NOT NULL AND encrypted_api_key != ''
    ) INTO v_openai_configured;
    
    SELECT EXISTS (
        SELECT 1 FROM public.system_ai_provider_settings 
        WHERE provider = 'gemini' AND encrypted_api_key IS NOT NULL AND encrypted_api_key != ''
    ) INTO v_gemini_configured;
    
    SELECT EXISTS (
        SELECT 1 FROM public.system_ai_provider_settings 
        WHERE provider = 'anthropic' AND encrypted_api_key IS NOT NULL AND encrypted_api_key != ''
    ) INTO v_anthropic_configured;

    -- Return exactly what frontend expects, merging fields from phase_ai4 and ai_governance
    RETURN jsonb_build_object(
        'provider', cfg.provider,
        'chat_model', cfg.chat_model,
        'embedding_model', cfg.embedding_model,
        'module_product_tutor', cfg.module_product_tutor,
        'module_rewrite', cfg.module_rewrite,
        'module_customer_summary', cfg.module_customer_summary,
        'module_sales_assistant', cfg.module_sales_assistant,
        'product_copilot_enabled', cfg.product_copilot_enabled,
        'product_copilot_sale_enabled', cfg.product_copilot_sale_enabled,
        'product_copilot_admin_enabled', cfg.product_copilot_admin_enabled,
        'product_copilot_require_context', cfg.product_copilot_require_context,
        'product_copilot_daily_limit', cfg.product_copilot_daily_limit,
        'max_tokens', cfg.max_tokens,
        'temperature', cfg.temperature,
        'system_tone', cfg.system_tone,
        'daily_token_limit', cfg.daily_token_limit,
        'monthly_cost_limit', cfg.monthly_cost_limit,
        'openai_key_configured', v_openai_configured,
        'gemini_key_configured', v_gemini_configured,
        'anthropic_key_configured', v_anthropic_configured,
        'ai_enabled', cfg.ai_enabled,
        'ai_customer_suggestions_enabled', cfg.ai_customer_suggestions_enabled,
        'ai_sales_assistant_enabled', cfg.ai_sales_assistant_enabled,
        'ai_rag_enabled', cfg.ai_rag_enabled,
        'ai_rewrite_enabled', cfg.ai_rewrite_enabled,
        'ai_daily_limit', cfg.ai_daily_limit,
        'ai_cache_minutes', cfg.ai_cache_minutes
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_settings_masked() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ai_settings_masked() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_ai_settings_masked() TO authenticated;


-- 2. FIX: update_ai_settings
-- Handles unused API key parameters cleanly.
-- Resolves warnings without breaking existing function signature.
-- Adds admin authorization check and path safety.

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
    p_monthly_cost_limit NUMERIC DEFAULT NULL,
    p_openai_api_key TEXT DEFAULT NULL,
    p_gemini_api_key TEXT DEFAULT NULL,
    p_anthropic_api_key TEXT DEFAULT NULL,
    p_ai_enabled BOOLEAN DEFAULT NULL,
    p_ai_customer_suggestions_enabled BOOLEAN DEFAULT NULL,
    p_ai_sales_assistant_enabled BOOLEAN DEFAULT NULL,
    p_ai_rag_enabled BOOLEAN DEFAULT NULL,
    p_ai_rewrite_enabled BOOLEAN DEFAULT NULL,
    p_ai_daily_limit INTEGER DEFAULT NULL,
    p_ai_cache_minutes INTEGER DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Access control: only admins or sub_admins
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Only Admins can update AI settings.';
    END IF;

    -- Deprecated API keys rejection logic
    IF p_openai_api_key IS NOT NULL OR p_gemini_api_key IS NOT NULL OR p_anthropic_api_key IS NOT NULL THEN
        RAISE EXCEPTION 'API keys cannot be updated via update_ai_settings. Use the secure provider settings interface.';
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
        ai_enabled = COALESCE(p_ai_enabled, ai_enabled),
        ai_customer_suggestions_enabled = COALESCE(p_ai_customer_suggestions_enabled, ai_customer_suggestions_enabled),
        ai_sales_assistant_enabled = COALESCE(p_ai_sales_assistant_enabled, ai_sales_assistant_enabled),
        ai_rag_enabled = COALESCE(p_ai_rag_enabled, ai_rag_enabled),
        ai_rewrite_enabled = COALESCE(p_ai_rewrite_enabled, ai_rewrite_enabled),
        ai_daily_limit = COALESCE(p_ai_daily_limit, ai_daily_limit),
        ai_cache_minutes = COALESCE(p_ai_cache_minutes, ai_cache_minutes),
        updated_by = auth.uid(),
        updated_at = now()
    WHERE id = 'default';
END;
$$;

REVOKE ALL ON FUNCTION public.update_ai_settings(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, NUMERIC, TEXT, INTEGER, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_ai_settings(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, NUMERIC, TEXT, INTEGER, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_ai_settings(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, NUMERIC, TEXT, INTEGER, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, INTEGER) TO authenticated;

-- 3. RELOAD POSTGREST
NOTIFY pgrst, 'reload schema';
