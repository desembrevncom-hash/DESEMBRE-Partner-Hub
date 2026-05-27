-- Migration: 20260717000000_pilot_uat_observation.sql

CREATE TABLE IF NOT EXISTS public.pilot_feedback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    page_key TEXT NOT NULL,
    action_key TEXT,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'slow', 'confusing', 'missing_feature', 'other')),
    feedback_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pilot_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT,
    page_key TEXT NOT NULL,
    action_key TEXT NOT NULL,
    metric_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.pilot_feedback_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback" ON public.pilot_feedback_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all feedback" ON public.pilot_feedback_logs FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin'))
);

CREATE POLICY "Users can insert their own metrics" ON public.pilot_usage_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all metrics" ON public.pilot_usage_metrics FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin'))
);

-- RPC for inserting metrics easily
CREATE OR REPLACE FUNCTION log_pilot_usage_metric(
    p_page_key TEXT,
    p_action_key TEXT,
    p_metric_data JSONB DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.pilot_usage_metrics (user_id, session_id, page_key, action_key, metric_data)
    VALUES (auth.uid(), current_setting('request.jwt.claims', true)::jsonb->>'session_id', p_page_key, p_action_key, p_metric_data);
END;
$$;

-- RPC for inserting feedback easily
CREATE OR REPLACE FUNCTION log_pilot_feedback(
    p_page_key TEXT,
    p_feedback_type TEXT,
    p_feedback_note TEXT,
    p_action_key TEXT DEFAULT NULL,
    p_customer_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.pilot_feedback_logs (user_id, customer_id, page_key, action_key, feedback_type, feedback_note)
    VALUES (auth.uid(), p_customer_id, p_page_key, p_action_key, p_feedback_type, p_feedback_note);
END;
$$;
