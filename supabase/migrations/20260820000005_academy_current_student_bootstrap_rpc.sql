-- Migration: Add Academy current student bootstrap RPC

CREATE OR REPLACE FUNCTION public.get_current_student_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_student record;
  v_customer record;
  v_active_membership record;
  v_expired_membership record;
  v_now timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_now := now();

  -- 1. Find student account
  SELECT id, user_id, customer_id
  INTO v_student
  FROM public.student_accounts
  WHERE user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'state', 'NO_STUDENT_ACCOUNT',
      'student_account', null,
      'customer', null,
      'active_membership', null,
      'tier', null,
      'latest_expired_membership', null
    );
  END IF;

  -- 2. Find customer
  IF v_student.customer_id IS NULL THEN
    RETURN jsonb_build_object(
      'state', 'NO_CUSTOMER',
      'student_account', jsonb_build_object('id', v_student.id, 'user_id', v_student.user_id, 'customer_id', v_student.customer_id),
      'customer', null,
      'active_membership', null,
      'tier', null,
      'latest_expired_membership', null
    );
  END IF;

  SELECT id, name, email, phone, status
  INTO v_customer
  FROM public.customers
  WHERE id = v_student.customer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'state', 'NO_CUSTOMER',
      'student_account', jsonb_build_object('id', v_student.id, 'user_id', v_student.user_id, 'customer_id', v_student.customer_id),
      'customer', null,
      'active_membership', null,
      'tier', null,
      'latest_expired_membership', null
    );
  END IF;

  -- 3. Find active membership and tier
  SELECT m.id, m.customer_id, m.tier_id, m.starts_at, m.ends_at, m.source,
         t.id as t_id, t.code, t.name, t.rank, t.is_active
  INTO v_active_membership
  FROM public.customer_tier_memberships m
  JOIN public.customer_tiers t ON t.id = m.tier_id
  WHERE m.customer_id = v_customer.id
    AND m.starts_at <= v_now
    AND (m.ends_at IS NULL OR m.ends_at > v_now)
    AND t.is_active = true
  ORDER BY t.rank DESC, m.starts_at DESC, m.id ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'state', 'ACTIVE',
      'student_account', jsonb_build_object('id', v_student.id, 'user_id', v_student.user_id, 'customer_id', v_student.customer_id),
      'customer', jsonb_build_object('id', v_customer.id, 'name', v_customer.name, 'email', v_customer.email, 'phone', v_customer.phone, 'status', v_customer.status),
      'active_membership', jsonb_build_object('id', v_active_membership.id, 'customer_id', v_active_membership.customer_id, 'tier_id', v_active_membership.tier_id, 'starts_at', v_active_membership.starts_at, 'ends_at', v_active_membership.ends_at, 'source', v_active_membership.source),
      'tier', jsonb_build_object('id', v_active_membership.t_id, 'code', v_active_membership.code, 'name', v_active_membership.name, 'rank', v_active_membership.rank, 'is_active', v_active_membership.is_active),
      'latest_expired_membership', null
    );
  END IF;

  -- 4. No active membership -> Find latest expired membership
  SELECT id, tier_id, starts_at, ends_at
  INTO v_expired_membership
  FROM public.customer_tier_memberships
  WHERE customer_id = v_customer.id
    AND ends_at <= v_now
  ORDER BY ends_at DESC, id ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'state', 'NO_ACTIVE_MEMBERSHIP',
      'student_account', jsonb_build_object('id', v_student.id, 'user_id', v_student.user_id, 'customer_id', v_student.customer_id),
      'customer', jsonb_build_object('id', v_customer.id, 'name', v_customer.name, 'email', v_customer.email, 'phone', v_customer.phone, 'status', v_customer.status),
      'active_membership', null,
      'tier', null,
      'latest_expired_membership', jsonb_build_object('id', v_expired_membership.id, 'tier_id', v_expired_membership.tier_id, 'starts_at', v_expired_membership.starts_at, 'ends_at', v_expired_membership.ends_at)
    );
  END IF;

  RETURN jsonb_build_object(
    'state', 'NO_ACTIVE_MEMBERSHIP',
    'student_account', jsonb_build_object('id', v_student.id, 'user_id', v_student.user_id, 'customer_id', v_student.customer_id),
    'customer', jsonb_build_object('id', v_customer.id, 'name', v_customer.name, 'email', v_customer.email, 'phone', v_customer.phone, 'status', v_customer.status),
    'active_membership', null,
    'tier', null,
    'latest_expired_membership', null
  );

END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.get_current_student_bootstrap() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_student_bootstrap() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_student_bootstrap() TO authenticated;
