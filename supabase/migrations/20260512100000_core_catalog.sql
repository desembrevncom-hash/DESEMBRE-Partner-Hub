-- Migration script for core catalog tables: categories, products, product_variants

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  name_vi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories" 
ON public.categories FOR SELECT USING (true);

CREATE POLICY "Admin write categories" 
ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));


-- 2. Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES public.categories(id) ON DELETE RESTRICT,
  image_url TEXT,
  link_url TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read products" 
ON public.products FOR SELECT USING (true);

CREATE POLICY "Admin write products" 
ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));


-- 3. Create product_variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
  id TEXT PRIMARY KEY,
  product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('retail', 'salon')),
  size TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product variants" 
ON public.product_variants FOR SELECT USING (true);

CREATE POLICY "Admin write product variants" 
ON public.product_variants FOR ALL USING (public.has_role(auth.uid(), 'admin'));


-- Seed Categories
INSERT INTO public.categories (id, name, name_vi) VALUES
('CLEANSER', 'CLEANSER', 'Làm sạch'),
('TONER', 'TONER', 'Cân bằng'),
('CREAM MASK', 'CREAM MASK', 'Mặt nạ kem'),
('PROTECTION CARE', 'PROTECTION CARE', 'Chống nắng'),
('CREAM', 'CREAM', 'Kem dưỡng'),
('SERUM', 'SERUM', NULL),
('CONCENTRATE', 'CONCENTRATE', 'Tinh chất cô đặc'),
('AMPOULE', 'AMPOULE', 'Dịch chiết TBG'),
('AMPOULING', 'AMPOULING', 'Huyết thanh'),
('ESSENCE', 'ESSENCE', 'Tinh chất'),
('GEL', 'GEL', NULL),
('MASSAGE', 'MASSAGE', NULL),
('SHEET MASK', 'SHEET MASK', 'Mặt nạ miếng'),
('MODELING', 'MODELING', 'Mặt nạ thạch'),
('THERAPY TREATMENT / SET', 'THERAPY TREATMENT / SET', 'Set chăm sóc chuyên sâu')
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, name_vi = EXCLUDED.name_vi;
