-- ==============================================================
-- PILOT SAFE CONFIGURATION SCRIPT
-- ==============================================================
-- Mục đích: Đưa toàn bộ cấu hình hệ thống (system_settings) và 
-- các module pilot về trạng thái an toàn trước khi khởi chạy Pilot.
-- 
-- Note: Chỉ chứa lệnh UPDATE / UPSERT. 
-- KHÔNG DROP, KHÔNG DELETE, KHÔNG ALTER.
-- ==============================================================

BEGIN;

-- 1. Cập nhật bảng system_settings
UPDATE public.system_settings
SET
  -- AI Governance
  ai_enabled = false,
  ai_customer_suggestions_enabled = false,
  ai_sales_assistant_enabled = true,
  ai_rag_enabled = true,
  ai_rewrite_enabled = false,
  product_copilot_enabled = true,

  -- Automation Governance
  pilot_mode_enabled = true,
  automation_enabled = false,
  due_generator_enabled = false,
  notification_enabled = true
-- Cập nhật tất cả các dòng (thường bảng này chỉ có 1 row cấu hình chung)
WHERE true;


-- 2. Cập nhật trạng thái Rollout cho các Pilot Modules
-- Giả sử bảng pilot_modules có cấu trúc (module_name, rollout_state)
-- Nếu bảng không tồn tại hoặc cấu trúc khác, phần này có thể sẽ throw error,
-- nhưng đây là best-effort UPSERT dựa trên yêu cầu Pilot Modules.

INSERT INTO public.pilot_modules (module_name, rollout_state)
VALUES 
  ('ai_customer_suggestions', 'off'),
  ('communication_os', 'on'),
  ('message_templates', 'on'),
  ('interaction_tracking', 'on'),
  ('automation_rules', 'admin_only'),
  ('due_generator', 'off')
ON CONFLICT (module_name) 
DO UPDATE SET rollout_state = EXCLUDED.rollout_state;

COMMIT;
