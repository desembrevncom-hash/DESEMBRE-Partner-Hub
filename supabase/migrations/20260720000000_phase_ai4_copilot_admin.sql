-- Add product copilot settings to ai_settings
ALTER TABLE public.ai_settings
ADD COLUMN product_copilot_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN product_copilot_sale_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN product_copilot_admin_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN product_copilot_require_context BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN product_copilot_daily_limit INTEGER NOT NULL DEFAULT 50;

-- Update the RPC to include these fields in get_ai_settings_masked
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
    -- So we remove the strict admin/sub_admin check here, but keep the API keys masked
    
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

-- Note: In 20260601000000_phase_i_ai_settings.sql, there was an RLS policy for select that restricted to admin/sub_admin.
-- We need to open read access for ai_settings for authenticated users so Copilot UI can check `product_copilot_enabled`.
DROP POLICY IF EXISTS "Enable read access for admins and sub_admins" ON public.ai_settings;
CREATE POLICY "Enable read access for authenticated users"
    ON public.ai_settings FOR SELECT
    USING (auth.role() = 'authenticated');


-- Create table for Quick Replies
CREATE TABLE IF NOT EXISTS public.product_copilot_quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    requires_context BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.product_copilot_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
    ON public.product_copilot_quick_replies FOR SELECT 
    USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Enable full access for admins" 
    ON public.product_copilot_quick_replies FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'sub_admin')
        )
    );

-- Insert default quick replies
INSERT INTO public.product_copilot_quick_replies (title, prompt, category, requires_context, sort_order)
VALUES 
    ('Phác đồ trị mụn', 'Phác đồ trị mụn', 'general', false, 1),
    ('Routine da dầu', 'Routine da dầu', 'general', false, 2),
    ('So sánh kem chống nắng', 'So sánh kem chống nắng', 'general', false, 3),
    ('Phục hồi sau treatment', 'Phục hồi sau treatment', 'general', false, 4),
    ('Thành phần tế bào gốc', 'Thành phần tế bào gốc', 'general', false, 5),
    ('Gợi ý phác đồ phù hợp', 'Dựa trên tình trạng khách hàng này, gợi ý phác đồ phù hợp nhất', 'context', true, 1),
    ('Gợi ý sản phẩm upsell', 'Gợi ý các sản phẩm có thể upsell cho khách hàng này', 'context', true, 2),
    ('Gợi ý câu trả lời Zalo', 'Viết một đoạn ngắn gọn, thân thiện hỏi thăm tình trạng da khách hàng này để gửi qua Zalo', 'context', true, 3),
    ('Kiểm tra chống chỉ định', 'Khách hàng này có cần lưu ý chống chỉ định sản phẩm nào không?', 'context', true, 4);
