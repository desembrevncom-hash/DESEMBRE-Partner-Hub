-- Migration: Phase P4 - Production Hardening

-- 1. Create app_error_logs
CREATE TABLE IF NOT EXISTS public.app_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    page_key TEXT,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for app_error_logs
ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can insert their own errors (or anonymous if unauthenticated but let's allow authenticated to insert for themselves)
-- Actually, sometimes errors happen before auth is fully loaded, so let's allow insert for authenticated
CREATE POLICY "Allow authenticated users to insert their own error logs" 
    ON public.app_error_logs FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all error logs
CREATE POLICY "Allow admin to view all error logs" 
    ON public.app_error_logs FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND (user_roles.role = 'admin' OR user_roles.role = 'sub_admin')
        )
    );


-- 2. Create client_retry_queue
CREATE TABLE IF NOT EXISTS public.client_retry_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed
    retry_count INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for client_retry_queue
ALTER TABLE public.client_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to insert retry queue" 
    ON public.client_retry_queue FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to view own retry queue" 
    ON public.client_retry_queue FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "Allow users to update own retry queue" 
    ON public.client_retry_queue FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all retry queues
CREATE POLICY "Allow admin to view all retry queues" 
    ON public.client_retry_queue FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND (user_roles.role = 'admin' OR user_roles.role = 'sub_admin')
        )
    );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_client_retry_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_client_retry_queue_modtime
BEFORE UPDATE ON public.client_retry_queue
FOR EACH ROW EXECUTE FUNCTION update_client_retry_queue_updated_at();
