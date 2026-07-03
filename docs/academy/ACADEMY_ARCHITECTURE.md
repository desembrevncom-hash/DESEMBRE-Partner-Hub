# Kiến Trúc Tổng Thể (Academy Architecture)

Tài liệu này mô tả sơ đồ kiến trúc tích hợp hệ thống Academy.

## Hiện trạng Client Hub
**Phân loại:** FACT
**Repository:** DESEMBRE-Partner-Hub
**File:** `src/integrations/supabase/client.ts`
**Lines:** 5-55
**Nội dung:** Hub hiện có module Supabase client được cấu hình tốt với fallback mock. Kiến trúc này cần được sao chép và đồng bộ sang frontend của Academy để đảm bảo tính nhất quán.

## Cấu trúc Route Academy
**Phân loại:** FACT
**Repository:** Desembre Academy
**File:** `src/routeTree.gen.ts`
**Lines:** 1-160
**Nội dung:** Hệ thống Academy frontend độc lập dựa trên `@tanstack/react-router`. Việc tương tác với Database sẽ được gọi trực tiếp qua SDK từ client tới Supabase, tận dụng Auth token.
