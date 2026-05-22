-- Migration: Create RAG Audit Logs Table (Phase P1)

CREATE TABLE IF NOT EXISTS public.rag_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    query text NOT NULL,
    selected_mode text NOT NULL, -- product_tutor | objection_handling | usage_script | compare_products
    similarity_threshold float NOT NULL,
    retrieved_chunks jsonb NOT NULL DEFAULT '[]'::jsonb,
    final_answer text,
    evaluation jsonb NOT NULL DEFAULT '{}'::jsonb, -- correct_retrieve, wrong_retrieve, hallucination, partial_answer, missing_knowledge, notes
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rag_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin and Sub Admin can manage rag_audit_logs
DROP POLICY IF EXISTS "Admin and Sub Admin can manage rag_audit_logs" ON public.rag_audit_logs;
CREATE POLICY "Admin and Sub Admin can manage rag_audit_logs"
ON public.rag_audit_logs
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
