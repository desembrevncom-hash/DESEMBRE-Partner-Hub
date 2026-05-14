alter table public.company_events
add column if not exists cancelled_at timestamptz,
add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
add column if not exists cancel_reason text;
