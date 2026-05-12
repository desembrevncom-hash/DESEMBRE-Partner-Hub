CREATE TABLE public.product_overrides (
  no INTEGER PRIMARY KEY,
  image_url TEXT,
  link_url TEXT,
  section TEXT,
  name TEXT,
  "desc" TEXT,
  retail_size TEXT,
  retail_price NUMERIC,
  salon_size TEXT,
  salon_price NUMERIC,
  deleted BOOLEAN NOT NULL DEFAULT false,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read product overrides"
ON public.product_overrides FOR SELECT USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT USING (bucket_id = 'product-images');