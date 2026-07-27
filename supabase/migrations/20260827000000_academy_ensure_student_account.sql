-- Migration: Add Academy ensure current student account RPC and Schema Hardening

-- 1. Hardening: Change default status to pending_review
ALTER TABLE public.student_accounts
ALTER COLUMN status SET DEFAULT 'pending_review';

-- 2. Hardening: Ensure unique index on user_id (creates it if it somehow doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_accounts_user_id ON public.student_accounts (user_id);

-- 3. RPC: ensure_current_student_account
CREATE OR REPLACE FUNCTION public.ensure_current_student_account()
RETURNS public.student_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_student public.student_accounts;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Try to find existing student account
  SELECT *
  INTO v_student
  FROM public.student_accounts
  WHERE user_id = v_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN v_student;
  END IF;

  -- If not found, insert a new one with pending_review status
  INSERT INTO public.student_accounts (user_id, status)
  VALUES (v_user_id, 'pending_review')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_student;

  IF v_student IS NULL THEN
    -- If ON CONFLICT DO NOTHING triggered, it means it was inserted concurrently
    SELECT *
    INTO v_student
    FROM public.student_accounts
    WHERE user_id = v_user_id
    LIMIT 1;
  END IF;

  RETURN v_student;
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.ensure_current_student_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_current_student_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_student_account() TO authenticated;

-- Notify postgrest to reload schema
NOTIFY pgrst, 'reload schema';
