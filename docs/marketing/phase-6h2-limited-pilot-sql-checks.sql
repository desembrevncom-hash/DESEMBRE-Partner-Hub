-- Phase 6H.2 Limited Pilot SQL Checks

-- 1. List Candidates (opt-in = true, not suppressed), Limit 10
SELECT c.id, c.name, c.email, c.phone, c.marketing_opt_in
FROM public.customers c
WHERE c.marketing_opt_in = true
  AND c.marketing_opt_out_at IS NULL
  AND c.is_active = true
  AND c.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.marketing_suppression_list s
    WHERE s.normalized_contact_value = LOWER(TRIM(c.email))
      AND s.channel = 'email'
      AND s.is_active = true
  )
LIMIT 10;

-- 2. Check Campaign Approval Status
SELECT id, title, channel, approval_status, segment_id
FROM public.marketing_campaigns
WHERE id = '<CAMPAIGN_ID>';
-- Expected: approval_status = 'approved'

-- 3. Check Recent Delivery Logs
SELECT id, campaign_id, customer_id, channel, status, provider_message_id, created_at
FROM public.marketing_delivery_logs
WHERE campaign_id = '<CAMPAIGN_ID>'
ORDER BY created_at DESC;

-- 4. Check Bounced/Complained/Unsubscribed Suppression
SELECT id, channel, normalized_contact_value, reason, source, is_active
FROM public.marketing_suppression_list
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- 5. Check no non-whitelist/internal accidental sends (If run in pilot mode)
SELECT l.id, l.status, c.email
FROM public.marketing_delivery_logs l
JOIN public.customers c ON l.customer_id = c.id
WHERE l.campaign_id = '<CAMPAIGN_ID>'
  AND c.email NOT IN (
    '<WHITELIST_EMAIL_1>',
    '<WHITELIST_EMAIL_2>'
  );
-- Expected: 0 rows if strictly restricted to whitelist.
