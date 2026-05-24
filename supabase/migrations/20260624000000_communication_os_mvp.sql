-- ============================================================================
-- MIGRATION: Phase A + B - Communication OS MVP
-- ============================================================================

-- 1. Create user_communication_accounts table
CREATE TABLE IF NOT EXISTS public.user_communication_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    platform text NOT NULL CHECK (platform in ('zalo', 'facebook', 'email', 'phone', 'tiktok')),
    account_name text NOT NULL,
    account_identifier text,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    last_used_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure only one default account per platform per user
DROP INDEX IF EXISTS user_comm_accounts_default_idx;
CREATE UNIQUE INDEX user_comm_accounts_default_idx 
ON public.user_communication_accounts(user_id, platform) 
WHERE is_default = true;

-- RLS
ALTER TABLE public.user_communication_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own accounts" ON public.user_communication_accounts;
CREATE POLICY "Users can view own accounts" 
ON public.user_communication_accounts FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id OR public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own accounts" ON public.user_communication_accounts;
CREATE POLICY "Users can insert own accounts" 
ON public.user_communication_accounts FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id OR public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update own accounts" ON public.user_communication_accounts;
CREATE POLICY "Users can update own accounts" 
ON public.user_communication_accounts FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id OR public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own accounts" ON public.user_communication_accounts;
CREATE POLICY "Users can delete own accounts" 
ON public.user_communication_accounts FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id OR public.is_admin_or_sub_admin(auth.uid()));

-- 2. RPC for logging interaction
DROP FUNCTION IF EXISTS public.log_communication_interaction(uuid, text, uuid, text);
CREATE OR REPLACE FUNCTION public.log_communication_interaction(
    p_customer_id uuid,
    p_platform text,
    p_account_id uuid,
    p_interaction_type text DEFAULT 'outbound_message'
) RETURNS jsonb AS $$
DECLARE
    v_user_id uuid;
    v_account record;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_account_id IS NOT NULL THEN
        SELECT * INTO v_account FROM public.user_communication_accounts WHERE id = p_account_id;
        IF v_account IS NOT NULL THEN
            UPDATE public.user_communication_accounts 
            SET last_used_at = now() 
            WHERE id = p_account_id;
        END IF;
    END IF;

    -- Log to customer_activities
    INSERT INTO public.customer_activities (
        customer_id,
        activity_type,
        title,
        content,
        created_by
    ) VALUES (
        p_customer_id,
        p_interaction_type,
        'Liên lạc qua ' || UPPER(p_platform),
        CASE 
            WHEN v_account IS NOT NULL THEN 'Sale đã sử dụng tài khoản: ' || v_account.account_name 
            ELSE 'Sale đã sử dụng ứng dụng ' || UPPER(p_platform) 
        END,
        v_user_id
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Làm mới schema cache
NOTIFY pgrst, 'reload schema';
