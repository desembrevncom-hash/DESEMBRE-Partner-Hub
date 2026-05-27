-- ============================================================================
-- MIGRATION: Phase F2 - Customer Management Summary RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_customer_management_summary(p_customer_ids uuid[])
RETURNS TABLE (
  customer_id uuid,
  open_tasks bigint,
  overdue_tasks bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as customer_id,
    COALESCE(SUM(CASE WHEN t.status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END), 0) as open_tasks,
    COALESCE(SUM(CASE WHEN t.status NOT IN ('completed', 'cancelled') AND t.due_at < NOW() THEN 1 ELSE 0 END), 0) as overdue_tasks
  FROM unnest(p_customer_ids) as c(id)
  LEFT JOIN public.customer_tasks t ON t.customer_id = c.id
  GROUP BY c.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Làm mới schema cache
NOTIFY pgrst, 'reload schema';
