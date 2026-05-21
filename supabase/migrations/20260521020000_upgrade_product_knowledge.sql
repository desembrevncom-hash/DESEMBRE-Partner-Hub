-- Migration: Upgrade product knowledge with structured data (Phase 6.5 & 6.6 Step 1)

-- 1. Add structured fields to product_knowledge
ALTER TABLE public.product_knowledge
ADD COLUMN IF NOT EXISTS skin_type text[],
ADD COLUMN IF NOT EXISTS contraindications text[],
ADD COLUMN IF NOT EXISTS ingredient_highlights text[],
ADD COLUMN IF NOT EXISTS routine_position text,
ADD COLUMN IF NOT EXISTS seasonal_usage text[],
ADD COLUMN IF NOT EXISTS pregnancy_safe boolean DEFAULT true;

-- 2. Create product_faqs table for FAQ Editor
CREATE TABLE IF NOT EXISTS public.product_faqs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id integer NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_faqs_product_id ON public.product_faqs (product_id);
CREATE INDEX IF NOT EXISTS idx_product_faqs_is_active ON public.product_faqs (is_active);

-- Enable RLS for FAQs
ALTER TABLE public.product_faqs ENABLE ROW LEVEL SECURITY;

-- Policies for FAQs (Admin manage, Sale view)
DROP POLICY IF EXISTS "Admin and Sub Admin can manage product faqs" ON public.product_faqs;
CREATE POLICY "Admin and Sub Admin can manage product faqs"
ON public.product_faqs
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Sales staff can view active product faqs" ON public.product_faqs;
CREATE POLICY "Sales staff can view active product faqs"
ON public.product_faqs
FOR SELECT
TO authenticated
USING (
    is_active = true 
    AND (
        public.is_sales_member(auth.uid()) 
        OR public.is_admin_or_sub_admin(auth.uid())
    )
);

-- 3. Create Storage Bucket for product_knowledge_docs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product_knowledge_docs', 'product_knowledge_docs', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for the bucket
-- Allow authenticated users to view/download
DROP POLICY IF EXISTS "Allow authenticated users to read product docs" ON storage.objects;
CREATE POLICY "Allow authenticated users to read product docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product_knowledge_docs');

-- Allow Admin/Sub Admin to upload/update/delete
DROP POLICY IF EXISTS "Allow admins to manage product docs" ON storage.objects;
CREATE POLICY "Allow admins to manage product docs"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'product_knowledge_docs' AND public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (bucket_id = 'product_knowledge_docs' AND public.is_admin_or_sub_admin(auth.uid()));

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
