-- Phase H: Add build_status and related fields to product_knowledge

ALTER TABLE public.product_knowledge
ADD COLUMN IF NOT EXISTS build_status text CHECK (build_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_embedded_at timestamptz,
ADD COLUMN IF NOT EXISTS embedding_error text;

-- Ensure is_active is present on chunks (though previous migrations might have added it)
ALTER TABLE public.product_knowledge_chunks
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Ensure index for fast querying active chunks
CREATE INDEX IF NOT EXISTS idx_pk_chunks_is_active ON public.product_knowledge_chunks(product_id, is_active);

-- Ensure Realtime can broadcast these changes if needed
-- (Assuming product_knowledge is already in the realtime publication)
