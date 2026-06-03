# Hướng dẫn Vận hành Tính năng Đồng bộ Google Sheet Mirror (CRM)

## Mục đích

Tính năng "Google Sheet Mirror" giúp Ban Giám đốc và đội ngũ quản lý có một cái nhìn tổng quát, trực quan và dễ thao tác trên định dạng Excel/Google Sheet quen thuộc. Dữ liệu này được tự động phân loại, kiểm tra trùng lặp và tính toán các chỉ số sức khỏe của tệp khách hàng.

> [!WARNING]
> **Nguyên tắc cốt lõi:** Google Sheet chỉ đóng vai trò là một màn hình hiển thị (Read-only Mirror). Supabase/PostgreSQL vẫn là kho lưu trữ dữ liệu gốc duy nhất.
>
> Hệ thống được thiết kế theo dạng **đồng bộ 1 chiều (từ CRM đẩy lên Google Sheet)**. Tuyệt đối không được chỉnh sửa thông tin Khách hàng trực tiếp trên Google Sheet với hy vọng nó sẽ "đổ ngược" về CRM. Nếu có dữ liệu sai, cần vào phần mềm CRM sửa lại, sau đó bấm `Sync Now`.

---

## Danh sách 6 Tabs (Trang tính)

Để hệ thống hoạt động bình thường, file Google Sheet của bạn phải có đủ 6 tab sau đây (hệ thống có khả năng tự động tạo tab nếu bạn cấp quyền đúng):

1. **`Customers_Master`**: Chứa toàn bộ dữ liệu khách hàng (giới hạn 10.000 records).
2. **`Data_Quality`**: Thống kê về mức độ đầy đủ của dữ liệu (số lượng KH thiếu SĐT/Email, chưa được gán nhân sự...).
3. **`Import_Logs`**: Lịch sử các lần Import dữ liệu vào hệ thống (từ nguồn Excel).
4. **`Unassigned_Customers`**: Danh sách khách hàng vô chủ (chưa được phân bổ cho Sale hoặc Tele).
5. **`Duplicate_Check`**: Danh sách khách hàng bị trùng lặp số điện thoại hoặc email.
6. **`Daily_Summary`**: Bảng tổng kết các chỉ số quan trọng theo thời gian thực (số KH mới trong ngày, tuần...).

---

## Hướng dẫn Cài đặt Môi trường (Supabase Secrets)

Hệ thống Backend (Edge Function) cần được cấp các biến môi trường để liên lạc với Google. Cần đặt 4 biến sau vào **Supabase > Settings > Edge Functions > Secrets**:

- `SUPABASE_SERVICE_ROLE_KEY`: Key admin của hệ thống Supabase (Lấy ở mục API Settings).
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Email của tài khoản Service (Thường có dạng `...gserviceaccount.com`).
- `GOOGLE_PRIVATE_KEY`: Mã khóa Private Key của tài khoản Service Account (bắt đầu bằng `-----BEGIN PRIVATE KEY-----`). Chú ý: Nếu key nằm trên 1 dòng duy nhất, các ký tự xuống dòng `\n` phải được để nguyên để code tự replace, hoặc bạn phải ngắt dòng tử tế.
- `GOOGLE_SPREADSHEET_ID`: Chuỗi ký tự ID của file Google Sheet (nằm giữa `/d/` và `/edit` trên thanh URL trình duyệt).

### 🔑 Chú ý Phân quyền trên Google Sheet

Mặc dù bạn đã có đủ Secrets, nhưng file Google Sheet của bạn vẫn hoàn toàn thuộc về tài khoản Gmail cá nhân của bạn.
Để hệ thống đẩy được dữ liệu vào, bạn phải bấm **Share (Chia sẻ)** file Google Sheet đó, điền cái địa chỉ `GOOGLE_SERVICE_ACCOUNT_EMAIL` vào ô chia sẻ, và cấp cho nó quyền **Editor (Người chỉnh sửa)**.

---

## Hướng dẫn Sử dụng (Sync Now)

1. Đăng nhập vào CRM với tài khoản có quyền `admin` hoặc `sub_admin`.
2. Chuyển tới phân hệ **Operations (Vận hành)** -> Cuộn xuống thẻ **CRM Mirror Sheet**.
3. Bấm **Sync Now**.
4. Nút bấm sẽ vô hiệu hóa và hiện `Đang đồng bộ...`. Quá trình mất từ 2-5 giây.
5. Xem thông báo thành công, các thẻ đếm số lượng bản ghi (Row Counts) sẽ cập nhật. Bạn có thể bấm "Mở Trang tính" để xem ngay.

### 🚫 Lỗi thường gặp & Khắc phục

- **Missing Google Sheets configuration:** Bạn cấu hình thiếu 1 trong các biến môi trường bên trên. (Backend sẽ báo chi tiết biến nào thiếu).
- **Failed to authenticate with Google API:** `GOOGLE_PRIVATE_KEY` bị nhập sai định dạng hoặc bị hỏng/dư khoảng trắng.
- **Permission denied (403):** Bạn quên Share file Google Sheet cho địa chỉ `GOOGLE_SERVICE_ACCOUNT_EMAIL` với quyền Editor.
- **Đang có phiên đồng bộ khác đang chạy:** Một quản trị viên khác vừa bấm nút Sync trong vòng chưa tới 5 phút. Hãy đợi phiên kia xử lý xong.
- **Forbidden: Admins only:** Nếu bạn dùng tài khoản Sale/Tele để bấm đồng bộ, hệ thống sẽ chặn cứng lại. (Bảo mật tuyệt đối).

> [!CAUTION]
> Tuyệt đối **không** được thêm cứng (commit) các thông số `GOOGLE_PRIVATE_KEY` hay bất cứ Secret nào vào Source Code của Frontend hay Backend. Việc rò rỉ Service Account có thể làm lộ dữ liệu của doanh nghiệp. Mọi thao tác cấu hình phải làm trực tiếp trên Bảng điều khiển (Dashboard) của Supabase.
