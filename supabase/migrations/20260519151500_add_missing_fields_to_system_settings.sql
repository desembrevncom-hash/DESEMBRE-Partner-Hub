-- Migration: Add missing B2B rules and product cycles columns to system_settings table
ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS lead_overdue_days integer DEFAULT 3,
    ADD COLUMN IF NOT EXISTS gold_threshold numeric DEFAULT 50000000,
    ADD COLUMN IF NOT EXISTS gold_discount numeric DEFAULT 62,
    ADD COLUMN IF NOT EXISTS diamond_threshold numeric DEFAULT 100000000,
    ADD COLUMN IF NOT EXISTS diamond_discount numeric DEFAULT 65,
    ADD COLUMN IF NOT EXISTS refill_cycle_days integer DEFAULT 60,
    ADD COLUMN IF NOT EXISTS product_cycles jsonb DEFAULT '{}'::jsonb;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
