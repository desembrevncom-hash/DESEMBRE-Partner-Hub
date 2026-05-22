-- Migration: Add API keys columns to ai_settings table and update RPCs

ALTER TABLE public.ai_settings
ADD COLUMN IF NOT EXISTS openai_api_key TEXT,
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT,
ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;

-- 1. Replace get_ai_settings_masked (mask API keys safely)
DROP FUNCTION IF EXISTS public.get_ai_settings_masked();
CREATE OR REPLACE FUNCTION public.get_ai_settings_masked()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cfg RECORD;
    openai_key_masked TEXT;
    gemini_key_masked TEXT;
    anthropic_key_masked TEXT;
BEGIN
    -- Access control: only admin / sub_admin
    IF NOT public.is_admin_or_sub_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT * INTO cfg FROM public.ai_settings WHERE id = 'default';

    openai_key_masked := CASE 
        WHEN cfg.openai_api_key IS NULL OR cfg.openai_api_key = '' THEN ''
        WHEN length(cfg.openai_api_key) <= 12 THEN '••••••••'
        ELSE substring(cfg.openai_api_key from 1 for 7) || '...' || substring(cfg.openai_api_key from length(cfg.openai_api_key) - 4 for 5)
    END;

    gemini_key_masked := CASE 
        WHEN cfg.gemini_api_key IS NULL OR cfg.gemini_api_key = '' THEN ''
        WHEN length(cfg.gemini_api_key) <= 12 THEN '••••••••'
        ELSE substring(cfg.gemini_api_key from 1 for 7) || '...' || substring(cfg.gemini_api_key from length(cfg.gemini_api_key) - 4 for 5)
    END;

    anthropic_key_masked := CASE 
        WHEN cfg.anthropic_api_key IS NULL OR cfg.anthropic_api_key = '' THEN ''
        WHEN length(cfg.anthropic_api_key) <= 12 THEN '••••••••'
        ELSE substring(cfg.anthropic_api_key from 1 for 7) || '...' || substring(cfg.anthropic_api_key from length(cfg.anthropic_api_key) - 4 for 5)
    END;

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
        'updated_by', cfg.updated_by,
        'openai_api_key', openai_key_masked,
        'gemini_api_key', gemini_key_masked,
        'anthropic_api_key', anthropic_key_masked
    );
END;
$$;

-- 2. Replace update_ai_settings (handle updating of keys safely)
DROP FUNCTION IF EXISTS public.update_ai_settings(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, NUMERIC, TEXT, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS public.update_ai_settings(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, NUMERIC, TEXT, INTEGER, NUMERIC, TEXT, TEXT, TEXT);

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
    p_anthropic_api_key TEXT DEFAULT NULL
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
        openai_api_key = CASE 
            WHEN p_openai_api_key IS NULL THEN openai_api_key
            WHEN p_openai_api_key = '' THEN NULL
            WHEN p_openai_api_key LIKE '%...%' OR p_openai_api_key = '••••••••' THEN openai_api_key
            ELSE p_openai_api_key
        END,
        gemini_api_key = CASE 
            WHEN p_gemini_api_key IS NULL THEN gemini_api_key
            WHEN p_gemini_api_key = '' THEN NULL
            WHEN p_gemini_api_key LIKE '%...%' OR p_gemini_api_key = '••••••••' THEN gemini_api_key
            ELSE p_gemini_api_key
        END,
        anthropic_api_key = CASE 
            WHEN p_anthropic_api_key IS NULL THEN anthropic_api_key
            WHEN p_anthropic_api_key = '' THEN NULL
            WHEN p_anthropic_api_key LIKE '%...%' OR p_anthropic_api_key = '••••••••' THEN anthropic_api_key
            ELSE p_anthropic_api_key
        END,
        updated_by = auth.uid()
    WHERE id = 'default';
END;
$$;
