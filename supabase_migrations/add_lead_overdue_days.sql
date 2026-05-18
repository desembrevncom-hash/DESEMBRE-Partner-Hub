-- Chạy lệnh SQL này trong giao diện Supabase (phần SQL Editor) để thêm cột cấu hình CRM
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS lead_overdue_days integer DEFAULT 3;
