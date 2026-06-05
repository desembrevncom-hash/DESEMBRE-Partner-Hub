-- Fix invalid input value for enum app_role: "telesale"
-- Bổ sung giá trị 'telesale' vào enum app_role để hàm is_sales_member không bị crash khi check

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'telesale';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
