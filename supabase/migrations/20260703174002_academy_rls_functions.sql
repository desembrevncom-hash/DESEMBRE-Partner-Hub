CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.can_access_course(
  p_course_id uuid,
  p_scope text
) RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req_scope int;
  v_course_status text;
  v_catalog_vis text;
  v_cat_opens timestamptz;
  v_cat_closes timestamptz;
  v_enroll_policy text;
  v_enroll_opens timestamptz;
  v_enroll_closes timestamptz;
  
  v_active_count int;
  v_active_tier_id uuid;
  v_active_tier_rank int;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  IF p_scope NOT IN ('catalog', 'enroll', 'full') THEN
    RETURN false;
  END IF;

  v_req_scope := CASE p_scope WHEN 'catalog' THEN 10 WHEN 'enroll' THEN 20 WHEN 'full' THEN 30 ELSE 999 END;

  SELECT status, catalog_visibility, catalog_opens_at, catalog_closes_at,
         enrollment_policy, enrollment_opens_at, enrollment_closes_at
  INTO v_course_status, v_catalog_vis, v_cat_opens, v_cat_closes,
       v_enroll_policy, v_enroll_opens, v_enroll_closes
  FROM public.courses WHERE id = p_course_id;

  IF NOT FOUND OR v_course_status IS DISTINCT FROM 'published' THEN
    RETURN false;
  END IF;

  IF p_scope = 'catalog' THEN
    IF NOT ((v_cat_opens IS NULL OR v_cat_opens <= now()) AND (v_cat_closes IS NULL OR v_cat_closes > now())) THEN
      RETURN false;
    END IF;
  ELSIF p_scope = 'enroll' THEN
    IF v_enroll_policy = 'closed' THEN RETURN false; END IF;
    IF NOT ((v_enroll_opens IS NULL OR v_enroll_opens <= now()) AND (v_enroll_closes IS NULL OR v_enroll_closes > now())) THEN
      RETURN false;
    END IF;
  END IF;

  -- 3. Overrides
  IF EXISTS (
    SELECT 1 FROM public.course_access_overrides
    WHERE course_id = p_course_id 
      AND student_id = (SELECT id FROM public.student_accounts WHERE user_id = v_uid)
      AND decision = 'deny'
      AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
      AND (CASE access_scope WHEN 'catalog' THEN 10 WHEN 'enroll' THEN 20 WHEN 'full' THEN 30 ELSE 0 END) <= v_req_scope
  ) THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_access_overrides
    WHERE course_id = p_course_id 
      AND student_id = (SELECT id FROM public.student_accounts WHERE user_id = v_uid)
      AND decision = 'allow'
      AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
      AND (CASE access_scope WHEN 'catalog' THEN 10 WHEN 'enroll' THEN 20 WHEN 'full' THEN 30 ELSE 0 END) >= v_req_scope
  ) THEN 
    -- NẾU LÀ FULL SCOPE, PHẢI CÓ ENROLLMENT ACTIVE HOẶC COMPLETED
    IF p_scope = 'full' THEN
      IF EXISTS (
        SELECT 1 FROM public.enrollments e
        JOIN public.student_accounts sa ON sa.id = e.student_id
        WHERE e.course_id = p_course_id AND sa.user_id = v_uid AND e.status IN ('active', 'completed')
      ) THEN RETURN true; END IF;
    ELSE
      RETURN true; 
    END IF;
  END IF;

  -- 4. Entitlements
  IF EXISTS (
    SELECT 1 FROM public.course_entitlements
    WHERE course_id = p_course_id
      AND student_id = (SELECT id FROM public.student_accounts WHERE user_id = v_uid)
      AND status = 'active'
      AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
      AND (CASE access_scope WHEN 'catalog' THEN 10 WHEN 'enroll' THEN 20 WHEN 'full' THEN 30 ELSE 0 END) >= v_req_scope
  ) THEN 
    IF p_scope = 'full' THEN
      IF EXISTS (
        SELECT 1 FROM public.enrollments e
        JOIN public.student_accounts sa ON sa.id = e.student_id
        WHERE e.course_id = p_course_id AND sa.user_id = v_uid AND e.status IN ('active', 'completed')
      ) THEN RETURN true; END IF;
    ELSE
      RETURN true; 
    END IF;
  END IF;

  -- 5. Tier Rules
  SELECT COUNT(*) INTO v_active_count
  FROM public.customer_tier_memberships m
  JOIN public.student_accounts sa ON sa.customer_id = m.customer_id
  WHERE sa.user_id = v_uid AND m.starts_at <= now() AND (m.ends_at IS NULL OR m.ends_at > now());
  
  IF v_active_count > 1 THEN
     RETURN false;
  ELSIF v_active_count = 1 THEN
     SELECT t.id, t.rank INTO v_active_tier_id, v_active_tier_rank
     FROM public.customer_tier_memberships m
     JOIN public.customer_tiers t ON t.id = m.tier_id
     JOIN public.student_accounts sa ON sa.customer_id = m.customer_id
     WHERE sa.user_id = v_uid AND m.starts_at <= now() AND (m.ends_at IS NULL OR m.ends_at > now());

     IF EXISTS (
       SELECT 1 FROM public.course_access_rules r
       JOIN public.customer_tiers rt ON rt.id = r.tier_id
       WHERE r.course_id = p_course_id
         AND r.decision = 'deny'
         AND r.starts_at <= now() AND (r.ends_at IS NULL OR r.ends_at > now())
         AND (CASE r.access_scope WHEN 'catalog' THEN 10 WHEN 'enroll' THEN 20 WHEN 'full' THEN 30 ELSE 0 END) <= v_req_scope
         AND ((r.match_mode = 'exact' AND rt.id = v_active_tier_id) OR (r.match_mode = 'minimum' AND v_active_tier_rank >= rt.rank))
     ) THEN RETURN false; END IF;

     IF EXISTS (
       SELECT 1 FROM public.course_access_rules r
       JOIN public.customer_tiers rt ON rt.id = r.tier_id
       WHERE r.course_id = p_course_id
         AND r.decision = 'allow'
         AND r.starts_at <= now() AND (r.ends_at IS NULL OR r.ends_at > now())
         AND (CASE r.access_scope WHEN 'catalog' THEN 10 WHEN 'enroll' THEN 20 WHEN 'full' THEN 30 ELSE 0 END) >= v_req_scope
         AND ((r.match_mode = 'exact' AND rt.id = v_active_tier_id) OR (r.match_mode = 'minimum' AND v_active_tier_rank >= rt.rank))
     ) THEN 
       IF p_scope = 'full' THEN
         IF EXISTS (
           SELECT 1 FROM public.enrollments e
           JOIN public.student_accounts sa ON sa.id = e.student_id
           WHERE e.course_id = p_course_id AND sa.user_id = v_uid AND e.status IN ('active', 'completed')
         ) THEN RETURN true; END IF;
       ELSE
         RETURN true; 
       END IF;
     END IF;
  END IF;

  -- 6. Public Access
  IF p_scope = 'catalog' AND v_catalog_vis = 'public' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION private.can_access_course(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_course(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION private.can_access_course(uuid, text) TO authenticated;
