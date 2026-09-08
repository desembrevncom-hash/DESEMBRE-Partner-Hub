-- Migration: Create product_source_documents table and product-documents storage bucket
-- Supports uploading and managing raw product guidebooks/source documents.

-- 1. Create public.product_source_documents table
CREATE TABLE IF NOT EXISTS public.product_source_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text NOT NULL,
    document_type text NOT NULL DEFAULT 'guidebook',
    extracted_text text,
    extracted_data jsonb DEFAULT '{}'::jsonb,
    extraction_status text NOT NULL DEFAULT 'pending',
    uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_product_source_documents_catalog_product_id 
    ON public.product_source_documents(catalog_product_id);
CREATE INDEX IF NOT EXISTS idx_product_source_documents_extraction_status 
    ON public.product_source_documents(extraction_status);

-- 3. Enable RLS
ALTER TABLE public.product_source_documents ENABLE ROW LEVEL SECURITY;

-- 4. Policies for product_source_documents
DROP POLICY IF EXISTS "Authenticated users view product source documents" ON public.product_source_documents;
CREATE POLICY "Authenticated users view product source documents"
ON public.product_source_documents
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins insert product source documents" ON public.product_source_documents;
CREATE POLICY "Admins insert product source documents"
ON public.product_source_documents
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update product source documents" ON public.product_source_documents;
CREATE POLICY "Admins update product source documents"
ON public.product_source_documents
FOR UPDATE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete product source documents" ON public.product_source_documents;
CREATE POLICY "Admins delete product source documents"
ON public.product_source_documents
FOR DELETE TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()));

-- 5. Storage bucket setup: product-documents (private/internal-only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-documents', 'product-documents', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- 6. Storage bucket RLS policies
DROP POLICY IF EXISTS "Authenticated users view product documents" ON storage.objects;
CREATE POLICY "Authenticated users view product documents"
ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'product-documents');

DROP POLICY IF EXISTS "Admins upload product documents" ON storage.objects;
CREATE POLICY "Admins upload product documents"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-documents'
  AND public.is_admin_or_sub_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins update product documents" ON storage.objects;
CREATE POLICY "Admins update product documents"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-documents'
  AND public.is_admin_or_sub_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'product-documents'
  AND public.is_admin_or_sub_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins delete product documents" ON storage.objects;
CREATE POLICY "Admins delete product documents"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-documents'
  AND public.is_admin_or_sub_admin(auth.uid())
);

-- 7. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
