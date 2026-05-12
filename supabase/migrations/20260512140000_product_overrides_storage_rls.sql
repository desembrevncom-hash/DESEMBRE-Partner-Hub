-- 1. Tạo bảng product_overrides nếu chưa có
create table if not exists public.product_overrides (
  no integer primary key,
  image_url text,
  link_url text,
  section text,
  name text,
  "desc" text,
  retail_size text,
  retail_price numeric,
  salon_size text,
  salon_price numeric,
  deleted boolean not null default false,
  is_custom boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 2. Bật RLS
alter table public.product_overrides enable row level security;

-- 3. Public/guest/sale/admin đều được đọc override sản phẩm
drop policy if exists "Public can read product overrides" on public.product_overrides;

create policy "Public can read product overrides"
on public.product_overrides
for select
to anon, authenticated
using (true);

-- 4. Chỉ ADMIN được thêm/sửa/xoá override
drop policy if exists "Admins insert overrides" on public.product_overrides;
drop policy if exists "Admins update overrides" on public.product_overrides;
drop policy if exists "Admins delete overrides" on public.product_overrides;

create policy "Admins insert overrides"
on public.product_overrides
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins update overrides"
on public.product_overrides
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins delete overrides"
on public.product_overrides
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- 5. Tạo bucket ảnh sản phẩm nếu chưa có
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update
set public = true;

-- 6. Public được xem ảnh sản phẩm
drop policy if exists "Public can view product images" on storage.objects;

create policy "Public can view product images"
on storage.objects
for select
using (bucket_id = 'product-images');

-- 7. ADMIN được upload/update/delete ảnh sản phẩm
drop policy if exists "Admins upload product images" on storage.objects;
drop policy if exists "Admins update product images" on storage.objects;
drop policy if exists "Admins delete product images" on storage.objects;

create policy "Admins upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.has_role(auth.uid(), 'admin')
);

create policy "Admins update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'product-images'
  and public.has_role(auth.uid(), 'admin')
);

create policy "Admins delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.has_role(auth.uid(), 'admin')
);

-- 8. Reload schema cache cho PostgREST
notify pgrst, 'reload schema';
