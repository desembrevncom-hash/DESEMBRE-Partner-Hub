-- ==========================================
-- Fix: Phase C - Academy Admin Search Students RPC
-- Normalizes phone searches and masks output PII
-- ==========================================

CREATE OR REPLACE FUNCTION public.admin_search_academy_students_for_access(
  p_query text,
  p_limit int DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_result jsonb;
  v_query_lower text;
  v_query_digits text;
  v_query_uuid uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor_id, v_actor_role FROM private.require_current_academy_content_admin();

  v_query_lower := lower(trim(COALESCE(p_query, '')));
  v_query_digits := regexp_replace(v_query_lower, '\D', '', 'g');

  -- Attempt to cast query to uuid safely
  BEGIN
    v_query_uuid := v_query_lower::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_query_uuid := NULL;
  END;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sa.id,
      'user_id', sa.user_id,
      'status', sa.status,
      'display_name', p.display_name,
      'email', CASE 
        WHEN u.email IS NOT NULL AND length(u.email) > 0 THEN 
          -- Basic email masking: first 2 chars + *** + @domain
          CASE 
            WHEN position('@' in u.email) > 2 THEN 
              left(u.email, 2) || '***' || substring(u.email from position('@' in u.email))
            ELSE 
              '***' || substring(u.email from position('@' in u.email))
          END
        ELSE NULL 
      END,
      'phone', CASE 
        WHEN u.phone IS NOT NULL AND length(u.phone) > 6 THEN 
          -- Basic phone masking: +84***1234
          left(u.phone, 3) || '***' || right(u.phone, 4)
        ELSE NULL 
      END,
      'customer_id', sa.customer_id
    ) ORDER BY sa.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.student_accounts sa
  JOIN auth.users u ON u.id = sa.user_id
  LEFT JOIN public.profiles p ON p.id = sa.user_id
  WHERE (p_query IS NULL OR p_query = '')
     OR (v_query_uuid IS NOT NULL AND (sa.id = v_query_uuid OR sa.user_id = v_query_uuid))
     OR sa.id::text ILIKE v_query_lower || '%'
     OR u.id::text ILIKE v_query_lower || '%'
     OR p.display_name ILIKE '%' || v_query_lower || '%'
     OR (length(v_query_lower) > 0 AND u.email ILIKE '%' || v_query_lower || '%')
     OR (
        length(v_query_digits) >= 4 AND (
          regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') ILIKE '%' || v_query_digits || '%'
          OR regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') ILIKE '%' || regexp_replace(v_query_digits, '^0', '84') || '%'
          OR regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') ILIKE '%' || regexp_replace(v_query_digits, '^84', '0') || '%'
          OR (length(v_query_digits) >= 9 AND length(regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g')) >= 9 AND right(regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g'), 9) = right(v_query_digits, 9))
        )
     )
  LIMIT COALESCE(p_limit, 20);

  RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
