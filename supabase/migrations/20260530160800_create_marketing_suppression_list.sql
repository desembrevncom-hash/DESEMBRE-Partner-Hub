-- Migration: Create Marketing Suppression List

CREATE TABLE IF NOT EXISTS public.marketing_suppression_list (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel text NOT NULL, -- 'email' | 'phone' | 'zalo_id'
    contact_value text NOT NULL, -- Original value
    normalized_contact_value text NOT NULL, -- Normalized for exact matching
    reason text NOT NULL, -- 'bounced' | 'complaint' | 'manual_block' | 'unsubscribe' | 'invalid_contact' | 'provider_block'
    note text,
    source text DEFAULT 'manual',
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance and uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_suppression_unique_active 
    ON public.marketing_suppression_list (channel, normalized_contact_value) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_marketing_suppression_channel 
    ON public.marketing_suppression_list (channel);

CREATE INDEX IF NOT EXISTS idx_marketing_suppression_reason 
    ON public.marketing_suppression_list (reason);

CREATE INDEX IF NOT EXISTS idx_marketing_suppression_created_at 
    ON public.marketing_suppression_list (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_suppression_active 
    ON public.marketing_suppression_list (is_active);

-- Enable RLS
ALTER TABLE public.marketing_suppression_list ENABLE ROW LEVEL SECURITY;

-- Policy: Admin/Sub-admin can manage
CREATE POLICY "Admin and sub-admin can manage suppression list"
    ON public.marketing_suppression_list
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'sub_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'sub_admin')
        )
    );

-- Policy: Select for edge functions (service_role bypasses RLS anyway, but for good measure)
-- Note: Supabase edge functions using SUPABASE_SERVICE_ROLE_KEY bypass RLS.
