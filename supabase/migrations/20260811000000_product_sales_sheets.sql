-- Migration: Product Sales Sheets table and policies
-- Phase: v1.4.1T.2

CREATE TABLE IF NOT EXISTS public.product_sales_sheets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id uuid REFERENCES public.product_brands(id) ON DELETE CASCADE,
    catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE CASCADE,
    template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
    title text NOT NULL,
    content_json jsonb NOT NULL,
    html_snapshot text,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
    generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for querying by product
CREATE INDEX IF NOT EXISTS idx_product_sales_sheets_catalog_product ON public.product_sales_sheets(catalog_product_id);

-- Enable RLS
ALTER TABLE public.product_sales_sheets ENABLE ROW LEVEL SECURITY;

-- Admins / Sub-admins can do everything
CREATE POLICY "Admins can do everything on product_sales_sheets"
ON public.product_sales_sheets
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'sub_admin')
  )
);

-- Sales / Telesales can read approved sales sheets
CREATE POLICY "Sales can read approved product_sales_sheets"
ON public.product_sales_sheets
FOR SELECT
USING (
  status = 'approved' AND 
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('sale', 'telesale')
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_product_sales_sheets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_sales_sheets_updated_at ON public.product_sales_sheets;
CREATE TRIGGER trg_product_sales_sheets_updated_at
BEFORE UPDATE ON public.product_sales_sheets
FOR EACH ROW
EXECUTE FUNCTION public.handle_product_sales_sheets_updated_at();
