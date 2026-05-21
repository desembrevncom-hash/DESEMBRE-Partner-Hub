-- Migration: Create ai_assistant_logs table for tracking AI usage
-- Phase 6.1: AI Customer Summary

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.ai_assistant_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    task_id uuid REFERENCES public.customer_tasks(id) ON DELETE SET NULL,
    mode text NOT NULL,
    status text NOT NULL DEFAULT 'success',
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_ai_assistant_logs_user_id ON public.ai_assistant_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_logs_customer_id ON public.ai_assistant_logs (customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_logs_mode ON public.ai_assistant_logs (mode);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_logs_created_at ON public.ai_assistant_logs (created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.ai_assistant_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Admin/Sub Admin can view all logs
DROP POLICY IF EXISTS "Admin and Sub Admin can view all ai logs" ON public.ai_assistant_logs;
CREATE POLICY "Admin and Sub Admin can view all ai logs"
ON public.ai_assistant_logs
FOR SELECT
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Users can view their own logs
DROP POLICY IF EXISTS "Users can view own ai logs" ON public.ai_assistant_logs;
CREATE POLICY "Users can view own ai logs"
ON public.ai_assistant_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Insert is done via service role (Edge Function), but allow authenticated insert for flexibility
DROP POLICY IF EXISTS "Authenticated users can insert ai logs" ON public.ai_assistant_logs;
CREATE POLICY "Authenticated users can insert ai logs"
ON public.ai_assistant_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
