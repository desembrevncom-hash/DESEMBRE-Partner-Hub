-- Create the event tracking table
CREATE TABLE IF NOT EXISTS public.marketing_send_job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.marketing_send_jobs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'created', 'safety_blocked', 'approved', 'sending', 'sent', 
            'failed', 'delivered', 'bounced', 'opened', 'clicked', 'complained'
        )
    ),
    provider TEXT NOT NULL DEFAULT 'resend',
    provider_message_id TEXT,
    provider_event_id TEXT,
    event_fingerprint TEXT,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance and uniqueness constraints
CREATE INDEX IF NOT EXISTS idx_marketing_send_job_events_job_occurred ON public.marketing_send_job_events(job_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_marketing_send_job_events_msg_id ON public.marketing_send_job_events(provider_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_send_job_events_uniq_provider_evt 
    ON public.marketing_send_job_events(provider, provider_event_id) 
    WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_send_job_events_uniq_fingerprint
    ON public.marketing_send_job_events(provider, event_fingerprint)
    WHERE event_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_send_job_events_type ON public.marketing_send_job_events(event_type);
CREATE INDEX IF NOT EXISTS idx_marketing_send_job_events_occurred_desc ON public.marketing_send_job_events(occurred_at DESC);

-- Enable RLS
ALTER TABLE public.marketing_send_job_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for manual Staging execution safety)
DROP POLICY IF EXISTS "Admins can select all events" ON public.marketing_send_job_events;
DROP POLICY IF EXISTS "Users can select events for their own jobs" ON public.marketing_send_job_events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.marketing_send_job_events;
DROP POLICY IF EXISTS "Admins can update events" ON public.marketing_send_job_events;

-- RLS Policies

CREATE POLICY "Admins can select all events" 
ON public.marketing_send_job_events FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
);

CREATE POLICY "Users can select events for their own jobs" 
ON public.marketing_send_job_events FOR SELECT TO authenticated
USING (
    job_id IN (
        SELECT id FROM public.marketing_send_jobs WHERE created_by = auth.uid()
    )
);

CREATE POLICY "Admins can insert events" 
ON public.marketing_send_job_events FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
);

CREATE POLICY "Admins can update events" 
ON public.marketing_send_job_events FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.role::text IN ('admin', 'sub_admin')
    )
);

-- Explicitly no DELETE policy provided to ensure append-only/immutability.
