-- ============================================================================
-- MIGRATION: Bổ sung liên kết (Foreign Key) giữa bảng Orders và Customers
-- ============================================================================

-- Thêm cột customer_id vào bảng orders để tạo mối quan hệ
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Làm mới bộ đệm dữ liệu (Cache) cho PostgREST
NOTIFY pgrst, 'reload schema';
