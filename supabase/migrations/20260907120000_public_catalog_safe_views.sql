-- Migration: Create public-safe catalog views and RLS policies
-- Exposes safe catalog columns for guest and authenticated users on /san-pham
-- Never exposes internal notes, cost, margin, supplier details, or private fields.

-- 1. Base table SELECT policies for anon and authenticated (active items only)
DROP POLICY IF EXISTS "Public select active brands" ON public.product_brands;
CREATE POLICY "Public select active brands" ON public.product_brands
FOR SELECT TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Public select active categories" ON public.product_categories;
CREATE POLICY "Public select active categories" ON public.product_categories
FOR SELECT TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Public select active products" ON public.catalog_products;
CREATE POLICY "Public select active products" ON public.catalog_products
FOR SELECT TO anon, authenticated
USING (status = 'active');

DROP POLICY IF EXISTS "Public select active variants" ON public.catalog_product_variants;
CREATE POLICY "Public select active variants" ON public.catalog_product_variants
FOR SELECT TO anon, authenticated
USING (is_active = true);

-- 2. Public Safe Views
-- View: public_product_brands
CREATE OR REPLACE VIEW public.public_product_brands
WITH (security_invoker = false)
AS
SELECT 
  id,
  name,
  code,
  slug,
  sort_order
FROM public.product_brands
WHERE is_active = true;

-- View: public_product_categories
CREATE OR REPLACE VIEW public.public_product_categories
WITH (security_invoker = false)
AS
SELECT 
  id,
  brand_id,
  name,
  slug,
  sort_order
FROM public.product_categories
WHERE is_active = true;

-- View: public_catalog_products
CREATE OR REPLACE VIEW public.public_catalog_products
WITH (security_invoker = false)
AS
SELECT 
  id,
  brand_id,
  category_id,
  product_code,
  name,
  description,
  image_url,
  status,
  sort_order
FROM public.catalog_products
WHERE status = 'active';

-- View: public_catalog_variants
CREATE OR REPLACE VIEW public.public_catalog_variants
WITH (security_invoker = false)
AS
SELECT 
  id,
  product_id,
  sku,
  channel,
  size_label,
  price,
  is_active,
  sort_order
FROM public.catalog_product_variants
WHERE is_active = true;

-- 3. Grant SELECT on views to anon and authenticated
GRANT SELECT ON public.public_product_brands TO anon, authenticated;
GRANT SELECT ON public.public_product_categories TO anon, authenticated;
GRANT SELECT ON public.public_catalog_products TO anon, authenticated;
GRANT SELECT ON public.public_catalog_variants TO anon, authenticated;

-- 4. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
