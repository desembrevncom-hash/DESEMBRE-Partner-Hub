-- Migration: Add is_active and knowledge_version columns to product_knowledge_chunks

ALTER TABLE public.product_knowledge_chunks
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS knowledge_version integer;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
