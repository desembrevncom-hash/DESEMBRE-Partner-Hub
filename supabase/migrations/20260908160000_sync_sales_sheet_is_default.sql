-- Migration: Add is_default column to product_sales_sheets and ensure parity with is_current
-- Phase: v1.4.1T.6 — Product Sales Sheet Versioning & Default Selection Parity

ALTER TABLE public.product_sales_sheets
ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Backfill is_default from is_current
UPDATE public.product_sales_sheets
SET is_default = is_current
WHERE is_default IS DISTINCT FROM is_current;

-- Unique partial index to ensure at most one default sheet per catalog product
CREATE UNIQUE INDEX IF NOT EXISTS uidx_product_sales_sheets_default_active
ON public.product_sales_sheets (catalog_product_id)
WHERE (is_default = true);

-- Update set_current_product_sales_sheet RPC to synchronize both is_current and is_default
CREATE OR REPLACE FUNCTION public.set_current_product_sales_sheet(p_sheet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid      uuid;
  v_catalog_product_id uuid;
  v_sheet_status    text;
BEGIN
  -- Identify caller
  v_caller_uid := auth.uid();

  -- Role guard (admin or sub_admin)
  IF NOT public.is_admin_or_sub_admin(v_caller_uid) THEN
    RAISE EXCEPTION 'Permission denied: admin or sub_admin role required to set current sales sheet'
      USING ERRCODE = '42501';
  END IF;

  -- Verify target sheet exists and acquire exclusive row lock
  SELECT catalog_product_id, status
    INTO v_catalog_product_id, v_sheet_status
    FROM public.product_sales_sheets
   WHERE id = p_sheet_id
     FOR UPDATE;

  IF v_catalog_product_id IS NULL THEN
    RAISE EXCEPTION 'set_current_product_sales_sheet: sheet_id % does not exist', p_sheet_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Enforce approved-only constraint
  IF v_sheet_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Only approved sales sheets can be set as current (current status: %)', v_sheet_status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Advisory lock on the product to serialize concurrent calls
  PERFORM pg_advisory_xact_lock(hashtext(v_catalog_product_id::text));

  -- Lock sibling rows
  PERFORM 1
    FROM public.product_sales_sheets
   WHERE catalog_product_id = v_catalog_product_id
     FOR UPDATE;

  -- Clear current & default on all other sheets for this product
  UPDATE public.product_sales_sheets
     SET is_current = false,
         is_default = false,
         updated_at = now()
   WHERE catalog_product_id = v_catalog_product_id
     AND id <> p_sheet_id
     AND (is_current = true OR is_default = true);

  -- Mark the target sheet as current and default
  UPDATE public.product_sales_sheets
     SET is_current = true,
         is_default = true,
         updated_at = now()
   WHERE id = p_sheet_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_current_product_sales_sheet(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_current_product_sales_sheet(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
