-- Migration: Add versioning and is_current columns to product_sales_sheets
-- Phase: v1.4.1T.4

ALTER TABLE public.product_sales_sheets
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;

-- Backfill existing rows: for each catalog_product_id, mark the latest created sheet as is_current = true
WITH latest_sheets AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY catalog_product_id ORDER BY created_at DESC) as rn
  FROM public.product_sales_sheets
)
UPDATE public.product_sales_sheets pss
SET is_current = true
FROM latest_sheets ls
WHERE pss.id = ls.id AND ls.rn = 1;

-- Index for searching version history
CREATE INDEX IF NOT EXISTS idx_product_sales_sheets_version_lookup
ON public.product_sales_sheets(catalog_product_id, version);

-- Index for searching active current sheet
CREATE INDEX IF NOT EXISTS idx_product_sales_sheets_active_lookup
ON public.product_sales_sheets(catalog_product_id, is_current);

-- Unique index to guarantee at most one current version per catalog product
CREATE UNIQUE INDEX IF NOT EXISTS uidx_product_sales_sheets_current_active
ON public.product_sales_sheets (catalog_product_id)
WHERE (is_current = true);
