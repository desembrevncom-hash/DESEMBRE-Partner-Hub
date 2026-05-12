-- Tạo bảng quản lý khách hàng (public.customers) dành cho nhân viên SALE và ADMIN
-- Cho phép SALE tự do thêm mới, theo dõi khách hàng của riêng mình, trong khi ADMIN có thể giám sát toàn bộ.

-- 1. Tạo bảng customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  facility_name text,
  phone text,
  address text,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Bật Row Level Security (RLS)
alter table public.customers enable row level security;

-- 3. Cấp quyền Đọc (SELECT): Quản trị viên được xem toàn bộ, Nhân viên SALE/Staff được xem khách của mình hoặc khách tự do
drop policy if exists "Users view customers" on public.customers;
create policy "Users view customers"
on public.customers
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin') 
  or user_id = auth.uid() 
  or user_id is null
);

-- 4. Cấp quyền Thêm mới (INSERT): Mọi tài khoản SALE/ADMIN đều có thể thêm khách hàng kèm user_id của chính mình
drop policy if exists "Users insert customers" on public.customers;
create policy "Users insert customers"
on public.customers
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin') 
  or user_id = auth.uid() 
  or user_id is null
);

-- 5. Cấp quyền Cập nhật (UPDATE): Chỉ tác giả tạo ra khách hàng hoặc ADMIN mới được sửa
drop policy if exists "Users update customers" on public.customers;
create policy "Users update customers"
on public.customers
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin') 
  or user_id = auth.uid()
)
with check (
  public.has_role(auth.uid(), 'admin') 
  or user_id = auth.uid()
);

-- 6. Cấp quyền Xóa (DELETE): Chỉ tác giả hoặc ADMIN mới được xóa
drop policy if exists "Users delete customers" on public.customers;
create policy "Users delete customers"
on public.customers
for delete
to authenticated
using (
  public.has_role(auth.uid(), 'admin') 
  or user_id = auth.uid()
);

-- 7. Kích hoạt thông báo làm mới bộ đệm cấu trúc (Schema Cache) cho PostgREST
notify pgrst, 'reload schema';
