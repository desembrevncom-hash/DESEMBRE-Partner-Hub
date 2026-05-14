-- 1. Bổ sung giá trị 'tele_lead' vào kiểu dữ liệu liệt kê public.app_role một cách an toàn
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tele_lead';

-- 2. Kích hoạt thông báo nạp lại lược đồ cho bộ đệm PostgREST API
NOTIFY pgrst, 'reload schema';
