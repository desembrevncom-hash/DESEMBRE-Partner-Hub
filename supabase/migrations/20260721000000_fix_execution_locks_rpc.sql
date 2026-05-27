-- Create a view to act as an alias for system_execution_locks
-- This fixes the error in get_automation_governance_summary where it queries execution_locks instead of system_execution_locks

CREATE OR REPLACE VIEW public.execution_locks AS 
SELECT * FROM public.system_execution_locks;

-- Grant permissions to the view
GRANT SELECT ON public.execution_locks TO authenticated;
GRANT SELECT ON public.execution_locks TO anon;
GRANT SELECT ON public.execution_locks TO service_role;
