-- Migration: Create product_knowledge_status_changes table with audit fields and status_reason_type

CREATE TABLE IF NOT EXISTS public.product_knowledge_status_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_knowledge_id uuid REFERENCES public.product_knowledge(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  status_reason_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_status_reason_type CHECK (
    status_reason_type IN (
      'content_update',
      'medical_claim_risk',
      'missing_information',
      'awaiting_review',
      'deprecated_product',
      'compliance_issue',
      'other'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_product_knowledge_status_changes_product ON public.product_knowledge_status_changes (product_knowledge_id);
CREATE INDEX IF NOT EXISTS idx_product_knowledge_status_changes_changed_by ON public.product_knowledge_status_changes (changed_by);
CREATE INDEX IF NOT EXISTS idx_product_knowledge_status_changes_created_at ON public.product_knowledge_status_changes (created_at DESC);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
