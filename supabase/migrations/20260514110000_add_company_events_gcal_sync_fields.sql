-- Migration: Thêm các trường quản lý đồng bộ Google Calendar trực tiếp cho bảng Sự kiện Công ty (company_events)
-- Yêu cầu thiết lập Status gồm: 'not_synced', 'synced', 'failed', 'cancelled'

alter table public.company_events
  add column if not exists google_calendar_event_id text,
  add column if not exists google_calendar_html_link text,
  add column if not exists google_sync_status text not null default 'not_synced',
  add column if not exists google_synced_at timestamptz,
  add column if not exists google_sync_error text;

-- Bổ sung check constraint đảm bảo giá trị hợp lệ cho google_sync_status theo đúng đặc tả
alter table public.company_events
  drop constraint if exists chk_company_events_google_sync_status;

alter table public.company_events
  add constraint chk_company_events_google_sync_status 
  check (google_sync_status in ('not_synced', 'synced', 'failed', 'cancelled'));

-- Kích hoạt thông báo làm mới bộ đệm cấu trúc (Schema Cache) cho PostgREST
notify pgrst, 'reload schema';
