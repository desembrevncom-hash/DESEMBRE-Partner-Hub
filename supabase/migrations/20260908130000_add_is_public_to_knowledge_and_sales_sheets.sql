-- Migration: Add is_public column to product_knowledge and product_sales_sheets
-- Restricts public visibility so only human-reviewed, approved, and public-toggled content appears on public catalog.

-- 1. Add is_public column to product_knowledge
ALTER TABLE public.product_knowledge
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_product_knowledge_public_catalog
ON public.product_knowledge (is_public, qa_status, is_active);

-- 2. Add is_public column to product_sales_sheets
ALTER TABLE public.product_sales_sheets
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_product_sales_sheets_is_public
ON public.product_sales_sheets (catalog_product_id, is_public);

-- 3. RLS Policies: Allow public/anon to view approved + public knowledge
DROP POLICY IF EXISTS "Public can view approved public product knowledge" ON public.product_knowledge;
CREATE POLICY "Public can view approved public product knowledge"
ON public.product_knowledge
FOR SELECT TO anon, authenticated
USING (is_public = true AND qa_status = 'approved' AND is_active = true);

-- 4. RLS Policies: Allow public/anon to view public approved sales sheets
DROP POLICY IF EXISTS "Public can view public approved sales sheets" ON public.product_sales_sheets;
CREATE POLICY "Public can view public approved sales sheets"
ON public.product_sales_sheets
FOR SELECT TO anon, authenticated
USING (is_public = true AND status = 'approved');

-- 5. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
