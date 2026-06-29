-- Backfill returned_name in facebook_uid_resolver_results from Apify response JSON
UPDATE public.facebook_uid_resolver_results
SET returned_name = sub.extracted_name
FROM (
  SELECT 
    id,
    TRIM(
      REGEXP_REPLACE(
        COALESCE(
          response_json -> 'openGraph' ->> 'title',
          response_json -> 'openGraph' ->> 'alt',
          response_json -> 'openGraph' ->> 'name'
        ), 
        ' \| Facebook$', 
        ''
      )
    ) as extracted_name
  FROM public.facebook_uid_resolver_results
  WHERE provider_status IN ('resolved', 'cached')
    AND returned_uid IS NOT NULL
    AND returned_name IS NULL
    AND response_json IS NOT NULL
    AND (
      response_json -> 'openGraph' ->> 'title' IS NOT NULL OR 
      response_json -> 'openGraph' ->> 'alt' IS NOT NULL OR
      response_json -> 'openGraph' ->> 'name' IS NOT NULL
    )
) sub
WHERE public.facebook_uid_resolver_results.id = sub.id
  AND sub.extracted_name IS NOT NULL 
  AND sub.extracted_name != ''
  AND sub.extracted_name NOT ILIKE '%facebook.com%'
  AND LOWER(sub.extracted_name) != 'facebook';

-- Backfill facebook_display_name in customer_social_profiles
UPDATE public.customer_social_profiles csp
SET 
  facebook_display_name = fur.returned_name,
  display_name_source = 'external_apify_backfill',
  display_name_confidence_score = 70,
  display_name_updated_at = NOW()
FROM public.facebook_uid_resolver_results fur
WHERE csp.facebook_uid = fur.returned_uid
  AND csp.facebook_display_name IS NULL
  AND fur.returned_name IS NOT NULL
  AND fur.provider_status IN ('resolved', 'cached');
