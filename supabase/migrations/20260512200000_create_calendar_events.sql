-- Migration: Tạo bảng quản lý Lịch hẹn / Follow-up (public.calendar_events)
-- Cho phép SALE và ADMIN quản lý các sự kiện hẹn giờ, nhắc việc, check-in theo đúng yêu cầu MVP.

-- 1. Tạo bảng calendar_events
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  assigned_sale_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  
  title text not null,
  description text,
  event_type text not null default 'follow_up',
  status text not null default 'pending',
  
  starts_at timestamptz not null,
  ends_at timestamptz,
  
  remind_before_minutes integer not null default 30,
  reminder_sent_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Đánh chỉ mục (Indexes) để tối ưu truy vấn bộ lọc và realtime
create index if not exists idx_calendar_events_starts_at on public.calendar_events(starts_at);
create index if not exists idx_calendar_events_assigned_sale_id on public.calendar_events(assigned_sale_id);
create index if not exists idx_calendar_events_customer_id on public.calendar_events(customer_id);
create index if not exists idx_calendar_events_status on public.calendar_events(status);
create index if not exists idx_calendar_events_event_type on public.calendar_events(event_type);

-- 3. Kích hoạt Row Level Security (RLS)
alter table public.calendar_events enable row level security;

-- 4. Định nghĩa các Policy phân quyền (RLS Policies)

-- Quyền Đọc (SELECT): Admin xem tất cả; Sale xem lịch phân công cho mình hoặc do mình tạo
drop policy if exists "Users view allowed calendar events" on public.calendar_events;
create policy "Users view allowed calendar events"
on public.calendar_events
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or assigned_sale_id = auth.uid()
  or created_by = auth.uid()
);

-- Quyền Thêm (INSERT): Admin và Sale được phép tạo lịch
drop policy if exists "Users insert calendar events" on public.calendar_events;
create policy "Users insert calendar events"
on public.calendar_events
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'sale')
  or created_by = auth.uid()
);

-- Quyền Sửa (UPDATE): Admin sửa tất cả; Sale chỉ sửa/cập nhật lịch của mình
drop policy if exists "Users update allowed calendar events" on public.calendar_events;
create policy "Users update allowed calendar events"
on public.calendar_events
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or assigned_sale_id = auth.uid()
  or created_by = auth.uid()
)
with check (
  public.has_role(auth.uid(), 'admin')
  or assigned_sale_id = auth.uid()
  or created_by = auth.uid()
);

-- Quyền Xóa (DELETE): Admin xóa tất cả; Sale không được xóa vật lý (chỉ được phép UPDATE hủy lịch theo policy trên)
drop policy if exists "Admins delete calendar events" on public.calendar_events;
create policy "Admins delete calendar events"
on public.calendar_events
for delete
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
);

-- 5. Kích hoạt thông báo làm mới bộ đệm cấu trúc (Schema Cache) cho PostgREST
notify pgrst, 'reload schema';
