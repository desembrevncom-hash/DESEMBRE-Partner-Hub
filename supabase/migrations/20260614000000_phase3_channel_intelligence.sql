-- Phase 3: Channel Intelligence & Filters
-- Create RPC get_customer_channel_summary

CREATE OR REPLACE FUNCTION get_customer_channel_summary(p_customer_ids uuid[])
RETURNS TABLE (
  customer_id uuid,
  channels_summary jsonb,
  channel_health_score int,
  has_phone boolean,
  has_facebook boolean,
  has_zalo boolean,
  has_email boolean,
  has_tiktok boolean,
  has_website boolean,
  has_primary boolean,
  has_remarketing boolean,
  private_count int,
  duplicate_risk jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean := public.is_admin_or_sub_admin(v_user_id);
BEGIN
  RETURN QUERY
  WITH valid_customers AS (
    SELECT c.id
    FROM customers c
    WHERE c.id = ANY(p_customer_ids)
      AND c.deleted_at IS NULL
  ),
  channels AS (
    SELECT 
      cc.customer_id,
      cc.channel_type,
      cc.channel_value,
      cc.normalized_value,
      cc.is_primary,
      cc.is_verified,
      cc.resolve_status,
      cc.remarketing_enabled,
      cc.scope,
      cc.owner_user_id,
      cc.external_id
    FROM customer_contact_channels cc
    WHERE cc.customer_id = ANY(p_customer_ids)
      AND (v_is_admin OR cc.scope = 'official' OR cc.owner_user_id = v_user_id)
  ),
  aggregated_channels AS (
    SELECT 
      c.customer_id,
      jsonb_agg(
        jsonb_build_object(
          'type', c.channel_type,
          'value', c.channel_value,
          'normalized_value', c.normalized_value,
          'is_primary', c.is_primary,
          'is_verified', c.is_verified,
          'resolve_status', c.resolve_status,
          'remarketing_enabled', c.remarketing_enabled,
          'scope', c.scope,
          'owner_user_id', c.owner_user_id,
          'external_id', c.external_id
        )
      ) as channels_summary,
      
      BOOL_OR(c.channel_type = 'phone') as has_phone,
      BOOL_OR(c.channel_type = 'facebook') as has_facebook,
      BOOL_OR(c.channel_type = 'zalo') as has_zalo,
      BOOL_OR(c.channel_type = 'email') as has_email,
      BOOL_OR(c.channel_type = 'tiktok') as has_tiktok,
      BOOL_OR(c.channel_type = 'website') as has_website,
      BOOL_OR(c.is_primary) as has_primary,
      BOOL_OR(c.remarketing_enabled) as has_remarketing,
      BOOL_OR(c.is_verified OR c.resolve_status = 'verified') as has_verified,
      
      COUNT(CASE WHEN c.scope = 'private' THEN 1 ELSE NULL END)::INT as private_count,
      
      -- Duplicate Value Check
      (
        SELECT COUNT(*) > 0
        FROM (
            SELECT normalized_value 
            FROM channels sub 
            WHERE sub.customer_id = c.customer_id AND sub.normalized_value IS NOT NULL AND sub.normalized_value != ''
            GROUP BY normalized_value 
            HAVING COUNT(*) > 1
        ) dup_vals
      ) as has_value_duplicates,

      -- Duplicate External ID Check
      (
        SELECT COUNT(*) > 0
        FROM (
            SELECT external_id 
            FROM channels sub 
            WHERE sub.customer_id = c.customer_id AND sub.external_id IS NOT NULL AND sub.external_id != ''
            GROUP BY external_id 
            HAVING COUNT(*) > 1
        ) dup_ext
      ) as has_external_id_duplicates,
      
      -- Duplicate Primary Check
      (
        SELECT COUNT(*) > 0
        FROM (
            SELECT scope, COALESCE(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid) as o_uid
            FROM channels sub 
            WHERE sub.customer_id = c.customer_id AND sub.is_primary = true
            GROUP BY scope, COALESCE(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
            HAVING COUNT(*) > 1
        ) dup_primaries
      ) as has_primary_duplicates

    FROM channels c
    GROUP BY c.customer_id
  )
  SELECT 
    uc.id,
    COALESCE(ac.channels_summary, '[]'::jsonb),
    
    LEAST(100, 
      (CASE WHEN ac.has_phone THEN 30 ELSE 0 END) +
      (CASE WHEN (ac.has_facebook OR ac.has_zalo OR ac.has_tiktok OR ac.channel_type = 'instagram') THEN 20 ELSE 0 END) +
      (CASE WHEN ac.has_primary THEN 20 ELSE 0 END) +
      (CASE WHEN ac.has_verified THEN 20 ELSE 0 END) +
      (CASE WHEN ac.has_remarketing THEN 10 ELSE 0 END)
    )::INT as channel_health_score,
    
    COALESCE(ac.has_phone, false),
    COALESCE(ac.has_facebook, false),
    COALESCE(ac.has_zalo, false),
    COALESCE(ac.has_email, false),
    COALESCE(ac.has_tiktok, false),
    COALESCE(ac.has_website, false),
    COALESCE(ac.has_primary, false),
    COALESCE(ac.has_remarketing, false),
    COALESCE(ac.private_count, 0),
    
    jsonb_build_object(
      'has_value_duplicates', COALESCE(ac.has_value_duplicates, false),
      'has_external_id_duplicates', COALESCE(ac.has_external_id_duplicates, false),
      'has_primary_duplicates', COALESCE(ac.has_primary_duplicates, false)
    ) as duplicate_risk
    
  FROM valid_customers uc
  LEFT JOIN aggregated_channels ac ON ac.customer_id = uc.id
  LEFT JOIN (SELECT customer_id, MAX(channel_type) as channel_type FROM channels GROUP BY customer_id) ch_types ON ch_types.customer_id = uc.id;
END;
$$;
