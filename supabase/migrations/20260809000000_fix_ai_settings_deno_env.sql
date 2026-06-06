-- Loại bỏ Deno.env.get() bên trong hàm PostgreSQL
-- PostgreSQL không thể gọi Deno. Thay vào đó kiểm tra khóa API từ bảng system_ai_provider_settings
DROP FUNCTION IF EXISTS public.get_ai_settings_masked();

CREATE OR REPLACE FUNCTION public.get_ai_settings_masked()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cfg RECORD;
    openai_configured BOOLEAN;
    gemini_configured BOOLEAN;
    anthropic_configured BOOLEAN;
BEGIN
    -- Allow any authenticated user to read settings (for frontend conditional rendering)
    SELECT * INTO cfg FROM public.ai_settings WHERE id = 'default';

    -- Check configuration from system_ai_provider_settings thay vì Deno.env
    openai_configured := EXISTS (
        SELECT 1 FROM public.system_ai_provider_settings 
        WHERE provider = 'openai' AND encrypted_api_key IS NOT NULL AND encrypted_api_key != ''
    );
    gemini_configured := EXISTS (
        SELECT 1 FROM public.system_ai_provider_settings 
        WHERE provider = 'gemini' AND encrypted_api_key IS NOT NULL AND encrypted_api_key != ''
    );
    anthropic_configured := EXISTS (
        SELECT 1 FROM public.system_ai_provider_settings 
        WHERE provider = 'anthropic' AND encrypted_api_key IS NOT NULL AND encrypted_api_key != ''
    );

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
        'is_active', cfg.is_active,
        'ai_enabled', cfg.ai_enabled,
        'ai_customer_suggestions_enabled', cfg.ai_customer_suggestions_enabled,
        'ai_sales_assistant_enabled', cfg.ai_sales_assistant_enabled,
        'ai_rag_enabled', cfg.ai_rag_enabled,
        'ai_rewrite_enabled', cfg.ai_rewrite_enabled,
        'ai_daily_limit', cfg.ai_daily_limit,
        'ai_cache_minutes', cfg.ai_cache_minutes,
        'openai_configured', openai_configured,
        'gemini_configured', gemini_configured,
        'anthropic_configured', anthropic_configured,
        'updated_at', cfg.updated_at
    );
END;
$$;
