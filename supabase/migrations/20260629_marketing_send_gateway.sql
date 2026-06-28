-- ============================================================
-- M17: Real Send Gateway / Controlled Provider Execution
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_send_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel text NOT NULL CHECK (channel IN ('email', 'zalo')),
    provider text NOT NULL DEFAULT 'mock',
    recipient_email text,
    recipient_phone text,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
    workflow_id uuid,
    template_id uuid,
    payload jsonb NOT NULL DEFAULT '{}',
    idempotency_key text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'safety_blocked', 'sending', 'sent', 'failed', 'skipped')),
    safety_result jsonb NOT NULL DEFAULT '{}',
    provider_message_id text,
    provider_error_code text,
    provider_error_message text,
    approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    CONSTRAINT require_recipient CHECK (
        recipient_email IS NOT NULL OR 
        recipient_phone IS NOT NULL OR 
        customer_id IS NOT NULL
    )
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_marketing_send_jobs_status ON public.marketing_send_jobs(status);
CREATE INDEX IF NOT EXISTS idx_marketing_send_jobs_created_at ON public.marketing_send_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_send_jobs_customer ON public.marketing_send_jobs(customer_id);

-- RLS
ALTER TABLE public.marketing_send_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all send jobs" 
    ON public.marketing_send_jobs FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'sub_admin')
        )
    );

CREATE POLICY "Users can read own send jobs" 
    ON public.marketing_send_jobs FOR SELECT 
    USING (created_by = auth.uid());

CREATE POLICY "Authenticated users can insert send jobs" 
    ON public.marketing_send_jobs FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update send jobs" 
    ON public.marketing_send_jobs FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'sub_admin')
        )
    );
