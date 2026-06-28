-- M11 Campaign Analytics View
-- Drops the old view if it exists and creates the new one with security_invoker = true

DROP VIEW IF EXISTS public.campaign_analytics_view;

CREATE VIEW public.campaign_analytics_view WITH (security_invoker = true) AS
SELECT 
  c.id as campaign_id,
  c.name as campaign_name,
  COALESCE(c.intended_channel, c.template_channel_snapshot, 'unknown') as channel,
  c.status as campaign_status,
  c.created_at,
  COUNT(l.id) as total_targets,
  COUNT(l.id) FILTER (WHERE l.status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')) as total_sent,
  COUNT(l.id) FILTER (WHERE l.status IN ('delivered', 'opened', 'clicked')) as total_delivered,
  COUNT(l.id) FILTER (WHERE l.status IN ('opened', 'clicked')) as total_opened,
  COUNT(l.id) FILTER (WHERE l.status = 'clicked') as total_clicked,
  COUNT(l.id) FILTER (WHERE l.status IN ('failed', 'bounced', 'complained', 'dropped')) as total_failed,
  COUNT(l.id) FILTER (WHERE l.status = 'bounced') as total_bounced,
  COUNT(l.id) FILTER (WHERE l.status = 'suppressed') as total_suppressed
FROM 
  public.marketing_campaigns c
LEFT JOIN 
  public.marketing_delivery_logs l ON c.id = l.campaign_id
GROUP BY 
  c.id, c.name, c.intended_channel, c.template_channel_snapshot, c.status, c.created_at;

-- Grant permissions for authenticated users
GRANT SELECT ON public.campaign_analytics_view TO authenticated;
