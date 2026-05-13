-- Migration: Tạo cấu trúc bảng cho Sự kiện công ty và Đăng ký tham dự
-- Bảng 1: public.company_events (Sự kiện/Chiến dịch do Admin tạo)
create table if not exists public.company_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'workshop',
  status text not null default 'draft',
  
  starts_at timestamptz not null,
  ends_at timestamptz,
  
  location text,
  meeting_url text,
  capacity integer,
  registration_deadline timestamptz,
  
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bảng 2: public.event_registrations (Danh sách khách hàng đăng ký tham gia sự kiện)
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.company_events(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  
  registered_by uuid references auth.users(id) on delete set null,
  assigned_sale_id uuid references auth.users(id) on delete set null,
  
  customer_name text,
  customer_phone text,
  customer_business_name text,
  
  status text not null default 'registered',
  note text,
  
  checked_in_at timestamptz,
  converted_order_id uuid references public.orders(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Đánh chỉ mục (Indexes) tối ưu hóa tốc độ truy vấn và bộ lọc
create index if not exists idx_company_events_starts_at on public.company_events(starts_at);
create index if not exists idx_company_events_status on public.company_events(status);
create index if not exists idx_company_events_type on public.company_events(event_type);

create index if not exists idx_event_registrations_event_id on public.event_registrations(event_id);
create index if not exists idx_event_registrations_customer_id on public.event_registrations(customer_id);
create index if not exists idx_event_registrations_assigned_sale on public.event_registrations(assigned_sale_id);
create index if not exists idx_event_registrations_status on public.event_registrations(status);

-- Kích hoạt thông báo làm mới bộ đệm cấu trúc (Schema Cache) cho PostgREST
notify pgrst, 'reload schema';
