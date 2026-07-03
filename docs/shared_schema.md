# Thiết Kế Shared Schema & Kiến Trúc Bảo Mật (Hub & Academy)

## 1. Hiện Trạng Cấu Trúc Dữ Liệu
- **Khách hàng (`customers`)**: Bảng `public.customers` đang quản lý dữ liệu khách hàng. Cột `phone` không có ràng buộc unique (`UNIQUE constraint`). 
- **Roles & Permissions**: Sử dụng `public.user_roles` để quản lý phân quyền (Admin, Sale, Tele Lead). Quyền Admin được xác định qua hàm trợ giúp `public.has_role(auth.uid(), 'admin')`.
- **Bảo mật RLS (Row Level Security)**: Hệ thống đang áp dụng RLS cực kỳ nghiêm ngặt trên các bảng trọng yếu (`orders`, `calendar_events`, `company_events`). Quyền truy cập được cấp chéo dựa trên ownership và role.
- **Source of Truth**: 199 file migration SQL trong thư mục `supabase/migrations/` là nguồn tham chiếu duy nhất cho cấu trúc schema.

## 2. Phân Tích Rủi Ro Dữ Liệu
- **Liên kết bằng số điện thoại**: Việc bảng `customers` không có unique constraint cho `phone` có nguy cơ tạo ra các bản ghi khách hàng trùng lặp. Khi Academy sử dụng `phone` để định danh học viên/khách hàng, hệ thống có thể gặp khó khăn trong việc gộp (merge) lịch sử học tập và lịch sử mua hàng, dẫn đến phân mảnh dữ liệu.

## 3. Đề Xuất Database Schema Cho Academy
- Cần mở rộng schema hiện tại để hỗ trợ mảng đào tạo (Academy) mà không phá vỡ cấu trúc RLS của Partner Hub.
- **Các bảng mới đề xuất**:
  - `courses` (Khóa học)
  - `modules` (Chương học)
  - `lessons` (Bài học)
  - `enrollments` (Quản lý đăng ký khóa học của user)
  - `student_progress` (Tiến độ học tập)
- **Kiến trúc liên kết**: Tận dụng bảng `auth.users` chung cho toàn hệ thống để triển khai cơ chế Single Sign-On (SSO). Học viên bên Academy sẽ liên kết với bảng `customers` bên Hub thông qua `user_id` thay vì dựa hoàn toàn vào `phone`.

## 4. Đồng Bộ RLS
- Các chính sách RLS mới cho Academy cần cho phép:
  - Học viên (Student): Chỉ đọc các nội dung public hoặc các khóa học đã mua (thông qua `enrollments`).
  - Admin/Sub Admin: Toàn quyền quản lý nội dung Academy.
  - Cần cẩn trọng khi thiết lập quyền truy cập chéo giữa Sale (Hub) và Học viên (Academy) để Sale có thể tư vấn các khóa học phù hợp mà không vi phạm tính riêng tư dữ liệu.
