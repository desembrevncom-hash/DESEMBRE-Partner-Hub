-- Bổ sung các cột theo dõi vết hành động gửi/sao chép link Lịch cho khách mời
ALTER TABLE public.event_registrations
ADD COLUMN IF NOT EXISTS calendar_link_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS calendar_link_sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
