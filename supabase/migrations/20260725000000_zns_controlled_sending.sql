-- ============================================================
-- Phase ZNS-5: Controlled Campaign Sending Migration
-- ============================================================

-- 1. Cập nhật các trạng thái của chiến dịch tiếp thị
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS check_campaign_status;

ALTER TABLE public.marketing_campaigns ADD CONSTRAINT check_campaign_status CHECK (
  status IN (
    'draft',
    'pending_review',
    'approved',
    'queued',
    'sending',
    'paused',
    'completed',
    'partially_failed',
    'cancelled',
    'failed'
  )
);

-- Bổ sung các trường kiểm soát phê duyệt và đo lường tiến độ
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS approved_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at           timestamptz,
  ADD COLUMN IF NOT EXISTS started_at            timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at             timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at          timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason        text,
  ADD COLUMN IF NOT EXISTS estimated_recipients  int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_recipients  int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS successful_recipients int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_recipients     int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zns_template_id       uuid REFERENCES public.zns_templates(id) ON DELETE RESTRICT;

-- 2. Tạo bảng campaign_recipient_snapshots (đóng băng danh sách gửi tại thời điểm duyệt/gửi)
CREATE TABLE IF NOT EXISTS public.campaign_recipient_snapshots (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid        NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  customer_id         uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sender_account_id   uuid        NOT NULL REFERENCES public.sender_accounts(id) ON DELETE CASCADE,
  zns_template_id     uuid        NOT NULL REFERENCES public.zns_templates(id) ON DELETE CASCADE,
  payload_preview     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status              text        NOT NULL DEFAULT 'queued',
  delivery_log_id     uuid        REFERENCES public.marketing_delivery_logs(id) ON DELETE SET NULL,
  failure_reason      text,
  processed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT check_crs_status CHECK (
    status IN ('queued', 'sent', 'failed', 'blocked')
  )
);

-- Bật RLS cho bảng snapshots
ALTER TABLE public.campaign_recipient_snapshots ENABLE ROW LEVEL SECURITY;

-- Quyền cho Admin/SubAdmin
CREATE POLICY "Admin/SubAdmin can manage snapshots"
ON public.campaign_recipient_snapshots
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'sub_admin')
  )
);

-- Quyền đọc cho Sales
CREATE POLICY "Sales can read snapshots"
ON public.campaign_recipient_snapshots
FOR SELECT TO authenticated
USING (true);

-- Index tối ưu hóa truy vấn
CREATE INDEX IF NOT EXISTS idx_crs_campaign
  ON public.campaign_recipient_snapshots (campaign_id);

CREATE INDEX IF NOT EXISTS idx_crs_status
  ON public.campaign_recipient_snapshots (campaign_id, status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_campaign_recipient_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_snapshots_timestamp
  BEFORE UPDATE ON public.campaign_recipient_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_recipient_snapshots_updated_at();

-- 3. Tạo hàm increment_campaign_metrics để cập nhật chỉ số chiến dịch atomically
CREATE OR REPLACE FUNCTION public.increment_campaign_metrics(
  p_campaign_id         uuid,
  p_processed           int,
  p_successful          int,
  p_failed              int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.marketing_campaigns
  SET
    processed_recipients  = COALESCE(processed_recipients, 0) + p_processed,
    successful_recipients = COALESCE(successful_recipients, 0) + p_successful,
    failed_recipients     = COALESCE(failed_recipients, 0) + p_failed,
    updated_at            = now()
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_campaign_metrics TO authenticated;

-- Làm mới schema
NOTIFY pgrst, 'reload schema';
