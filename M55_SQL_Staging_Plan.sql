-- M55 Customer Historical Revenue & Legacy LTV
-- STAGING SQL PLAN ONLY (Do NOT run on Production without approval)

ALTER TABLE "public"."customers" 
ADD COLUMN IF NOT EXISTS "historical_revenue_total" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "historical_order_count" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "historical_last_purchase_at" date,
ADD COLUMN IF NOT EXISTS "historical_revenue_note" text,
ADD COLUMN IF NOT EXISTS "historical_revenue_source" text,
ADD COLUMN IF NOT EXISTS "historical_revenue_updated_at" timestamptz;

-- Add constraints
ALTER TABLE "public"."customers" 
ADD CONSTRAINT "customers_historical_revenue_check" CHECK (historical_revenue_total >= 0);

ALTER TABLE "public"."customers" 
ADD CONSTRAINT "customers_historical_order_count_check" CHECK (historical_order_count >= 0);
