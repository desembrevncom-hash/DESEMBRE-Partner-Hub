-- Enable RLS for the new calendar enterprise tables
alter table public.company_events enable row level security;
alter table public.event_registrations enable row level security;

-- ==========================================
-- Policies for company_events
-- ==========================================

-- 1. Admins have full access to company events
create policy "Admins manage company events"
on public.company_events
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 2. Sales can view published, closed, or completed events
create policy "Sales view active company events"
on public.company_events
for select
to authenticated
using (
  public.has_role(auth.uid(), 'sale')
  and status in ('published', 'closed', 'completed')
);

-- ==========================================
-- Policies for event_registrations
-- ==========================================

-- 1. Admins have full access to all registrations
create policy "Admins manage all event registrations"
on public.event_registrations
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 2. Sales can view registrations they created or are assigned to
create policy "Sales view own event registrations"
on public.event_registrations
for select
to authenticated
using (
  registered_by = auth.uid()
  or assigned_sale_id = auth.uid()
);

-- 3. Sales can create registrations (must set themselves as registered_by or assigned_sale_id)
create policy "Sales create event registrations"
on public.event_registrations
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'sale')
  and (
    registered_by = auth.uid()
    or assigned_sale_id = auth.uid()
  )
);

-- 4. Sales can update registrations they created or are assigned to
create policy "Sales update own event registrations"
on public.event_registrations
for update
to authenticated
using (
  registered_by = auth.uid()
  or assigned_sale_id = auth.uid()
)
with check (
  registered_by = auth.uid()
  or assigned_sale_id = auth.uid()
);

-- 5. Sales can delete registrations they created (optional, but good for cleanup)
create policy "Sales delete own registrations"
on public.event_registrations
for delete
to authenticated
using (
  registered_by = auth.uid()
);
