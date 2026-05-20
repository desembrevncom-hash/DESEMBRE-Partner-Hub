-- Update thresholds and units for configurable rules to match specs
UPDATE public.automation_rules
SET threshold_value = 45, threshold_unit = 'days', updated_at = now()
WHERE id = 'reorder_reminder';

UPDATE public.automation_rules
SET threshold_value = 4, threshold_unit = 'hours', updated_at = now()
WHERE id = 'lead_assigned' AND (threshold_value IS NULL OR threshold_unit IS NULL);

UPDATE public.automation_rules
SET threshold_value = 3, threshold_unit = 'days', updated_at = now()
WHERE id = 'quote_follow_up' AND (threshold_value IS NULL OR threshold_unit IS NULL);

UPDATE public.automation_rules
SET threshold_value = 7, threshold_unit = 'days', updated_at = now()
WHERE id = 'post_purchase_checkin' AND (threshold_value IS NULL OR threshold_unit IS NULL);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
