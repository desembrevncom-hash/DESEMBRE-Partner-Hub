-- Migration: Upgrade customer import staging schema
-- Description: Adds necessary explicit columns for the Safe Import process.

-- A. Nâng cấp customer_import_batches
ALTER TABLE public.customer_import_batches
ADD COLUMN IF NOT EXISTS valid_rows integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS invalid_rows integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS duplicate_rows integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS skipped_rows integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_rows integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS inserted_rows integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS source_type text,
ADD COLUMN IF NOT EXISTS import_mode text DEFAULT 'staging_only',
ADD COLUMN IF NOT EXISTS completed_at timestamptz,
ADD COLUMN IF NOT EXISTS error_message text;

-- B. Nâng cấp customer_import_rows
ALTER TABLE public.customer_import_rows
ADD COLUMN IF NOT EXISTS row_number integer,
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS business_name text,
ADD COLUMN IF NOT EXISTS facility_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS normalized_phone text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS normalized_email text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS customer_channel text,
ADD COLUMN IF NOT EXISTS status text,
ADD COLUMN IF NOT EXISTS lifecycle_stage text,
ADD COLUMN IF NOT EXISTS note text,
ADD COLUMN IF NOT EXISTS owner_sale_id uuid,
ADD COLUMN IF NOT EXISTS owner_sale_email text,
ADD COLUMN IF NOT EXISTS owner_tele_id uuid,
ADD COLUMN IF NOT EXISTS owner_tele_email text,
ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS import_action text DEFAULT 'skip',
ADD COLUMN IF NOT EXISTS matched_customer_id uuid,
ADD COLUMN IF NOT EXISTS duplicate_reason text,
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS warning_message text,
ADD COLUMN IF NOT EXISTS reviewed_by uuid,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- C. Index cần tạo
CREATE INDEX IF NOT EXISTS idx_customer_import_rows_batch_id ON public.customer_import_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_customer_import_rows_batch_id_validation_status ON public.customer_import_rows(batch_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_customer_import_rows_batch_id_import_action ON public.customer_import_rows(batch_id, import_action);
CREATE INDEX IF NOT EXISTS idx_customer_import_rows_normalized_phone ON public.customer_import_rows(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_customer_import_rows_normalized_email ON public.customer_import_rows(normalized_email);
CREATE INDEX IF NOT EXISTS idx_customer_import_rows_matched_customer_id ON public.customer_import_rows(matched_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_import_batches_status ON public.customer_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_customer_import_batches_created_at_desc ON public.customer_import_batches(created_at DESC);
