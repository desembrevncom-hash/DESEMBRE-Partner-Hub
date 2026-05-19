-- Migration: Add missing B2B profile columns (bed_count, staff_count, tech_equipment, spa_equipment) to customers table
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS bed_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS staff_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tech_equipment text DEFAULT '',
    ADD COLUMN IF NOT EXISTS spa_equipment text[] DEFAULT '{}';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
