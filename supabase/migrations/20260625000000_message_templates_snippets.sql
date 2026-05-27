-- ============================================================================
-- MIGRATION: Phase C - Message Templates & Snippets
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    platform text NOT NULL CHECK (platform in ('zalo','facebook','email','phone','tiktok','all')),
    category text,
    content text NOT NULL,
    is_shared boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='title') THEN
    ALTER TABLE public.message_templates ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='platform') THEN
    ALTER TABLE public.message_templates ADD COLUMN platform text NOT NULL DEFAULT 'all';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='category') THEN
    ALTER TABLE public.message_templates ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='content') THEN
    ALTER TABLE public.message_templates ADD COLUMN content text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='is_active') THEN
    ALTER TABLE public.message_templates ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_templates' AND column_name='is_shared') THEN
    ALTER TABLE public.message_templates ADD COLUMN is_shared boolean DEFAULT false;
  END IF;
END $$;

-- RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS "Users can view templates" ON public.message_templates;
CREATE POLICY "Users can view templates" 
ON public.message_templates FOR SELECT 
TO authenticated 
USING (
    public.is_admin_or_sub_admin(auth.uid()) 
    OR is_shared = true 
    OR created_by = auth.uid()
);

-- Insert policy
DROP POLICY IF EXISTS "Users can insert own templates" ON public.message_templates;
CREATE POLICY "Users can insert own templates" 
ON public.message_templates FOR INSERT 
TO authenticated 
WITH CHECK (
    created_by = auth.uid() AND
    (public.is_admin_or_sub_admin(auth.uid()) OR platform != 'all')
);

-- Update policy
DROP POLICY IF EXISTS "Users can update own templates" ON public.message_templates;
CREATE POLICY "Users can update own templates" 
ON public.message_templates FOR UPDATE 
TO authenticated 
USING (
    public.is_admin_or_sub_admin(auth.uid()) OR created_by = auth.uid()
)
WITH CHECK (
    (public.is_admin_or_sub_admin(auth.uid()) OR created_by = auth.uid()) AND
    (public.is_admin_or_sub_admin(auth.uid()) OR platform != 'all')
);

-- Delete policy
DROP POLICY IF EXISTS "Users can delete own templates" ON public.message_templates;
CREATE POLICY "Users can delete own templates" 
ON public.message_templates FOR DELETE 
TO authenticated 
USING (
    public.is_admin_or_sub_admin(auth.uid()) OR created_by = auth.uid()
);

-- Seed templates (Admin created)
-- DO $$
-- DECLARE
--   v_admin_id uuid;
-- BEGIN
--   SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
--   IF v_admin_id IS NOT NULL THEN
--     INSERT INTO public.message_templates (title, platform, category, content, is_shared, created_by)
--     VALUES 
--     ('Follow-up sau tư vấn', 'all', 'Chăm sóc', 'Chào {{customer_name}}, mình là {{sale_name}} từ {{spa_name}}. Hôm trước tư vấn bạn thấy sao rồi ạ?', true, v_admin_id),
--     ('Gửi báo giá', 'all', 'Bán hàng', 'Dạ gửi {{customer_name}} báo giá chi tiết dịch vụ tại {{spa_name}} ạ.', true, v_admin_id),
--     ('Nhắc lịch hẹn', 'all', 'Chăm sóc', 'Dạ {{customer_name}} nhớ lịch hẹn tại {{spa_name}} vào ngày mai nhé ạ.', true, v_admin_id),
--     ('Chăm sóc sau mua', 'all', 'Chăm sóc', 'Chào {{customer_name}}, bạn dùng sản phẩm thấy thế nào rồi ạ?', true, v_admin_id),
--     ('Xin thông tin Zalo/Facebook', 'phone', 'Liên lạc', 'Dạ {{customer_name}} có dùng Zalo số này không để em gửi thông tin ạ?', true, v_admin_id)
--     ON CONFLICT DO NOTHING;
--   END IF;
-- END $$;


-- Harden log_communication_interaction
DROP FUNCTION IF EXISTS public.log_communication_interaction(uuid, text, uuid, text);
CREATE OR REPLACE FUNCTION public.log_communication_interaction(
    p_customer_id uuid,
    p_platform text,
    p_account_id uuid,
    p_interaction_type text DEFAULT 'outbound_message',
    p_template_id uuid DEFAULT NULL,
    p_template_title text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_account record;
    v_title text;
    v_metadata jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_metadata := jsonb_build_object('platform', p_platform);

    IF p_account_id IS NOT NULL THEN
        SELECT * INTO v_account FROM public.user_communication_accounts WHERE id = p_account_id;
        IF v_account IS NOT NULL THEN
            UPDATE public.user_communication_accounts 
            SET last_used_at = now() 
            WHERE id = p_account_id;
            v_metadata := jsonb_set(v_metadata, '{account_id}', to_jsonb(p_account_id));
        END IF;
    END IF;

    IF p_template_id IS NOT NULL THEN
        v_metadata := jsonb_set(v_metadata, '{template_id}', to_jsonb(p_template_id));
        IF p_template_title IS NOT NULL THEN
            v_metadata := jsonb_set(v_metadata, '{template_title}', to_jsonb(p_template_title));
            v_title := 'Đã mở ' || UPPER(p_platform) || ' + copy mẫu "' || p_template_title || '"';
        ELSE
            v_title := 'Đã mở ' || UPPER(p_platform) || ' + copy mẫu';
        END IF;
    ELSE
        v_title := 'Liên lạc qua ' || UPPER(p_platform);
    END IF;

    -- Log to customer_activities
    INSERT INTO public.customer_activities (
        customer_id,
        activity_type,
        title,
        content,
        created_by,
        metadata
    ) VALUES (
        p_customer_id,
        p_interaction_type,
        v_title,
        CASE 
            WHEN v_account IS NOT NULL THEN 'Sale đã sử dụng tài khoản: ' || v_account.account_name 
            ELSE 'Sale đã sử dụng ứng dụng ' || UPPER(p_platform) 
        END,
        v_user_id,
        v_metadata
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Làm mới schema cache
NOTIFY pgrst, 'reload schema';
