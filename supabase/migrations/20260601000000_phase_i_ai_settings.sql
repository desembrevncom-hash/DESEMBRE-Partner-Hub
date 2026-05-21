-- Migration: Create ai_settings table (singleton)
CREATE TABLE IF NOT EXISTS public.ai_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    provider TEXT NOT NULL DEFAULT 'openai',
    chat_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    module_product_tutor BOOLEAN NOT NULL DEFAULT true,
    module_rewrite BOOLEAN NOT NULL DEFAULT true,
    module_customer_summary BOOLEAN NOT NULL DEFAULT true,
    module_sales_assistant BOOLEAN NOT NULL DEFAULT true,
    max_tokens INTEGER NOT NULL DEFAULT 800,
    temperature NUMERIC NOT NULL DEFAULT 0.3,
    system_tone TEXT NOT NULL DEFAULT 'professional_spa',
    daily_token_limit INTEGER,
    monthly_cost_limit NUMERIC,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure singleton row
INSERT INTO public.ai_settings (id)
SELECT 'default'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_settings WHERE id = 'default');

-- RLS policies: only admin/sub_admin can SELECT and UPDATE
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for admins and sub_admins" ON public.ai_settings;
CREATE POLICY "Enable read access for admins and sub_admins"
    ON public.ai_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'sub_admin')
        )
    );

DROP POLICY IF EXISTS "Enable update access for admins and sub_admins" ON public.ai_settings;
CREATE POLICY "Enable update access for admins and sub_admins"
    ON public.ai_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'sub_admin')
        )
    );

-- Trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_ai_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_settings_timestamp ON public.ai_settings;
CREATE TRIGGER update_ai_settings_timestamp
    BEFORE UPDATE ON public.ai_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_settings_timestamp();

-- RPC: get masked settings (no API keys)
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
    -- Access control: only admin / sub_admin
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'sub_admin')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT * INTO cfg FROM public.ai_settings WHERE id = 'default';

    openai_configured := (Deno.env.get('OPENAI_API_KEY') IS NOT NULL);
    gemini_configured := (Deno.env.get('GEMINI_API_KEY') IS NOT NULL);
    anthropic_configured := (Deno.env.get('ANTHROPIC_API_KEY') IS NOT NULL);

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
        'openai_key_configured', openai_configured,
        'gemini_key_configured', gemini_configured,
        'anthropic_key_configured', anthropic_configured
    );
END;
$$;
