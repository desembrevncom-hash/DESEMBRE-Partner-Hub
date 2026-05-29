-- ============================================================
-- Phase ZNS-3: Add zns_template_id to delivery logs
-- ============================================================

-- Bổ sung cột zns_template_id vào bảng marketing_delivery_logs
ALTER TABLE public.marketing_delivery_logs
  ADD COLUMN IF NOT EXISTS zns_template_id uuid REFERENCES public.zns_templates(id) ON DELETE SET NULL;

-- Cập nhật index để truy vấn nhanh theo template
CREATE INDEX IF NOT EXISTS idx_mdl_zns_template
  ON public.marketing_delivery_logs (zns_template_id)
  WHERE zns_template_id IS NOT NULL;
