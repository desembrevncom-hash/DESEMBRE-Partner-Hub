-- Migration: AI Governance 
-- Thêm các cờ an toàn (safe disabled by default) vào bảng ai_settings

-- 1. Thêm cột mới nếu chưa có
ALTER TABLE public.ai_settings
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_customer_suggestions_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_sales_assistant_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_rag_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_rewrite_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_daily_limit INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS ai_cache_minutes INTEGER DEFAULT 60;

-- ============================================================
-- 2. Cập nhật get_ai_settings_masked RPC
-- ============================================================
DROP FUNCTION IF EXISTS public.get_ai_settings_masked();
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
        -- Governance new columns
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

-- ============================================================
-- 3. Cập nhật update_ai_settings RPC
-- ============================================================
DROP FUNCTION IF EXISTS public.update_ai_settings(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, NUMERIC, TEXT, INTEGER, NUMERIC);
-- Vì function signature cũ sẽ khác mới (có thể gây lỗi khi frontend gọi nếu không khớp parameter),
-- tốt nhất là drop function cũ và tạo lại với các tham số mới.
-- Drop function bất kể parameter list:
DO $$ 
DECLARE 
    func_name text := 'update_ai_settings';
    func_sig text;
BEGIN
    FOR func_sig IN 
        SELECT oid::regprocedure::text 
        FROM pg_proc 
        WHERE proname = func_name AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_sig;
    END LOOP;
END $$;

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
        ai_enabled = COALESCE(p_ai_enabled, ai_enabled),
        ai_customer_suggestions_enabled = COALESCE(p_ai_customer_suggestions_enabled, ai_customer_suggestions_enabled),
        ai_sales_assistant_enabled = COALESCE(p_ai_sales_assistant_enabled, ai_sales_assistant_enabled),
        ai_rag_enabled = COALESCE(p_ai_rag_enabled, ai_rag_enabled),
        ai_rewrite_enabled = COALESCE(p_ai_rewrite_enabled, ai_rewrite_enabled),
        ai_daily_limit = COALESCE(p_ai_daily_limit, ai_daily_limit),
        ai_cache_minutes = COALESCE(p_ai_cache_minutes, ai_cache_minutes),
        updated_by = auth.uid()
    WHERE id = 'default';
END;
$$;
