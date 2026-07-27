-- 6H.2A SAFE DIAGNOSTICS: AUDIENCE FUNNEL WITH CUSTOMER_CONSENTS ENFORCEMENT
-- Do not modify production data. Use this script to safely inspect why eligible_count=0.

-- Placeholder: Replace '<CAMPAIGN_ID>' with the actual Campaign UUID

-- 1. CAMPAIGN HEALTH CHECK
SELECT 
    id AS campaign_id,
    name,
    status,
    approval_status,
    final_confirmed_at,
    segment_id,
    channel
FROM public.marketing_campaigns 
WHERE id = '<CAMPAIGN_ID>';

-- 2. SEGMENT MAPPING COUNT (If campaign uses segment_id)
SELECT count(customer_id) as mapped_audience_count
FROM public.customer_segments_map 
WHERE segment_id = (SELECT segment_id FROM public.marketing_campaigns WHERE id = '<CAMPAIGN_ID>');

-- 3. AUDIENCE FUNNEL STATISTICS
WITH base_audience AS (
    SELECT c.*
    FROM public.customers c
    LEFT JOIN public.customer_segments_map csm ON c.id = csm.customer_id
    WHERE 
        (SELECT segment_id FROM public.marketing_campaigns WHERE id = '<CAMPAIGN_ID>') IS NULL
        OR csm.segment_id = (SELECT segment_id FROM public.marketing_campaigns WHERE id = '<CAMPAIGN_ID>')
)
SELECT 
    COUNT(*) AS total_candidates,
    COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' AND c.email LIKE '%@%' THEN 1 END) AS has_valid_email,
    -- Check if they have true explicit record in customer_consents for email
    COUNT(CASE WHEN EXISTS (
        SELECT 1 FROM public.customer_consents cc 
        WHERE cc.customer_id = c.id 
          AND cc.channel LIKE '%email%' 
          AND cc.is_opt_in = true 
          AND cc.opt_out_at IS NULL
    ) THEN 1 END) AS has_valid_consent_proof,
    -- Check legacy flag
    COUNT(CASE WHEN c.marketing_opt_in = true THEN 1 END) AS has_legacy_opt_in_flag,
    COUNT(CASE WHEN c.marketing_opt_out_at IS NOT NULL THEN 1 END) AS has_opted_out,
    COUNT(CASE WHEN c.is_active = false THEN 1 END) AS is_inactive,
    COUNT(CASE WHEN c.id IN (
        SELECT customer_id FROM public.marketing_delivery_logs 
        WHERE campaign_id = '<CAMPAIGN_ID>' AND status IN ('sent', 'queued', 'provider_sent', 'delivered')
    ) THEN 1 END) AS has_duplicate_log,
    COUNT(CASE WHEN LOWER(TRIM(c.email)) IN (
        SELECT normalized_contact_value FROM public.marketing_suppression_list WHERE is_active = true
    ) THEN 1 END) AS is_suppressed
FROM base_audience c;

-- 4. ELIGIBLE CANDIDATE PREVIEW (MASKED EMAIL)
WITH base_audience AS (
    SELECT c.*
    FROM public.customers c
    LEFT JOIN public.customer_segments_map csm ON c.id = csm.customer_id
    WHERE 
        (SELECT segment_id FROM public.marketing_campaigns WHERE id = '<CAMPAIGN_ID>') IS NULL
        OR csm.segment_id = (SELECT segment_id FROM public.marketing_campaigns WHERE id = '<CAMPAIGN_ID>')
)
SELECT 
    c.id AS customer_id,
    c.name,
    CONCAT(SUBSTRING(c.email FROM 1 FOR 4), '***', SUBSTRING(c.email FROM POSITION('@' IN c.email))) AS masked_email,
    c.marketing_opt_in,
    c.is_active
FROM base_audience c
WHERE 
    c.email IS NOT NULL AND c.email != '' AND c.email LIKE '%@%'
    AND c.marketing_opt_in != false 
    AND c.marketing_opt_out_at IS NULL
    AND c.is_active = true
    -- Explicit Consent Proof Requirement:
    AND EXISTS (
        SELECT 1 FROM public.customer_consents cc 
        WHERE cc.customer_id = c.id 
          AND cc.channel LIKE '%email%' 
          AND cc.is_opt_in = true 
          AND cc.opt_out_at IS NULL
    )
    AND c.id NOT IN (
        SELECT customer_id FROM public.marketing_delivery_logs 
        WHERE campaign_id = '<CAMPAIGN_ID>' AND status IN ('sent', 'queued', 'provider_sent', 'delivered')
    )
    AND LOWER(TRIM(c.email)) NOT IN (
        SELECT normalized_contact_value FROM public.marketing_suppression_list WHERE is_active = true
    )
LIMIT 10;
