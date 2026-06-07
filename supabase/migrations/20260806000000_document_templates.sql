-- Migration: Document Templates
-- Phase: v1.4.1T.1

CREATE TABLE IF NOT EXISTS public.document_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_type text NOT NULL CHECK (template_type IN ('quotation', 'product_sales_sheet', 'product_catalog_a4', 'customer_consultation_sheet')),
    name text NOT NULL,
    description text,
    layout_json jsonb DEFAULT '{}'::jsonb,
    html_template text,
    sample_data_json jsonb,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
    version integer DEFAULT 1 CHECK (version >= 1),
    is_default boolean DEFAULT false,
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- Admins / Sub-admins can do everything
CREATE POLICY "Admins can do everything on document_templates"
ON public.document_templates
FOR ALL
TO authenticated
USING ( public.is_admin_or_sub_admin(auth.uid()) )
WITH CHECK ( public.is_admin_or_sub_admin(auth.uid()) );

-- Sales / Telesales can read approved templates
CREATE POLICY "Sales can read approved document_templates"
ON public.document_templates
FOR SELECT
TO authenticated
USING (
  status = 'approved' AND 
  public.is_sales_member(auth.uid())
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_document_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER trg_document_templates_updated_at
BEFORE UPDATE ON public.document_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_document_templates_updated_at();
