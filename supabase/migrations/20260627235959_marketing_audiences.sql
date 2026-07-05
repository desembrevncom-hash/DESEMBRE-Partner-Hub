CREATE TABLE public.marketing_audiences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_computed_count INTEGER DEFAULT 0
);

ALTER TABLE public.marketing_audiences ENABLE ROW LEVEL SECURITY;

-- Policy đơn giản cho MVP: authenticated users có thể select/insert/update
CREATE POLICY "Allow authenticated users to view audiences" 
ON public.marketing_audiences FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to insert audiences" 
ON public.marketing_audiences FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update audiences" 
ON public.marketing_audiences FOR UPDATE 
TO authenticated 
USING (true);

CREATE INDEX idx_marketing_audiences_created_at ON public.marketing_audiences(created_at);
