-- Migration: Add Quality Control (Feedback Loop) fields to ai_suggestion_analytics
-- Phase 6.3

ALTER TABLE public.ai_suggestion_analytics
ADD COLUMN IF NOT EXISTS converted_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS converted_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS ignored boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS used_in_activity uuid REFERENCES public.customer_activities(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS conversion_status text DEFAULT 'pending';

-- Update the existing status column check if it exists (Optional, just to ensure consistency)
-- But we'll rely on app logic for now.

-- Create indexes for the new columns to speed up future analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_analytics_converted_order_id ON public.ai_suggestion_analytics (converted_order_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_analytics_conversion_status ON public.ai_suggestion_analytics (conversion_status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_analytics_ignored ON public.ai_suggestion_analytics (ignored);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
