alter table public.company_events
add column if not exists google_calendar_event_id text,
add column if not exists google_calendar_html_link text,
add column if not exists google_sync_status text not null default 'not_synced',
add column if not exists google_synced_at timestamptz,
add column if not exists google_sync_error text;
