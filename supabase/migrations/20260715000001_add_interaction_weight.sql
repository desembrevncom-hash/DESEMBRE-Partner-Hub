-- Add interaction_weight and interaction_quality to prepare for unified touchpoint KPI model
ALTER TABLE public.customer_interactions
ADD COLUMN IF NOT EXISTS interaction_weight integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS interaction_quality varchar(50) DEFAULT 'standard';

ALTER TABLE public.customer_activities
ADD COLUMN IF NOT EXISTS interaction_weight integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS interaction_quality varchar(50) DEFAULT 'standard';
