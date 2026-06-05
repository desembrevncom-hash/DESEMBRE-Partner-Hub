-- Migration: order_items snapshot columns & references (Phase v1.4.1E.1)
-- Timestamp: 20260804000000

-- A. Columns definition
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy_static';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS catalog_product_id uuid NULL REFERENCES public.catalog_products(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id uuid NULL REFERENCES public.catalog_product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS sku_snapshot text NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS brand_name_snapshot text NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name_snapshot text NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_label_snapshot text NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS channel_snapshot text NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_price_snapshot numeric NULL;

-- B. Constraints validation using DO block check of pg_constraint
DO $$
BEGIN
    -- Check order_items_source_check
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint con 
        JOIN pg_class cl ON cl.oid = con.conrelid 
        JOIN pg_namespace ns ON ns.oid = cl.relnamespace 
        WHERE con.conname = 'order_items_source_check' 
          AND cl.relname = 'order_items' 
          AND ns.nspname = 'public'
    ) THEN
        ALTER TABLE public.order_items ADD CONSTRAINT order_items_source_check CHECK (source IN ('legacy_static', 'db_catalog'));
    END IF;

    -- Check order_items_channel_snapshot_check
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint con 
        JOIN pg_class cl ON cl.oid = con.conrelid 
        JOIN pg_namespace ns ON ns.oid = cl.relnamespace 
        WHERE con.conname = 'order_items_channel_snapshot_check' 
          AND cl.relname = 'order_items' 
          AND ns.nspname = 'public'
    ) THEN
        ALTER TABLE public.order_items ADD CONSTRAINT order_items_channel_snapshot_check CHECK (channel_snapshot IS NULL OR channel_snapshot IN ('retail', 'salon'));
    END IF;

    -- Check order_items_unit_price_snapshot_check
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint con 
        JOIN pg_class cl ON cl.oid = con.conrelid 
        JOIN pg_namespace ns ON ns.oid = cl.relnamespace 
        WHERE con.conname = 'order_items_unit_price_snapshot_check' 
          AND cl.relname = 'order_items' 
          AND ns.nspname = 'public'
    ) THEN
        ALTER TABLE public.order_items ADD CONSTRAINT order_items_unit_price_snapshot_check CHECK (unit_price_snapshot IS NULL OR unit_price_snapshot >= 0);
    END IF;
END $$;

-- C. Backfill legacy rows (Defensive check to only set values if null or matching valid shapes)
UPDATE public.order_items
SET
    source = COALESCE(source, 'legacy_static'),
    product_name_snapshot = COALESCE(product_name_snapshot, product_name),
    unit_price_snapshot = COALESCE(unit_price_snapshot, unit_price),
    channel_snapshot = COALESCE(channel_snapshot, CASE WHEN size_type IN ('retail', 'salon') THEN size_type ELSE NULL END),
    variant_label_snapshot = COALESCE(variant_label_snapshot, CASE WHEN size_type IS NOT NULL AND size IS NOT NULL THEN size_type || ' ' || size ELSE size END),
    brand_name_snapshot = COALESCE(brand_name_snapshot, CASE WHEN product_no IS NOT NULL THEN 'Desembre' ELSE NULL END),
    sku_snapshot = COALESCE(sku_snapshot, CASE WHEN product_no IS NOT NULL AND size_type IS NOT NULL THEN 'DESEMBRE-' || product_no || '-' || UPPER(size_type) ELSE NULL END)
WHERE
    source IS NULL OR
    product_name_snapshot IS NULL OR
    unit_price_snapshot IS NULL OR
    channel_snapshot IS NULL OR
    variant_label_snapshot IS NULL OR
    brand_name_snapshot IS NULL OR
    sku_snapshot IS NULL;

-- D. Indexes creation
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_source ON public.order_items(source);
CREATE INDEX IF NOT EXISTS idx_order_items_catalog_product_id ON public.order_items(catalog_product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku_snapshot ON public.order_items(sku_snapshot);
