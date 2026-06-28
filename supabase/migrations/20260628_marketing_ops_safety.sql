CREATE TABLE IF NOT EXISTS public.marketing_ops_safety_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    is_default BOOLEAN DEFAULT true NOT NULL,
    global_kill_switch BOOLEAN DEFAULT true NOT NULL,
    email_enabled BOOLEAN DEFAULT false NOT NULL,
    zalo_enabled BOOLEAN DEFAULT false NOT NULL,
    require_admin_approval BOOLEAN DEFAULT true NOT NULL,
    daily_send_quota INTEGER DEFAULT 0 NOT NULL CHECK (daily_send_quota >= 0),
    per_campaign_quota INTEGER DEFAULT 0 NOT NULL CHECK (per_campaign_quota >= 0),
    cooldown_minutes INTEGER DEFAULT 0 NOT NULL CHECK (cooldown_minutes >= 0),
    duplicate_prevention_hours INTEGER DEFAULT 24 NOT NULL CHECK (duplicate_prevention_hours >= 0),
    notes TEXT,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one default row exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_safety_singleton ON public.marketing_ops_safety_settings (is_default) WHERE is_default = true;

-- Seed the initial fail-closed state
INSERT INTO public.marketing_ops_safety_settings (
    is_default, 
    global_kill_switch, 
    email_enabled, 
    zalo_enabled, 
    require_admin_approval, 
    daily_send_quota, 
    per_campaign_quota, 
    cooldown_minutes, 
    duplicate_prevention_hours, 
    notes
) VALUES (
    true, true, false, false, true, 0, 0, 0, 24, 'Initial Fail-Closed Settings'
) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.marketing_suppression_list (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID,
    email TEXT,
    phone TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'zalo', 'all')),
    reason TEXT,
    source TEXT DEFAULT 'admin' NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CHECK (customer_id IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL)
);

-- RLS
ALTER TABLE public.marketing_ops_safety_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_suppression_list ENABLE ROW LEVEL SECURITY;

-- Safety Settings Policies
DROP POLICY IF EXISTS "Allow authenticated users to view safety settings" ON public.marketing_ops_safety_settings;
CREATE POLICY "Allow authenticated users to view safety settings" 
ON public.marketing_ops_safety_settings FOR SELECT 
TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update safety settings" ON public.marketing_ops_safety_settings;
CREATE POLICY "Allow authenticated users to update safety settings" 
ON public.marketing_ops_safety_settings FOR UPDATE 
TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert safety settings" ON public.marketing_ops_safety_settings;
CREATE POLICY "Allow authenticated users to insert safety settings" 
ON public.marketing_ops_safety_settings FOR INSERT 
TO authenticated WITH CHECK (true);

-- Suppression List Policies
DROP POLICY IF EXISTS "Allow authenticated users to view suppression list" ON public.marketing_suppression_list;
CREATE POLICY "Allow authenticated users to view suppression list" 
ON public.marketing_suppression_list FOR SELECT 
TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert suppression list" ON public.marketing_suppression_list;
CREATE POLICY "Allow authenticated users to insert suppression list" 
ON public.marketing_suppression_list FOR INSERT 
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update suppression list" ON public.marketing_suppression_list;
CREATE POLICY "Allow authenticated users to update suppression list" 
ON public.marketing_suppression_list FOR UPDATE 
TO authenticated USING (true);
