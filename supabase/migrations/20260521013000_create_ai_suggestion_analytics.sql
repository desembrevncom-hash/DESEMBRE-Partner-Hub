-- Migration: Create ai_suggestion_analytics table for Phase 6.2C
-- Tracks AI suggestions shown, copied, used, and converted to orders.

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.ai_suggestion_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_type text NOT NULL, -- 'upsell', 'retention', 'follow_up', 'risk'
    suggestion_rule text NOT NULL, -- 'no_reorder_30d', 'inactive_customer', etc.
    suggested_products integer[],  -- Array of product_ids
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    sale_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'shown', -- 'shown', 'copied', 'used', 'converted'
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_analytics_customer_id ON public.ai_suggestion_analytics (customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_analytics_sale_user_id ON public.ai_suggestion_analytics (sale_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_analytics_status ON public.ai_suggestion_analytics (status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_analytics_created_at ON public.ai_suggestion_analytics (created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.ai_suggestion_analytics ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Admin/Sub Admin can view all analytics
DROP POLICY IF EXISTS "Admin and Sub Admin can view all ai suggestion analytics" ON public.ai_suggestion_analytics;
CREATE POLICY "Admin and Sub Admin can view all ai suggestion analytics"
ON public.ai_suggestion_analytics
FOR SELECT
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- Users can view their own analytics
DROP POLICY IF EXISTS "Users can view own ai suggestion analytics" ON public.ai_suggestion_analytics;
CREATE POLICY "Users can view own ai suggestion analytics"
ON public.ai_suggestion_analytics
FOR SELECT
TO authenticated
USING (sale_user_id = auth.uid());

-- Authenticated users can insert their own analytics logs
DROP POLICY IF EXISTS "Authenticated users can insert ai suggestion analytics" ON public.ai_suggestion_analytics;
CREATE POLICY "Authenticated users can insert ai suggestion analytics"
ON public.ai_suggestion_analytics
FOR INSERT
TO authenticated
WITH CHECK (sale_user_id = auth.uid());

-- Authenticated users can update their own analytics logs (e.g. from 'shown' to 'copied')
DROP POLICY IF EXISTS "Authenticated users can update own ai suggestion analytics" ON public.ai_suggestion_analytics;
CREATE POLICY "Authenticated users can update own ai suggestion analytics"
ON public.ai_suggestion_analytics
FOR UPDATE
TO authenticated
USING (sale_user_id = auth.uid())
WITH CHECK (sale_user_id = auth.uid());

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
