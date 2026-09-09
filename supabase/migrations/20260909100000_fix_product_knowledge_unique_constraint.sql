-- 1. Archive duplicate rows, keeping only the best row active for each catalog_product_id
-- Best row: is_active = true and qa_status = 'approved' (priority 1), then sort by updated_at DESC.
WITH RankedRows AS (
    SELECT id, catalog_product_id,
        ROW_NUMBER() OVER(
            PARTITION BY catalog_product_id 
            ORDER BY 
                CASE WHEN is_active = true AND qa_status = 'approved' THEN 1
                     WHEN is_active = true THEN 2
                     ELSE 3 END,
                updated_at DESC, 
                created_at DESC
        ) as rn
    FROM public.product_knowledge
    WHERE catalog_product_id IS NOT NULL
)
UPDATE public.product_knowledge pk
SET 
    catalog_product_id = NULL,
    is_active = false,
    qa_status = CASE WHEN pk.qa_status = 'approved' THEN 'archived' ELSE pk.qa_status END,
    updated_at = NOW()
FROM RankedRows rr
WHERE pk.id = rr.id AND rr.rn > 1;

-- 2. Add the unique index
CREATE UNIQUE INDEX IF NOT EXISTS product_knowledge_catalog_product_id_unique
ON public.product_knowledge (catalog_product_id);
