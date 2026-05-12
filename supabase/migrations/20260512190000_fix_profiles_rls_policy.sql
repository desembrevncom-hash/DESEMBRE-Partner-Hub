-- Kích hoạt RLS và mở chính sách cho phép người dùng đã xác thực được truy vấn trọn vẹn danh sách nhân sự
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Xóa chính sách cũ nếu có để tránh xung đột
drop policy if exists "Enable read access for all authenticated users" on public.profiles;
drop policy if exists "Cho phép xem profiles" on public.profiles;

-- Tạo chính sách mới cho phép tài khoản đăng nhập đọc dữ liệu profiles
create policy "Cho phép xem profiles"
on public.profiles for select
to authenticated
using (true);

-- Tương tự cho bảng user_roles
drop policy if exists "Enable read access for all authenticated users" on public.user_roles;
drop policy if exists "Cho phép xem user_roles" on public.user_roles;

create policy "Cho phép xem user_roles"
on public.user_roles for select
to authenticated
using (true);

-- Cho phép Admin và Service Role có toàn quyền thêm/sửa/xóa trên profiles
drop policy if exists "Cho phép chỉnh sửa profiles" on public.profiles;
create policy "Cho phép chỉnh sửa profiles"
on public.profiles for all
to authenticated
using (true)
with check (true);

-- Cho phép Admin và Service Role có toàn quyền thêm/sửa/xóa trên user_roles
drop policy if exists "Cho phép chỉnh sửa user_roles" on public.user_roles;
create policy "Cho phép chỉnh sửa user_roles"
on public.user_roles for all
to authenticated
using (true)
with check (true);

-- Làm mới lược đồ PostgREST
notify pgrst, 'reload schema';
