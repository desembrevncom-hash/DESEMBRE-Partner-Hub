-- Phase L1: Customer List Intelligence Center RPC
-- Lấy thông tin intelligence đa kênh và điểm số priority của khách hàng theo batch.

CREATE OR REPLACE FUNCTION get_customer_list_intelligence(p_customer_ids uuid[])
RETURNS TABLE (
  customer_id uuid,
  latest_activity text,
  activity_at timestamptz,
  channels_summary jsonb,
  primary_channel_type text,
  primary_channel_value text,
  verified_channels_count int,
  priority_score int
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
    SELECT c.id, c.owner_sale_id, c.owner_tele_id, c.phone
    FROM customers c
    WHERE c.id = ANY(p_customer_ids)
      AND c.deleted_at IS NULL
  ),
  activities AS (
    SELECT a.customer_id, a.content, a.created_at
    FROM customer_activities a
    INNER JOIN (
      SELECT ca.customer_id, MAX(ca.created_at) as max_at
      FROM customer_activities ca
      WHERE ca.customer_id = ANY(p_customer_ids)
      GROUP BY ca.customer_id
    ) a_max ON a.customer_id = a_max.customer_id AND a.created_at = a_max.max_at
  ),
  channels AS (
    SELECT 
      cc.customer_id,
      jsonb_agg(
        jsonb_build_object(
          'type', cc.channel_type,
          'value', cc.channel_value,
          'is_primary', cc.is_primary,
          'is_verified', cc.is_verified,
          'scope', cc.scope
        )
      ) as channels_summary,
      MAX(CASE WHEN cc.is_primary THEN cc.channel_type ELSE NULL END) as primary_channel_type,
      MAX(CASE WHEN cc.is_primary THEN cc.channel_value ELSE NULL END) as primary_channel_value,
      COUNT(CASE WHEN cc.is_verified THEN 1 ELSE NULL END) as verified_channels_count
    FROM customer_contact_channels cc
    WHERE cc.customer_id = ANY(p_customer_ids)
      AND (v_is_admin OR cc.scope = 'official' OR cc.owner_user_id = v_user_id)
    GROUP BY cc.customer_id
  ),
  orders_summary AS (
    SELECT o.customer_id, COUNT(*) as order_count
    FROM orders o
    WHERE o.customer_id = ANY(p_customer_ids)
    GROUP BY o.customer_id
  )
  SELECT 
    uc.id,
    a.content as latest_activity,
    a.created_at as activity_at,
    COALESCE(ch.channels_summary, '[]'::jsonb),
    ch.primary_channel_type,
    ch.primary_channel_value,
    COALESCE(ch.verified_channels_count, 0)::INT,
    LEAST(100, 
      (CASE WHEN uc.phone IS NOT NULL AND length(uc.phone) >= 9 THEN 25 ELSE 0 END) +
      (CASE WHEN COALESCE(jsonb_array_length(ch.channels_summary), 0) > 0 THEN 15 ELSE 0 END) +
      (CASE WHEN COALESCE(ch.verified_channels_count, 0) > 0 THEN 15 ELSE 0 END) +
      (CASE WHEN a.created_at > now() - interval '7 days' THEN 15 ELSE 0 END) +
      (CASE WHEN uc.owner_sale_id IS NOT NULL OR uc.owner_tele_id IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN COALESCE(os.order_count, 0) > 0 THEN 15 ELSE 0 END)
    )::INT as priority_score
  FROM valid_customers uc
  LEFT JOIN activities a ON a.customer_id = uc.id
  LEFT JOIN channels ch ON ch.customer_id = uc.id
  LEFT JOIN orders_summary os ON os.customer_id = uc.id;
END;
$$;
