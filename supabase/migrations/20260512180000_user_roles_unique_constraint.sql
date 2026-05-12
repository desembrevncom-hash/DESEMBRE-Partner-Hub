-- 1. Bổ sung ràng buộc duy nhất (Unique Constraint) cho bảng user_roles để hỗ trợ UPSERT an toàn
alter table public.user_roles
drop constraint if exists user_roles_user_id_role_key;

alter table public.user_roles
add constraint user_roles_user_id_role_key
unique (user_id, role);

-- 2. Tự động rà soát và chèn vá (Backfill) hồ sơ vào bảng public.profiles cho các tài khoản Auth còn sót
insert into public.profiles (
  id,
  email,
  display_name,
  must_change_password
)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  ),
  true
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name;

-- 3. Tự động gán quyền 'sale' mặc định cho các tài khoản Auth chưa có role (trừ admin chính)
insert into public.user_roles (
  user_id,
  role
)
select
  u.id,
  'sale'
from auth.users u
left join public.user_roles r on r.user_id = u.id
where r.user_id is null
  and u.email <> 'desembrevn.com@gmail.com'
on conflict do nothing;

-- 4. Kích hoạt làm mới bộ đệm PostgREST
notify pgrst, 'reload schema';
