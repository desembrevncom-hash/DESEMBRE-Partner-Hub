
-- ============================================================================
-- MIGRATION: Synchronize Customer Lifecycle Stages (Đồng bộ hoá dữ liệu cũ)
-- Mục tiêu: Chuyển đổi các nhãn cũ sang nhãn mới chuẩn Phase 4 để hiển thị trên Kanban
-- ============================================================================

-- 0. Đảm bảo cột lifecycle_stage tồn tại trước khi cập nhật
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS lifecycle_stage text;

-- 1. Cập nhật Lead
UPDATE public.customers SET lifecycle_stage = 'new_lead' WHERE lifecycle_stage = 'lead';

-- 2. Cập nhật Đang tư vấn
UPDATE public.customers SET lifecycle_stage = 'consulting' WHERE lifecycle_stage = 'prospect';

-- 3. Cập nhật Khách đã mua / Chốt đơn
UPDATE public.customers SET lifecycle_stage = 'ordered' WHERE lifecycle_stage = 'customer' OR lifecycle_stage = 'ordered';

-- 4. Cập nhật Khách hoạt động
UPDATE public.customers SET lifecycle_stage = 'active_customer' WHERE lifecycle_stage = 'active';

-- 5. Cập nhật Khách thân thiết
UPDATE public.customers SET lifecycle_stage = 'loyal_customer' WHERE lifecycle_stage = 'loyal';

-- 6. Cập nhật Ngưng hoạt động
UPDATE public.customers SET lifecycle_stage = 'inactive' WHERE lifecycle_stage = 'churned';

-- Làm mới cache
NOTIFY pgrst, 'reload schema';
