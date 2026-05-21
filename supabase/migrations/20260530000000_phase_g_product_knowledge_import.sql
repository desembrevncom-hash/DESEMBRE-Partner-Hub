-- Phase G – Import audit table
CREATE TABLE IF NOT EXISTS public.product_knowledge_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES auth.users (id),
  source_type text NOT NULL,               -- 'csv' | 'json' | 'text'
  total_rows int NOT NULL,
  success_count int NOT NULL,
  error_count int NOT NULL,
  warning_count int NOT NULL,
  metadata jsonb,                         -- { fileName, duplicateAction, sourceType, importedAt, totalRows, warningsPreview }
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS – only admin/sub‑admin can read/insert
CREATE POLICY import_logs_admin_policy ON public.product_knowledge_import_logs
  FOR ALL
  USING (public.is_admin_or_sub_admin(auth.uid()))
  WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

ALTER TABLE public.product_knowledge_import_logs ENABLE ROW LEVEL SECURITY;
