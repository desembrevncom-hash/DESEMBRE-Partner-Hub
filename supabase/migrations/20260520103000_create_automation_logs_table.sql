-- Migration: create automation_logs table
-- This migration creates the automation_logs table, indexes, and RLS policies.

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

-- Clean up existing policies if any to prevent "already exists" errors
DROP POLICY IF EXISTS "Admins manage automation logs" ON public.automation_logs;
DROP POLICY IF EXISTS "Allow authenticated insert logs" ON public.automation_logs;
DROP POLICY IF EXISTS "admin_can_view_all_logs" ON public.automation_logs;

-- Policies
-- Admin/Sub Admin can manage (select, insert, update, delete) all logs
CREATE POLICY "Admins manage automation logs" 
ON public.automation_logs 
FOR ALL 
TO authenticated 
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Allow any authenticated user to insert logs (since automation scripts run on user actions)
CREATE POLICY "Allow authenticated insert logs" 
ON public.automation_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Enable realtime if needed (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_logs;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
