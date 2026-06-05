-- ============================================================================
-- MIGRATION: Phase v1.4.1B — Multi-brand Catalog & Untracked Inventory Foundation
-- ============================================================================

-- 1. Create product_brands table
CREATE TABLE IF NOT EXISTS public.product_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_brands_name_not_empty CHECK (name <> ''),
  CONSTRAINT product_brands_slug_not_empty CHECK (slug <> ''),
  CONSTRAINT product_brands_code_not_empty CHECK (code <> '')
);

-- Seed Initial Brands (Idempotent)
INSERT INTO public.product_brands (name, slug, code, description, is_active, sort_order)
VALUES 
  ('Desembre', 'desembre', 'DESEMBRE', 'Thương hiệu mỹ phẩm cao cấp Desembre Hàn Quốc', true, 1),
  ('Dermagarden', 'dermagarden', 'DERMAGARDEN', 'Thương hiệu chăm sóc da chuyên sâu Dermagarden', true, 2),
  ('VAVAW', 'vavaw', 'VAVAW', 'Thương hiệu trang điểm và chăm sóc da VAVAW', true, 3)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name,
    code = EXCLUDED.code,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- 2. Create product_categories table
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.product_brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_categories_name_not_empty CHECK (name <> ''),
  CONSTRAINT product_categories_slug_not_empty CHECK (slug <> ''),
  CONSTRAINT product_categories_brand_slug_unique UNIQUE (brand_id, slug)
);

-- 3. Create catalog_products table
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.product_brands(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  product_code text,
  name text NOT NULL,
  description text,
  image_url text,
  catalog_url text,
  status text NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT catalog_products_name_not_empty CHECK (name <> ''),
  CONSTRAINT catalog_products_status_check CHECK (status IN ('active', 'inactive', 'archived'))
);

-- Conditional unique partial index for brand_id and product_code
CREATE UNIQUE INDEX IF NOT EXISTS catalog_products_brand_product_code_idx 
ON public.catalog_products (brand_id, product_code) 
WHERE product_code IS NOT NULL;

-- 4. Create catalog_product_variants table
CREATE TABLE IF NOT EXISTS public.catalog_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.product_brands(id) ON DELETE CASCADE,
  sku text NOT NULL,
  channel text NOT NULL,
  size_label text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'VND',
  inventory_tracking_enabled boolean NOT NULL DEFAULT false,
  stock_policy text NOT NULL DEFAULT 'untracked',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_variants_price_check CHECK (price >= 0),
  CONSTRAINT catalog_product_variants_channel_check CHECK (channel IN ('retail', 'salon')),
  CONSTRAINT catalog_product_variants_stock_policy_check CHECK (stock_policy IN ('untracked', 'tracked')),
  CONSTRAINT catalog_product_variants_sku_brand_unique UNIQUE (brand_id, sku)
);

-- Unique expression index: product_id + channel + COALESCE(size_label, '')
CREATE UNIQUE INDEX IF NOT EXISTS catalog_product_variants_prod_channel_size_idx 
ON public.catalog_product_variants (product_id, channel, COALESCE(size_label, ''));

-- 5. Create inventory_stocks table (untracked staging foundation)
CREATE TABLE IF NOT EXISTS public.inventory_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.catalog_product_variants(id) ON DELETE CASCADE,
  sku text NOT NULL,
  stock_on_hand numeric NOT NULL DEFAULT 0,
  stock_reserved numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'untracked',
  last_counted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_stocks_variant_id_unique UNIQUE (variant_id),
  CONSTRAINT inventory_stocks_stock_on_hand_check CHECK (stock_on_hand >= 0),
  CONSTRAINT inventory_stocks_stock_reserved_check CHECK (stock_reserved >= 0),
  CONSTRAINT inventory_stocks_status_check CHECK (status IN ('untracked', 'needs_count', 'in_stock', 'low_stock', 'out_of_stock', 'inactive'))
);

-- 6. Product Knowledge Schema Alignment (Non-breaking)
DO $$
BEGIN
  -- Alter product_knowledge if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_knowledge') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge' AND column_name = 'brand_id') THEN
      ALTER TABLE public.product_knowledge ADD COLUMN brand_id uuid REFERENCES public.product_brands(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge' AND column_name = 'category_id') THEN
      ALTER TABLE public.product_knowledge ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge' AND column_name = 'catalog_product_id') THEN
      ALTER TABLE public.product_knowledge ADD COLUMN catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge' AND column_name = 'knowledge_type') THEN
      ALTER TABLE public.product_knowledge ADD COLUMN knowledge_type text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge' AND column_name = 'status') THEN
      ALTER TABLE public.product_knowledge ADD COLUMN status text DEFAULT 'draft';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge' AND column_name = 'version') THEN
      ALTER TABLE public.product_knowledge ADD COLUMN version int DEFAULT 1;
    END IF;
    
    -- Add constraint if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND table_name = 'product_knowledge' AND constraint_name = 'product_knowledge_status_check') THEN
      ALTER TABLE public.product_knowledge ADD CONSTRAINT product_knowledge_status_check CHECK (status IN ('draft', 'review', 'published', 'archived'));
    END IF;
  END IF;

  -- Alter product_knowledge_chunks if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_knowledge_chunks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge_chunks' AND column_name = 'brand_id') THEN
      ALTER TABLE public.product_knowledge_chunks ADD COLUMN brand_id uuid REFERENCES public.product_brands(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge_chunks' AND column_name = 'category_id') THEN
      ALTER TABLE public.product_knowledge_chunks ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge_chunks' AND column_name = 'catalog_product_id') THEN
      ALTER TABLE public.product_knowledge_chunks ADD COLUMN catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge_chunks' AND column_name = 'status') THEN
      ALTER TABLE public.product_knowledge_chunks ADD COLUMN status text DEFAULT 'draft';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge_chunks' AND column_name = 'embedding_model') THEN
      ALTER TABLE public.product_knowledge_chunks ADD COLUMN embedding_model text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_knowledge_chunks' AND column_name = 'embedding_version') THEN
      ALTER TABLE public.product_knowledge_chunks ADD COLUMN embedding_version text;
    END IF;
  END IF;
END $$;

-- 7. Setup updated_at Triggers (Idempotent)
DROP TRIGGER IF EXISTS set_product_brands_updated_at ON public.product_brands;
CREATE TRIGGER set_product_brands_updated_at
  BEFORE UPDATE ON public.product_brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_product_categories_updated_at ON public.product_categories;
CREATE TRIGGER set_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_catalog_products_updated_at ON public.catalog_products;
CREATE TRIGGER set_catalog_products_updated_at
  BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_catalog_product_variants_updated_at ON public.catalog_product_variants;
CREATE TRIGGER set_catalog_product_variants_updated_at
  BEFORE UPDATE ON public.catalog_product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_inventory_stocks_updated_at ON public.inventory_stocks;
CREATE TRIGGER set_inventory_stocks_updated_at
  BEFORE UPDATE ON public.inventory_stocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Row Level Security Configuration

ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stocks ENABLE ROW LEVEL SECURITY;

-- 8a. Admin/Sub-admin Policies (SELECT, INSERT, UPDATE - No DELETE granted)
DROP POLICY IF EXISTS "Admin select product_brands" ON public.product_brands;
CREATE POLICY "Admin select product_brands" ON public.product_brands FOR SELECT TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin insert product_brands" ON public.product_brands;
CREATE POLICY "Admin insert product_brands" ON public.product_brands FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update product_brands" ON public.product_brands;
CREATE POLICY "Admin update product_brands" ON public.product_brands FOR UPDATE TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin select product_categories" ON public.product_categories;
CREATE POLICY "Admin select product_categories" ON public.product_categories FOR SELECT TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin insert product_categories" ON public.product_categories;
CREATE POLICY "Admin insert product_categories" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update product_categories" ON public.product_categories;
CREATE POLICY "Admin update product_categories" ON public.product_categories FOR UPDATE TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin select catalog_products" ON public.catalog_products;
CREATE POLICY "Admin select catalog_products" ON public.catalog_products FOR SELECT TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin insert catalog_products" ON public.catalog_products;
CREATE POLICY "Admin insert catalog_products" ON public.catalog_products FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update catalog_products" ON public.catalog_products;
CREATE POLICY "Admin update catalog_products" ON public.catalog_products FOR UPDATE TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin select catalog_product_variants" ON public.catalog_product_variants;
CREATE POLICY "Admin select catalog_product_variants" ON public.catalog_product_variants FOR SELECT TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin insert catalog_product_variants" ON public.catalog_product_variants;
CREATE POLICY "Admin insert catalog_product_variants" ON public.catalog_product_variants FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update catalog_product_variants" ON public.catalog_product_variants;
CREATE POLICY "Admin update catalog_product_variants" ON public.catalog_product_variants FOR UPDATE TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin select inventory_stocks" ON public.inventory_stocks;
CREATE POLICY "Admin select inventory_stocks" ON public.inventory_stocks FOR SELECT TO authenticated USING (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin insert inventory_stocks" ON public.inventory_stocks;
CREATE POLICY "Admin insert inventory_stocks" ON public.inventory_stocks FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update inventory_stocks" ON public.inventory_stocks;
CREATE POLICY "Admin update inventory_stocks" ON public.inventory_stocks FOR UPDATE TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- 8b. Sales/Telesales/Tele Lead Policies (SELECT active only)
DROP POLICY IF EXISTS "Sales can view active brands" ON public.product_brands;
CREATE POLICY "Sales can view active brands"
ON public.product_brands FOR SELECT TO authenticated
USING (is_active = true AND (public.is_sales_member(auth.uid()) OR public.is_admin_or_sub_admin(auth.uid())));

DROP POLICY IF EXISTS "Sales can view active categories" ON public.product_categories;
CREATE POLICY "Sales can view active categories"
ON public.product_categories FOR SELECT TO authenticated
USING (is_active = true AND (public.is_sales_member(auth.uid()) OR public.is_admin_or_sub_admin(auth.uid())));

DROP POLICY IF EXISTS "Sales can view active products" ON public.catalog_products;
CREATE POLICY "Sales can view active products"
ON public.catalog_products FOR SELECT TO authenticated
USING (status = 'active' AND (public.is_sales_member(auth.uid()) OR public.is_admin_or_sub_admin(auth.uid())));

DROP POLICY IF EXISTS "Sales can view active variants" ON public.catalog_product_variants;
CREATE POLICY "Sales can view active variants"
ON public.catalog_product_variants FOR SELECT TO authenticated
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1 FROM public.catalog_products 
    WHERE catalog_products.id = catalog_product_variants.product_id 
    AND catalog_products.status = 'active'
  )
  AND (public.is_sales_member(auth.uid()) OR public.is_admin_or_sub_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Sales can view inventory of active variants" ON public.inventory_stocks;
CREATE POLICY "Sales can view inventory of active variants"
ON public.inventory_stocks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.catalog_product_variants v
    JOIN public.catalog_products p ON p.id = v.product_id
    WHERE v.id = inventory_stocks.variant_id
    AND v.is_active = true
    AND p.status = 'active'
  )
  AND (public.is_sales_member(auth.uid()) OR public.is_admin_or_sub_admin(auth.uid()))
);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
