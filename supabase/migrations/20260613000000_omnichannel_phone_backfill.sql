-- ================================================================
-- Migration: Omnichannel CRM Phase 2 - Backfill Phone
-- Date: 2026-06-13
-- ================================================================

-- Backfill customers.phone to customer_contact_channels
-- Ensure idempotency by checking if phone channel already exists for the customer
-- Scope is 'official' if created_by is admin, otherwise 'private'.
-- But wait, standardizing backfill to 'official' for simplicity, unless owner_sale_id is set.
-- Actually, let's make it robust: 
-- Scope 'official', owner_user_id null.

INSERT INTO public.customer_contact_channels (
    customer_id,
    channel_type,
    channel_value,
    normalized_value,
    scope,
    visibility,
    resolve_status,
    owner_user_id,
    created_by,
    updated_by,
    is_primary,
    channel_purpose
)
SELECT 
    c.id,
    'phone',
    c.phone,
    c.normalized_phone,
    'official',
    'team',
    'verified',
    NULL,
    c.created_by,
    c.updated_by,
    NOT EXISTS (
        SELECT 1 FROM public.customer_contact_channels ccc 
        WHERE ccc.customer_id = c.id AND ccc.is_primary = true
    ),
    'sales'
FROM public.customers c
WHERE c.phone IS NOT NULL
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.customer_contact_channels ch 
      WHERE ch.customer_id = c.id 
        AND ch.channel_type = 'phone' 
        AND ch.normalized_value = c.normalized_phone
  );
