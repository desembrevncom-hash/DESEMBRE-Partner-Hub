-- Mở rộng quyền truy vấn (SELECT) trên bảng profiles và user_roles cho toàn bộ người dùng đã xác thực (authenticated)
-- Đảm bảo giao diện quản trị luôn nạp được toàn bộ danh sách nhân viên SALE từ Cloud DB mà không bị bộ lọc RLS che khuất khi chuyển đổi trình duyệt hay xóa LocalStorage.

-- 1. Cập nhật RLS Select cho bảng public.profiles
drop policy if exists "Users view own profile" on public.profiles;
drop policy if exists "Admins view all profiles" on public.profiles;
drop policy if exists "Authenticated users view all profiles" on public.profiles;

create policy "Authenticated users view all profiles"
on public.profiles
for select
to authenticated
using (true);

-- 2. Cập nhật RLS Select cho bảng public.user_roles
drop policy if exists "Users view own roles" on public.user_roles;
drop policy if exists "Admins view all roles" on public.user_roles;
drop policy if exists "Authenticated users view all roles" on public.user_roles;

create policy "Authenticated users view all roles"
on public.user_roles
for select
to authenticated
using (true);

-- 3. Reload schema cache cho PostgREST
notify pgrst, 'reload schema';
