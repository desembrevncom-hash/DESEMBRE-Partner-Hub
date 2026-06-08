-- Migration: Transactional RPC for setting the current/default product sales sheet version
-- Phase: v1.4.1T.5 — Sales Sheet Production Hardening & Promotion Gate
-- Branch: feature/t2-ai-product-sales-sheet
--
-- KEY CORRECTION vs first draft:
--   The user profile table (public.profiles) does NOT have a 'role' column.
--   Roles are stored exclusively in public.user_roles (user_id, role app_role).
--   The existing helper public.is_admin_or_sub_admin(uuid) already encapsulates
--   the correct role check against user_roles and is reused here.
--
-- SECURITY DEFINER behaviour:
--   Because SECURITY DEFINER bypasses the caller's RLS context, this function
--   explicitly checks the caller's role before touching any data.
--   Only admin / sub_admin roles may proceed; all others receive SQLSTATE 42501
--   (insufficient_privilege).
--
-- Concurrency safety:
--   1. SELECT ... FOR UPDATE on the target sheet row — row-level exclusive lock.
--   2. pg_advisory_xact_lock on the catalog_product_id hash — serialises
--      concurrent calls for the same product across sessions.
--   3. PERFORM ... FOR UPDATE on all sibling rows — locks them before update.
--   All three UPDATEs share the same transaction; rollback is automatic on error.

-- Drop previous definition if it exists (idempotent, safe to re-run)
DROP FUNCTION IF EXISTS public.set_current_product_sales_sheet(uuid);

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
  -- ── Step 0: Identify caller ──────────────────────────────────────────────────
  v_caller_uid := auth.uid();

  -- ── Step 1: Role guard (explicit, inside SECURITY DEFINER) ─────────────────
  -- Roles are in public.user_roles (user_id, role::app_role).
  -- The existing is_admin_or_sub_admin() helper queries user_roles and is
  -- itself SECURITY DEFINER, so it works regardless of the caller's RLS context.
  IF NOT public.is_admin_or_sub_admin(v_caller_uid) THEN
    RAISE EXCEPTION 'Permission denied: admin or sub_admin role required to set current sales sheet'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- ── Step 2: Verify target sheet exists and acquire exclusive row lock ───────
  -- FOR UPDATE locks the row immediately so no other session can modify it
  -- in the window between our SELECT and the subsequent UPDATEs.
  SELECT catalog_product_id, status
    INTO v_catalog_product_id, v_sheet_status
    FROM public.product_sales_sheets
   WHERE id = p_sheet_id
     FOR UPDATE;

  IF v_catalog_product_id IS NULL THEN
    RAISE EXCEPTION 'set_current_product_sales_sheet: sheet_id % does not exist', p_sheet_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── Step 3: Enforce approved-only constraint ─────────────────────────────────
  -- Only approved sheets should be the "current" version shown to sales staff.
  IF v_sheet_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Only approved sales sheets can be set as current (current status: %)', v_sheet_status
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Step 4: Advisory lock on the product — serialises concurrent calls ───────
  -- hashtext() maps the UUID text to a bigint for the advisory lock namespace.
  -- This prevents two concurrent calls for the same product from racing past
  -- Step 5 simultaneously even if they hold row locks on different rows.
  PERFORM pg_advisory_xact_lock(hashtext(v_catalog_product_id::text));

  -- ── Step 5: Lock all sibling rows for this product ──────────────────────────
  -- Ensures no other concurrent session can update is_current on sibling sheets
  -- between our reset (Step 6) and our set (Step 7).
  PERFORM 1
    FROM public.product_sales_sheets
   WHERE catalog_product_id = v_catalog_product_id
     FOR UPDATE;

  -- ── Step 6: Clear is_current on all other sheets for this product ────────────
  -- Exclude the target sheet itself — this avoids accidentally clearing it
  -- if it was already current, and also avoids a redundant UPDATE.
  -- We clear BEFORE setting to satisfy the partial unique index:
  --   uidx_product_sales_sheets_current_active (catalog_product_id) WHERE is_current = true
  UPDATE public.product_sales_sheets
     SET is_current = false,
         updated_at = now()
   WHERE catalog_product_id = v_catalog_product_id
     AND id <> p_sheet_id
     AND is_current = true;

  -- ── Step 7: Mark the target sheet as current ─────────────────────────────────
  UPDATE public.product_sales_sheets
     SET is_current = true,
         updated_at = now()
   WHERE id = p_sheet_id;

  -- Steps 1–7 all execute in the same plpgsql transaction.
  -- If any step raises an exception, all changes are automatically rolled back.
END;
$$;

-- ── Permissions ───────────────────────────────────────────────────────────────
-- Revoke from PUBLIC (deny all by default), then grant only to authenticated.
-- The internal role check (Step 1) further restricts to admin/sub_admin.
REVOKE ALL ON FUNCTION public.set_current_product_sales_sheet(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_current_product_sales_sheet(uuid) TO authenticated;

-- ── Notify PostgREST to reload schema cache ───────────────────────────────────
NOTIFY pgrst, 'reload schema';
