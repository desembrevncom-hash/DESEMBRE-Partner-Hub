-- Migration: Add QA fields to product_knowledge and review fields

ALTER TABLE public.product_knowledge
  ADD COLUMN IF NOT EXISTS qa_status text NOT NULL DEFAULT 'draft' CHECK (qa_status IN ('draft', 'review', 'approved', 'archived')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS knowledge_version integer,
  ADD COLUMN IF NOT EXISTS status_reason_type text;

-- Optional: create index for status_reason_type if needed
CREATE INDEX IF NOT EXISTS idx_product_knowledge_status_reason_type ON public.product_knowledge (status_reason_type);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
