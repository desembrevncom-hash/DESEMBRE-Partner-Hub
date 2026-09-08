-- Migration: Add text source document support to product_source_documents
-- Allows admins to paste structured guidebook text directly for faster, more accurate AI extraction.

-- 1. Add source_type column with CHECK constraint
ALTER TABLE public.product_source_documents
ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'file';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_source_documents_source_type'
    ) THEN
        ALTER TABLE public.product_source_documents
        ADD CONSTRAINT chk_product_source_documents_source_type 
        CHECK (source_type IN ('file', 'text'));
    END IF;
END $$;

-- 2. Add raw_text column
ALTER TABLE public.product_source_documents
ADD COLUMN IF NOT EXISTS raw_text text;

-- 3. Make file_url, file_name, file_type nullable for text sources
ALTER TABLE public.product_source_documents
ALTER COLUMN file_url DROP NOT NULL;

ALTER TABLE public.product_source_documents
ALTER COLUMN file_name DROP NOT NULL;

ALTER TABLE public.product_source_documents
ALTER COLUMN file_type DROP NOT NULL;

-- 4. Index on source_type
CREATE INDEX IF NOT EXISTS idx_product_source_documents_source_type
ON public.product_source_documents (source_type);

-- 5. Reload schema cache
NOTIFY pgrst, 'reload schema';
