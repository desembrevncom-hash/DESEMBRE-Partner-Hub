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
  pilot_mode_enabled = true,
  automation_enabled = false,
  due_generator_enabled = false,
  notification_enabled = true
WHERE true;

-- 1.5. Cập nhật bảng ai_settings
UPDATE public.ai_settings
SET
  ai_enabled = false,
  ai_customer_suggestions_enabled = false,
  ai_sales_assistant_enabled = true,
  ai_rag_enabled = true,
  ai_rewrite_enabled = false,
  product_copilot_enabled = true
WHERE true;

-- 2. Cập nhật trạng thái Rollout cho các Pilot Modules
UPDATE public.pilot_modules SET rollout_state = 'off' WHERE module_key = 'ai_customer_suggestions';
UPDATE public.pilot_modules SET rollout_state = 'on' WHERE module_key = 'communication_os';
UPDATE public.pilot_modules SET rollout_state = 'on' WHERE module_key = 'message_templates';
UPDATE public.pilot_modules SET rollout_state = 'on' WHERE module_key = 'interaction_tracking';
UPDATE public.pilot_modules SET rollout_state = 'admin_only' WHERE module_key = 'automation_rules';
UPDATE public.pilot_modules SET rollout_state = 'off' WHERE module_key = 'due_generator';

COMMIT;
