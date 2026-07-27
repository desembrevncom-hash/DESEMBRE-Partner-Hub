-- UPDATE get_course_access_decision to check DENY at the very top

CREATE OR REPLACE FUNCTION private.get_course_access_decision(p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_can_view boolean;
  v_can_enroll boolean;
  v_can_learn boolean;
  v_reason text := 'COURSE_UNAVAILABLE';
  v_required_tier jsonb := null;
  
  v_catalog_vis text;
  v_enroll_policy text;
  v_pricing text;
  
  v_active_count int;
  v_enrollment_status text;
  
  v_rule_decision text;
  v_rule_tier_code text;
  v_rule_tier_name text;
  v_rule_tier_rank int;
BEGIN
  SELECT id INTO v_student_id FROM public.student_accounts WHERE user_id = v_uid;
  
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('can_view', false, 'can_enroll', false, 'can_learn', false, 'reason', 'NO_STUDENT_ACCOUNT', 'required_tier', null);
  END IF;

  -- 1. EXPLICIT DENY CHECK (Highest Priority)
  IF EXISTS (
    SELECT 1 FROM public.course_access_overrides
    WHERE course_id = p_course_id 
      AND student_id = v_student_id
      AND decision = 'deny'
      AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RETURN jsonb_build_object('can_view', false, 'can_enroll', false, 'can_learn', false, 'reason', 'ACCESS_BLOCKED', 'required_tier', null);
  END IF;

  v_can_view := private.can_access_course(p_course_id, 'catalog');
  v_can_enroll := private.can_access_course(p_course_id, 'enroll');
  v_can_learn := private.can_access_course(p_course_id, 'full');
  
  SELECT catalog_visibility, enrollment_policy, pricing_model
  INTO v_catalog_vis, v_enroll_policy, v_pricing
  FROM public.courses WHERE id = p_course_id;
  
  SELECT status INTO v_enrollment_status
  FROM public.enrollments 
  WHERE course_id = p_course_id AND student_id = v_student_id;
  
  IF v_enrollment_status IN ('active', 'completed') THEN
    RETURN jsonb_build_object('can_view', true, 'can_enroll', false, 'can_learn', true, 'reason', 'ALREADY_ENROLLED', 'required_tier', null);
  END IF;
  
  IF NOT v_can_view THEN
    IF v_catalog_vis = 'private' THEN v_reason := 'COURSE_PRIVATE'; END IF;
    RETURN jsonb_build_object('can_view', false, 'can_enroll', false, 'can_learn', false, 'reason', v_reason, 'required_tier', null);
  END IF;
  
  IF NOT v_can_enroll THEN
    IF v_pricing = 'paid' THEN
      v_reason := 'PAYMENT_REQUIRED';
    ELSIF v_enroll_policy = 'closed' THEN
      v_reason := 'ENROLLMENT_CLOSED';
    ELSIF v_enroll_policy = 'assigned' THEN
      v_reason := 'ASSIGNMENT_REQUIRED';
    ELSE
      v_reason := 'ENROLLMENT_UNAVAILABLE';
    END IF;
    RETURN jsonb_build_object('can_view', true, 'can_enroll', false, 'can_learn', false, 'reason', v_reason, 'required_tier', null);
  END IF;
  
  IF v_can_learn THEN
    RETURN jsonb_build_object('can_view', true, 'can_enroll', true, 'can_learn', true, 'reason', 'ACCESS_GRANTED', 'required_tier', null);
  END IF;
  
  -- If not can_learn but can_enroll, we might need a tier
  SELECT COUNT(*) INTO v_active_count
  FROM public.customer_tier_memberships m
  JOIN public.student_accounts sa ON sa.customer_id = m.customer_id
  WHERE sa.id = v_student_id AND m.starts_at <= now() AND (m.ends_at IS NULL OR m.ends_at > now());
  
  IF v_active_count = 0 THEN
    SELECT r.decision, t.code, t.name, t.rank INTO v_rule_decision, v_rule_tier_code, v_rule_tier_name, v_rule_tier_rank
    FROM public.course_access_rules r
    JOIN public.customer_tiers t ON t.id = r.tier_id
    WHERE r.course_id = p_course_id AND r.starts_at <= now() AND (r.ends_at IS NULL OR r.ends_at > now())
      AND (CASE r.access_scope WHEN 'catalog' THEN 10 WHEN 'enroll' THEN 20 WHEN 'full' THEN 30 ELSE 0 END) >= 30
    ORDER BY t.rank ASC LIMIT 1;
    
    IF v_rule_decision = 'allow' THEN
      v_required_tier := jsonb_build_object('code', v_rule_tier_code, 'name', v_rule_tier_name, 'rank', v_rule_tier_rank);
      v_reason := 'TIER_REQUIRED';
    END IF;
  END IF;

  RETURN jsonb_build_object('can_view', true, 'can_enroll', true, 'can_learn', false, 'reason', v_reason, 'required_tier', v_required_tier);
END;
$$;
