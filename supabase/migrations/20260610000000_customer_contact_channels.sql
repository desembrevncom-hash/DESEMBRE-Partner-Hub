-- ================================================================
-- Migration: Customer Contact Channels
-- Date: 2026-06-10
-- ================================================================

-- 1. Helper Function RLS: can_view_customer
CREATE OR REPLACE FUNCTION public.can_view_customer(p_customer_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin boolean;
    v_has_access boolean;
BEGIN
    -- Check if admin or sub_admin
    v_is_admin := public.is_admin_or_sub_admin(p_user_id);
    IF v_is_admin THEN
        RETURN true;
    END IF;

    -- Check if user is owner_sale_id or owner_tele_id
    SELECT EXISTS (
        SELECT 1 FROM public.customers
        WHERE id = p_customer_id
          AND (owner_sale_id = p_user_id OR owner_tele_id = p_user_id)
    ) INTO v_has_access;

    IF v_has_access THEN
        RETURN true;
    END IF;

    -- Check if user has an assigned task for this customer
    SELECT EXISTS (
        SELECT 1 FROM public.customer_tasks
        WHERE customer_id = p_customer_id
          AND assigned_to = p_user_id
    ) INTO v_has_access;

    RETURN v_has_access;
END;
$$;

-- 2. Create customer_contact_channels Table
CREATE TABLE IF NOT EXISTS public.customer_contact_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    channel_type text NOT NULL,
    channel_value text NOT NULL,
    normalized_value text,
    external_id text,
    username text,
    profile_type text DEFAULT 'unknown',
    scope text NOT NULL DEFAULT 'private',
    visibility text NOT NULL DEFAULT 'private',
    is_verified boolean DEFAULT false,
    verified_at timestamptz,
    resolve_status text DEFAULT 'pending',
    resolve_error text,
    source text DEFAULT 'manual',
    owner_user_id uuid REFERENCES auth.users(id),
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id),
    remarketing_enabled boolean DEFAULT false,
    consent_status text DEFAULT 'unknown',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Check Constraints
ALTER TABLE public.customer_contact_channels ADD CONSTRAINT check_channel_type 
    CHECK (channel_type IN ('facebook','zalo','email','tiktok','instagram','website','youtube','whatsapp','other'));

ALTER TABLE public.customer_contact_channels ADD CONSTRAINT check_scope 
    CHECK (scope IN ('official','private'));

ALTER TABLE public.customer_contact_channels ADD CONSTRAINT check_visibility 
    CHECK (visibility IN ('official','team','private'));

ALTER TABLE public.customer_contact_channels ADD CONSTRAINT check_resolve_status 
    CHECK (resolve_status IN ('pending','verified','failed','manual'));

ALTER TABLE public.customer_contact_channels ADD CONSTRAINT check_consent_status 
    CHECK (consent_status IN ('unknown','consented','not_consented'));

-- 4. Indexes & Unique Constraint
CREATE INDEX IF NOT EXISTS idx_customer_contact_channels_customer_id ON public.customer_contact_channels(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contact_channels_channel_type ON public.customer_contact_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_customer_contact_channels_scope ON public.customer_contact_channels(scope);
CREATE INDEX IF NOT EXISTS idx_customer_contact_channels_owner_user_id ON public.customer_contact_channels(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_contact_channels_normalized_value ON public.customer_contact_channels(normalized_value);
CREATE INDEX IF NOT EXISTS idx_customer_contact_channels_external_id ON public.customer_contact_channels(external_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_contact_channel_normalized
ON public.customer_contact_channels(customer_id, channel_type, normalized_value, scope, owner_user_id)
WHERE normalized_value IS NOT NULL;

-- 5. RLS Policies
ALTER TABLE public.customer_contact_channels ENABLE ROW LEVEL SECURITY;

-- Admin/Sub Admin: Select
CREATE POLICY "Admin can view all contact channels"
ON public.customer_contact_channels
FOR SELECT
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Admin/Sub Admin: Insert/Update/Delete
CREATE POLICY "Admin can manage all contact channels"
ON public.customer_contact_channels
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Sales: Select
CREATE POLICY "Sales can view official and their own private channels"
ON public.customer_contact_channels
FOR SELECT
TO authenticated
USING (
    (scope = 'official' AND public.can_view_customer(customer_id, auth.uid()))
    OR 
    (scope = 'private' AND owner_user_id = auth.uid())
);

-- Sales: Insert
CREATE POLICY "Sales can insert private channels"
ON public.customer_contact_channels
FOR INSERT
TO authenticated
WITH CHECK (
    scope = 'private' 
    AND owner_user_id = auth.uid() 
    AND created_by = auth.uid()
);

-- Sales: Update
CREATE POLICY "Sales can update their own private channels"
ON public.customer_contact_channels
FOR UPDATE
TO authenticated
USING (scope = 'private' AND owner_user_id = auth.uid())
WITH CHECK (scope = 'private' AND owner_user_id = auth.uid());

-- Sales: Delete
CREATE POLICY "Sales can delete their own private channels"
ON public.customer_contact_channels
FOR DELETE
TO authenticated
USING (scope = 'private' AND owner_user_id = auth.uid());

-- Grant access to Edge Functions (service role bypasses RLS naturally, but authenticated calls need standard rights if acting on behalf of user)
GRANT ALL ON TABLE public.customer_contact_channels TO authenticated;
GRANT ALL ON TABLE public.customer_contact_channels TO service_role;

-- Create custom trigger function for updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_customer_contact_channels
BEFORE UPDATE ON public.customer_contact_channels
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
