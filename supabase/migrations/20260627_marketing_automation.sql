CREATE TABLE public.marketing_automation_workflows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('customer_created', 'audience_member_added', 'manual_test_trigger')),
    audience_id UUID REFERENCES public.marketing_audiences(id),
    delay_amount INTEGER DEFAULT 0,
    delay_unit TEXT DEFAULT 'minutes' CHECK (delay_unit IN ('minutes', 'hours', 'days')),
    action_type TEXT NOT NULL CHECK (action_type IN ('create_mock_dispatch', 'add_to_mock_queue', 'log_only')),
    template_id UUID,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'paused', 'active_mock_only')),
    mock_only BOOLEAN DEFAULT true NOT NULL CHECK (mock_only = true),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.marketing_automation_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID REFERENCES public.marketing_automation_workflows(id),
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'mock_logged',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.marketing_automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_automation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view workflows" 
ON public.marketing_automation_workflows FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to insert workflows" 
ON public.marketing_automation_workflows FOR INSERT 
TO authenticated 
WITH CHECK (mock_only = true);

CREATE POLICY "Allow authenticated users to update workflows" 
ON public.marketing_automation_workflows FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to view events" 
ON public.marketing_automation_events FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to insert events" 
ON public.marketing_automation_events FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Indexes
CREATE INDEX idx_automation_workflows_status ON public.marketing_automation_workflows(status);
CREATE INDEX idx_automation_events_workflow_id ON public.marketing_automation_events(workflow_id);
