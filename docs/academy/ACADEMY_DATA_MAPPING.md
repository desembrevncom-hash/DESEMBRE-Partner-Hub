# Ánh Xạ Dữ Liệu Học Viện (Academy Data Mapping)

## Thông tin chi tiết ánh xạ

- **customer table**
  - Phân loại: FACT
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/20260512170000_create_customers_table.sql`
  - Lines: 4-14
  - Nội dung: Dữ liệu khách hàng được lưu ở bảng `public.customers`.

- **primary key**
  - Phân loại: FACT
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/20260512170000_create_customers_table.sql`
  - Lines: 6
  - Nội dung: `id uuid primary key default gen_random_uuid()`

- **customer name field**
  - Phân loại: FACT
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/20260512170000_create_customers_table.sql`
  - Lines: 7
  - Nội dung: `name text not null`

- **phone field**
  - Phân loại: FACT
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/20260512170000_create_customers_table.sql`
  - Lines: 9
  - Nội dung: `phone text`

- **phone format**
  - Phân loại: UNKNOWN
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/20260512170000_create_customers_table.sql`
  - Lines: 9
  - Nội dung: Không có ràng buộc định dạng (format constraint) cụ thể được tìm thấy trong schema.

- **phone normalization**
  - Phân loại: UNKNOWN
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/`
  - Lines: N/A
  - Nội dung: Chưa phát hiện trigger hoặc function tự động chuẩn hóa số điện thoại.

- **duplicate risk**
  - Phân loại: RISK
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/20260512170000_create_customers_table.sql`
  - Lines: 9
  - Nội dung: Cột phone không có `unique constraint`, dẫn đến rủi ro trùng lặp số điện thoại khách hàng.

- **role table**
  - Phân loại: FACT
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/20260512150000_profiles_roles_public_select.sql`
  - Lines: 15-24
  - Nội dung: Role được quản lý ở bảng `public.user_roles`.

- **admin detection**
  - Phân loại: FACT
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/20260512170000_create_customers_table.sql`
  - Lines: 26
  - Nội dung: Sử dụng hàm `public.has_role(auth.uid(), 'admin')` để xác định.

- **migration source of truth**
  - Phân loại: FACT
  - Repository: DESEMBRE-Partner-Hub
  - File: `supabase/migrations/`
  - Lines: N/A
  - Nội dung: Thư mục chứa 199 file SQL là nơi quyết định 100% schema.

- **student linking strategy**
  - Phân loại: RECOMMENDATION
  - Repository: DESEMBRE-Partner-Hub
  - File: N/A
  - Lines: N/A
  - Nội dung: Liên kết học viên Academy với hệ thống qua `user_id` (của bảng `auth.users`) thay vì dựa hoàn toàn vào `phone` để tránh rủi ro trùng lặp.

- **Các điểm UNKNOWN**
  - Chuẩn hóa đầu số (+84, 0x) của số điện thoại: UNKNOWN
  - Logic xác thực trùng lặp (merge logic) khi sáp nhập khách hàng: UNKNOWN
