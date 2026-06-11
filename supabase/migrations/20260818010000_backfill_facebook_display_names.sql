-- supabase/migrations/20260818010000_backfill_facebook_display_names.sql

-- 1. Extract and clean names from response_json where possible
WITH extracted_names AS (
    SELECT 
        id,
        returned_uid,
        COALESCE(
            NULLIF(TRIM(response_json->'openGraph'->>'title'), ''),
            NULLIF(TRIM(response_json->'openGraph'->>'alt'), '')
        ) as extracted_name
    FROM public.facebook_uid_resolver_results
    WHERE provider_status IN ('resolved', 'cached')
      AND returned_uid IS NOT NULL
      AND response_json IS NOT NULL
      AND response_json != '{}'::jsonb
),
cleaned_names AS (
    SELECT
        id,
        returned_uid,
        -- trim, remove control chars, extract before " | Facebook", max 120 chars
        LEFT(TRIM(SPLIT_PART(regexp_replace(extracted_name, '[[:cntrl:]]', '', 'g'), ' | Facebook', 1)), 120) as clean_name
    FROM extracted_names
    WHERE extracted_name IS NOT NULL
      AND extracted_name NOT ILIKE '%facebook%'
      AND extracted_name NOT ILIKE '%log in%'
      AND extracted_name NOT ILIKE '%sign up%'
      AND extracted_name != 'Facebook'
),
-- 2. Find the best available name per returned_uid
uid_best_names AS (
    SELECT 
        returned_uid,
        MAX(clean_name) as best_name
    FROM cleaned_names
    WHERE clean_name IS NOT NULL AND clean_name != ''
    GROUP BY returned_uid
)

-- 3. Update facebook_uid_resolver_results
UPDATE public.facebook_uid_resolver_results r
SET returned_name = u.best_name
FROM uid_best_names u
WHERE r.returned_uid = u.returned_uid
  AND r.returned_uid IS NOT NULL
  AND r.returned_name IS NULL
  AND u.best_name IS NOT NULL;

-- 4. Update customer_social_profiles using the now-populated returned_name
UPDATE public.customer_social_profiles p
SET 
    facebook_display_name = u.best_name,
    display_name_source = 'external_apify_backfill',
    display_name_confidence_score = 70,
    display_name_updated_at = NOW(),
    updated_at = NOW()
FROM (
    SELECT returned_uid, MAX(returned_name) as best_name 
    FROM public.facebook_uid_resolver_results
    WHERE returned_uid IS NOT NULL AND returned_name IS NOT NULL AND provider_status IN ('resolved', 'cached')
    GROUP BY returned_uid
) u
WHERE p.facebook_uid = u.returned_uid
  AND p.facebook_uid IS NOT NULL
  AND p.facebook_display_name IS NULL
  AND u.best_name IS NOT NULL;
