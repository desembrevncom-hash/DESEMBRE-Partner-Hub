# Kế Hoạch Triển Khai (Academy Implementation Plan)

Tài liệu này trình bày lộ trình tích hợp Academy vào hệ sinh thái hiện tại.

## Giai đoạn 1: Khởi tạo Database (PR 1)
**Phân loại:** RECOMMENDATION
**Repository:** DESEMBRE-Partner-Hub
**File:** N/A (Sẽ tạo ở `supabase/migrations/`)
**Lines:** N/A
**Nội dung:** Khởi tạo các bảng `courses`, `lessons`, `enrollments` tại Hub schema.

## Giai đoạn 2: Cấu hình Supabase Client (PR 2)
**Phân loại:** RECOMMENDATION
**Repository:** Desembre Academy
**File:** N/A (Sẽ tạo ở `src/integrations/supabase/`)
**Lines:** N/A
**Nội dung:** Tích hợp logic khởi tạo Client và Auth (tương tự Hub) vào Academy.

## Giai đoạn 3: Chuyển đổi dữ liệu (PR 3)
**Phân loại:** RECOMMENDATION
**Repository:** Desembre Academy
**File:** `src/data/courses.ts`
**Lines:** 1-169
**Nội dung:** Thay thế mock data bằng gọi API Supabase, áp dụng cho tất cả mock data trong hệ thống.

## Giai đoạn 4: Đồng bộ RLS & Security (PR 4)
**Phân loại:** RECOMMENDATION
**Repository:** DESEMBRE-Partner-Hub
**File:** N/A (Sẽ tạo script update RLS)
**Lines:** N/A
**Nội dung:** Kiểm thử và áp dụng chặt chẽ các rule bảo vệ dữ liệu chéo giữa Sale và Học viên (Academy).
