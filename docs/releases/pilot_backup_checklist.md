# Pilot Backup Checklist

Yêu cầu quản trị viên (Admin/DBA) thực hiện thao tác Export từ bảng điều khiển Supabase hoặc sử dụng script SQL backup các bảng (table) sau đây thành định dạng `.csv` hoặc `.sql` trước khi bắt đầu đợt Pilot chính thức.

- [ ] `customers` (Thông tin khách hàng)
- [ ] `customer_activities` (Lịch sử chăm sóc)
- [ ] `customer_interactions` (Tương tác khách hàng)
- [ ] `tasks` / `customer_tasks` (Công việc)
- [ ] `orders` và `order_items` (Đơn hàng và chi tiết)
- [ ] `message_templates` (Các mẫu tin nhắn cấu hình sẵn)
- [ ] `ai_settings` (Cấu hình bộ máy AI)
- [ ] `system_settings` (Cấu hình hệ thống chung)

**Lưu ý**: Hãy đảm bảo kiểm tra lại file export xem dữ liệu có bị mã hoá hay rỗng trước khi xác nhận đã backup xong. Lưu các file này vào một thư mục an toàn (VD: AWS S3 Backup hoặc local secured disk).
