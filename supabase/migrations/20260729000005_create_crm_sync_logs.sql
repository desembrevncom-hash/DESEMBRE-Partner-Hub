-- Migration to create crm_sync_logs table for Google Sheet Mirror

CREATE TABLE IF NOT EXISTS public.crm_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'google_sheets',
    target TEXT,
    status TEXT NOT NULL DEFAULT 'processing',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_status ON public.crm_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_created_at ON public.crm_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_provider ON public.crm_sync_logs(provider);

-- RLS Policies
ALTER TABLE public.crm_sync_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "Admins can view sync logs" ON public.crm_sync_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'sub_admin')
        )
    );

-- Service role can do anything
CREATE POLICY "Service role can manage sync logs" ON public.crm_sync_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
