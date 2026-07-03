# Mô Hình Bảo Mật (Security Model)

Tài liệu này trình bày chiến lược phân quyền và kiểm soát dữ liệu.

## Chính sách RLS hiện tại
**Phân loại:** FACT
**Repository:** DESEMBRE-Partner-Hub
**File:** `supabase/migrations/20260516060000_audit_and_refine_rls.sql`
**Lines:** 1-103
**Nội dung:** RLS của Partner Hub quy định rất chặt, mọi entity đều kiểm tra `is_admin`, `is_tele_lead`, `has_role('sale')` và quyền ownership qua `user_id`.

## Ma Trận Quyền Đề Xuất (Permission Matrix)
**Phân loại:** RECOMMENDATION
**Repository:** DESEMBRE-Partner-Hub
**File:** N/A
**Lines:** N/A
**Nội dung:**

| Role | Academy Content (Courses/Lessons) | Enrollments (My progress) | Hub Customers Table | 
|------|-----------------------------------|---------------------------|---------------------|
| Anonymous | Chỉ xem danh sách Public | Không có quyền | Không có quyền |
| Student | Đọc | Đọc & Ghi (Của chính user) | Xem bản ghi cá nhân |
| Staff | Đọc | Đọc (Giám sát tiến độ học viên) | Xem dữ liệu khách được giao |
| Admin | Đọc & Ghi toàn bộ | Đọc & Ghi toàn bộ | Đọc & Ghi toàn bộ |
