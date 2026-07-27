-- Phase 6H.0 Verification SQL

-- 1. Check recent marketing_delivery_logs
SELECT id, campaign_id, customer_id, channel, contact_value, status, provider_message_id, created_at, updated_at
FROM public.marketing_delivery_logs
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check recent webhook_events provider='resend'
SELECT id, provider, event_type, status, created_at, processed_at, error_message
FROM public.webhook_events
WHERE provider = 'resend'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check recent marketing_suppression_list
SELECT id, channel, contact_value, normalized_contact_value, reason, source, is_active, created_at
FROM public.marketing_suppression_list
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check customer_consents recent opt_out_at
SELECT id, customer_id, channel, is_opt_in, opt_in_at, opt_out_at, created_at
FROM public.customer_consents
WHERE opt_out_at IS NOT NULL
ORDER BY opt_out_at DESC
LIMIT 10;

-- 5. Check suppression by normalized_contact_value (example search)
SELECT id, channel, contact_value, reason, is_active
FROM public.marketing_suppression_list
WHERE normalized_contact_value = '<MASKED_OR_TEST_EMAIL>'
  AND channel = 'email';

-- 6. Check no production campaign accidentally sent
SELECT id, title, status, scheduled_at, sent_at
FROM public.marketing_campaigns
WHERE status = 'sent' 
  AND (title NOT ILIKE '%test%' AND title NOT ILIKE '%sandbox%');
