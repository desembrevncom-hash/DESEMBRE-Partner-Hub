-- 20260819000001_create_customer_audit_logs.sql

CREATE TABLE IF NOT EXISTS public.customer_audit_logs (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.customers(id) on delete cascade,
    action text not null,
    field_name text,
    old_value text,
    new_value text,
    actor_user_id uuid references auth.users(id) on delete set null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE public.customer_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all customer audit logs"
    ON public.customer_audit_logs
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sub_admin'));

-- Users can view logs of customers they have access to
CREATE POLICY "Users view audit logs of assigned customers"
    ON public.customer_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_audit_logs.customer_id
            AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid() OR c.user_id = auth.uid())
        )
    );

-- Creating index for fast querying by customer
CREATE INDEX IF NOT EXISTS idx_customer_audit_logs_customer_id ON public.customer_audit_logs(customer_id);
