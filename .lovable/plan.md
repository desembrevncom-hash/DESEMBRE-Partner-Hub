## Tổng quan

Thêm hệ thống tài khoản với 3 vai trò và tính năng quản lý đơn hàng cho SALE.

| Vai trò | Đăng nhập | Quyền |
|---|---|---|
| **CUSTOMER** | Không cần | Xem website (giá Consumer 100%, có/không VAT) |
| **SALE** | Email + mật khẩu | Xem giá đã chiết khấu 40%, lên đơn, xem lịch sử đơn của mình |
| **ADMIN** | Email + mật khẩu | Toàn quyền: sửa sản phẩm, tạo tài khoản SALE, xem tất cả đơn hàng |

## Database (Lovable Cloud)

**1. Bảng `profiles`** — thông tin user
- `id` (uuid, FK → auth.users), `email`, `display_name`, `created_at`

**2. Enum `app_role`** + bảng `user_roles` (tách riêng để tránh privilege escalation)
- `user_id`, `role` ('admin' | 'sale')
- Function `has_role(uuid, app_role)` SECURITY DEFINER

**3. Bảng `orders`** — đơn hàng
- `id`, `order_no` (auto), `sale_user_id`, `customer_name`, `customer_phone`, `customer_address`, `note`
- `subtotal`, `discount_rate` (0.4), `vat_rate`, `total`, `status` ('draft'|'confirmed')
- `created_at`, `updated_at`

**4. Bảng `order_items`**
- `id`, `order_id`, `product_no`, `product_name`, `size`, `size_type` ('retail'|'salon'), `unit_price`, `quantity`, `line_total`

**5. Trigger** `handle_new_user` — tự tạo profile khi signup. Mặc định gán role 'sale'. Admin tạo sau bằng SQL hoặc giao diện.

**RLS Policies**:
- `profiles`: user xem/sửa profile mình; admin xem tất cả
- `user_roles`: chỉ admin sửa; user xem role mình
- `product_overrides`: hiện đang public read; thêm policy chỉ ADMIN được insert/update/delete (thay thế EDIT_PASSWORD)
- `orders` / `order_items`: SALE xem đơn của mình; ADMIN xem tất cả; CUSTOMER không thấy

## Frontend

**Auth shell**
- `/login` — form email + password
- `/signup` — chỉ admin tạo được (form ẩn cho user thường), hoặc gỡ signup public và chỉ admin tạo qua trang `/admin/users`
- Hook `useAuth` cung cấp `user`, `role`, `signIn`, `signOut`

**Trang `/` (homepage hiện tại)**
- Public, ai cũng xem được
- Header: nếu chưa login → nút "Đăng nhập"; nếu đã login → hiển thị tên + role + "Đăng xuất"
- **Nếu role = SALE**: tự động nhân giá Consumer × 0.6 (thay vì hiển thị giá gốc); badge "Giá SALE -40%" trên header
- **Nếu role = ADMIN**: hiện nút Sửa/Xoá/Thêm trực tiếp trên bảng (bỏ cơ chế UnlockDialog + EDIT_PASSWORD cũ)
- **CUSTOMER / chưa login**: chỉ xem giá Consumer 100%

**Trang `/orders` (SALE + ADMIN)**
- Danh sách đơn hàng (SALE chỉ thấy đơn mình; ADMIN thấy tất cả)
- Nút "Tạo đơn mới" → `/orders/new`

**Trang `/orders/new` (SALE + ADMIN)**
- Form: thông tin khách (tên, SĐT, địa chỉ, ghi chú)
- Bảng chọn sản phẩm: search → thêm dòng → chọn size (retail/salon) → số lượng
- Tự tính: đơn giá (giá đã -40%), thành tiền, tổng cộng (có/không VAT)
- Nút "Lưu nháp" / "Xác nhận đơn"

**Trang `/orders/$id`**
- Chi tiết đơn, in/xuất

**Trang `/admin/users` (chỉ ADMIN)**
- Tạo tài khoản SALE mới
- Danh sách user + đổi role

## Migration cũ → mới

- Cơ chế EDIT_PASSWORD + UnlockDialog hiện tại sẽ được **gỡ bỏ**, thay bằng login ADMIN
- Edge functions `verify-edit-key` và `save-product-override` không còn cần password param — sẽ kiểm tra role ADMIN qua JWT
- Lịch sử undo (useEditHistory) giữ nguyên

## Kỹ thuật

- Auth: `supabase.auth.signInWithPassword` + `onAuthStateChange` listener
- Disable signup public trong Supabase auth config (chỉ admin mới tạo user qua admin API trong server function)
- Tạo seed admin đầu tiên: sau migration sẽ hỏi user email để gán role admin

## Câu hỏi xác nhận

1. **Tài khoản ADMIN đầu tiên**: Bạn cho tôi email để gán role admin sau khi tạo tài khoản đó (hoặc tôi tạo sẵn email/password cho bạn)?
2. **VAT trên đơn hàng SALE**: Đơn hàng có cần áp VAT 8% không, hay chỉ giá đã chiết khấu là đủ?
3. **In/xuất đơn**: Cần in PDF hay chỉ cần trang web in (Ctrl+P) là đủ?

Nếu plan ổn, tôi sẽ tạo migration database trước, sau đó dựng auth + UI.