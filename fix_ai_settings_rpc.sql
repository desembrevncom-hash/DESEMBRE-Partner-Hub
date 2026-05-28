-- ==============================================================
-- FIX AI SETTINGS RPC SCRIPT
-- ==============================================================
-- Mục đích: Sửa lỗi hàm get_ai_settings_masked bị lỗi do migration 
-- 20260720000000_phase_ai4_copilot_admin.sql ghi đè gây ra 2 vấn đề:
-- 1. Lỗi cú pháp Deno.env.get() không hợp lệ trong PL/pgSQL.
-- 2. Bị mất các cột cấu hình AI Governance (ai_enabled, ai_daily_limit...).
-- ==============================================================

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
    -- Cho phép bất kỳ user đã đăng nhập nào đọc settings (để render UI)
    SELECT * INTO cfg FROM public.ai_settings WHERE id = 'default';

    -- Sửa lỗi Deno.env.get() thành kiểm tra trực tiếp cột trong DB
    openai_configured := (cfg.openai_api_key IS NOT NULL AND cfg.openai_api_key != '');
    gemini_configured := (cfg.gemini_api_key IS NOT NULL AND cfg.gemini_api_key != '');
    anthropic_configured := (cfg.anthropic_api_key IS NOT NULL AND cfg.anthropic_api_key != '');

    RETURN jsonb_build_object(
        'provider', cfg.provider,
        'chat_model', cfg.chat_model,
        'embedding_model', cfg.embedding_model,
        'module_product_tutor', cfg.module_product_tutor,
        'module_rewrite', cfg.module_rewrite,
        'module_customer_summary', cfg.module_customer_summary,
        'module_sales_assistant', cfg.module_sales_assistant,
        
        -- Các cột AI Governance (bị mất ở migration cũ)
        'ai_enabled', cfg.ai_enabled,
        'ai_customer_suggestions_enabled', cfg.ai_customer_suggestions_enabled,
        'ai_sales_assistant_enabled', cfg.ai_sales_assistant_enabled,
        'ai_rag_enabled', cfg.ai_rag_enabled,
        'ai_rewrite_enabled', cfg.ai_rewrite_enabled,
        'ai_daily_limit', cfg.ai_daily_limit,
        'ai_cache_minutes', cfg.ai_cache_minutes,

        -- Các cột Product Copilot
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
        
        'openai_key_configured', openai_configured,
        'gemini_key_configured', gemini_configured,
        'anthropic_key_configured', anthropic_configured
    );
END;
$$;
