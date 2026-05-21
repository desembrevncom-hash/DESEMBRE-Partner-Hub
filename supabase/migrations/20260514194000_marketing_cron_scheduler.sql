-- ============================================================================
-- MIGRATION: Tích hợp Lên lịch Tự động hóa Tiếp thị (Cron Scheduler Engine)
-- ============================================================================

-- Bật các tiện ích mở rộng PostgreSql hỗ trợ lập lịch và gọi mạng
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. TẠO HÀNG ĐỢI XỬ LÝ CHIẾN DỊCH TỰ ĐỘNG (SCHEDULER DISPATCH FUNCTION)
CREATE OR REPLACE FUNCTION public.check_and_trigger_scheduled_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_campaign RECORD;
    v_function_url text;
    v_auth_header text;
BEGIN
    -- Lấy URL của Edge Function và Service Role Key từ biến môi trường của Supabase (nếu khả dụng)
    -- Hoặc cấu hình ngầm một dải tham chiếu nội bộ
    v_function_url := current_setting('app.settings.edge_function_base_url', true) || '/process-marketing-campaign';
    v_auth_header := 'Bearer ' || current_setting('app.settings.service_role_key', true);

    -- Duyệt qua tất cả các chiến dịch đã đến giờ kích hoạt
    FOR v_campaign IN
        SELECT id, name
        FROM public.marketing_campaigns
        WHERE status = 'scheduled'
          AND scheduled_at <= now()
    LOOP
        -- 1.1 Khóa bản ghi và chuyển trạng thái sang processing để tránh kích hoạt lặp lại
        UPDATE public.marketing_campaigns
        SET status = 'processing',
            updated_at = now()
        WHERE id = v_campaign.id;

        -- 1.2 Nếu extension pg_net hoạt động, thực hiện gọi HTTP không đồng bộ tới Edge Function
        -- Ghi chú: Sử dụng phương thức an toàn, nếu cấu hình mạng chưa bật thì Edge Function có thể được kích hoạt thủ công từ UI
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
            BEGIN
                PERFORM net.http_post(
                    url := v_function_url,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', v_auth_header
                    ),
                    body := jsonb_build_object('campaign_id', v_campaign.id)
                );
            EXCEPTION WHEN OTHERS THEN
                -- Bỏ qua lỗi ngầm nếu giao thức HTTP bị nghẽn
            END;
        END IF;

        -- Ghi nhận log ngầm hệ thống
        RAISE NOTICE 'Đã kích hoạt tự động luồng Dispatcher cho chiến dịch: %', v_campaign.name;
    END LOOP;
END;
$$;

-- 2. ĐĂNG KÝ CÔNG VIỆC VÀO HỆ THỐNG CRONJOB (CHẠY MỖI PHÚT)
-- Ghi chú: Chạy dưới tài khoản siêu quản trị viên hệ thống để có quyền truy cập extension pg_cron
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Hủy lịch trình cũ nếu tồn tại để đăng ký lại nguyên vẹn
        PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process_scheduled_marketing_campaigns';
        
        -- Kích hoạt bộ quét tự động mỗi 1 phút
        PERFORM cron.schedule(
            'process_scheduled_marketing_campaigns',
            '* * * * *',
            'SELECT public.check_and_trigger_scheduled_campaigns()'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Bỏ qua nếu người dùng chạy trên phân quyền user thông thường không có quyền pg_cron
END $$;

-- Tối ưu hóa truy vấn tìm kiếm lịch trình
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduler_trigger 
ON public.marketing_campaigns(status, scheduled_at) 
WHERE status = 'scheduled';

NOTIFY pgrst, 'reload schema';
