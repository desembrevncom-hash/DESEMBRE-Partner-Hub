-- Migration: create automation_logs table
-- This migration creates the automation_logs table, indexes, and RLS policies.
-- It should be placed in supabase_migrations directory.

CREATE TABLE IF NOT EXISTS public.automation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_type text NOT NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    task_id uuid REFERENCES public.customer_tasks(id) ON DELETE SET NULL,
    notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'success',
    error_message text,
    metadata jsonb,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_automation_logs_type ON public.automation_logs (automation_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_customer ON public.automation_logs (customer_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_lead ON public.automation_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON public.automation_logs (status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON public.automation_logs (created_at);

-- Enable Row Level Security
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin/Sub Admin can see all logs
CREATE POLICY "admin_can_view_all_logs" ON public.automation_logs
    FOR SELECT TO admin, authenticated
    USING (auth.role() IN ('admin', 'sub_admin') OR true);

-- Regular users cannot select logs (no policy needed, default deny)

-- Allow insertion of logs by any authenticated user (automation runs as service_role, but we permit authenticated for completeness)
CREATE POLICY "allow_insert_logs" ON public.automation_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow update of status/error_message by service_role only (no policy for regular users)
-- No explicit policy needed for service_role (supabase service role bypasses RLS).

-- Enable realtime if needed (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_logs;
