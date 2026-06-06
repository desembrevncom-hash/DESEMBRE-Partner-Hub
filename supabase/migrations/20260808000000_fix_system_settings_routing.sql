-- Thêm các cột cấu hình phân tuyến theo khoảng cách vào bảng system_settings
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS routing_near_km integer not null default 10,
ADD COLUMN IF NOT EXISTS routing_city_km integer not null default 30,
ADD COLUMN IF NOT EXISTS routing_far_km integer not null default 80;
