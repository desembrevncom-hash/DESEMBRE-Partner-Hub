-- Thêm cột lưu trữ đường dẫn thêm vào Google Calendar và email của khách mời
ALTER TABLE public.event_registrations
ADD COLUMN IF NOT EXISTS add_to_calendar_url text,
ADD COLUMN IF NOT EXISTS attendee_email text;

-- Kích hoạt làm mới bộ đệm cấu trúc CSDL cho PostgREST API
NOTIFY pgrst, 'reload schema';
