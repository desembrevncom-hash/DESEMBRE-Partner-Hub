-- ============================================================================
-- MIGRATION: Tạo bảng quản lý liên hệ, nhắc nhở sinh nhật & RLS Policies (Phase v1.3.0E.1)
-- ============================================================================

-- 1. Bổ sung cột birthday_reminder_worker_enabled vào system_settings để làm kill switch
ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS birthday_reminder_worker_enabled boolean NOT NULL DEFAULT false;

-- 2. Tạo bảng quản lý người liên hệ tại Spa (public.customer_contacts)
CREATE TABLE IF NOT EXISTS public.customer_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    role_title text, -- e.g., 'Spa Owner', 'Manager', 'Purchasing Agent'
    phone text,
    zalo_phone text,
    birthday_month integer,
    birthday_day integer,
    birthday_year integer, -- Optional
    birthday_reminder_enabled boolean NOT NULL DEFAULT true, -- Quyền tạo nhắc nhở/nhiệm vụ nội bộ
    birthday_offer_opt_in boolean NOT NULL DEFAULT false, -- Đồng ý nhận ưu đãi tiếp thị Zalo/ZNS sau này
    preferred_channel text NOT NULL DEFAULT 'none', -- 'none' | 'zalo' | 'phone' | 'email' | 'other'
    is_primary boolean NOT NULL DEFAULT false,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Ràng buộc tháng/ngày
    CONSTRAINT check_birthday_month CHECK (birthday_month BETWEEN 1 AND 12),
    CONSTRAINT check_birthday_day CHECK (birthday_day BETWEEN 1 AND 31),
    CONSTRAINT check_preferred_channel CHECK (preferred_channel IN ('none', 'zalo', 'phone', 'email', 'other')),
    
    -- Ngày và tháng phải cùng null hoặc cùng có giá trị
    CONSTRAINT check_birthday_both_or_none CHECK (
        (birthday_month IS NULL AND birthday_day IS NULL) OR
        (birthday_month IS NOT NULL AND birthday_day IS NOT NULL)
    ),

    -- Kiểm soát số lượng ngày tối đa trong từng tháng
    CONSTRAINT check_birthday_day_limit CHECK (
        birthday_month IS NULL OR (
            (birthday_month IN (4, 6, 9, 11) AND birthday_day <= 30) OR
            (birthday_month = 2 AND birthday_day <= 29) OR
            (birthday_month IN (1, 3, 5, 7, 8, 10, 12) AND birthday_day <= 31)
        )
    )
);

-- Tạo các chỉ mục tối ưu hóa
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON public.customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_birthday ON public.customer_contacts(birthday_month, birthday_day);

-- Ràng buộc mỗi khách hàng chỉ có tối đa một liên hệ chính (is_primary = true)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contacts_primary 
ON public.customer_contacts(customer_id) 
WHERE (is_primary = true);


-- 3. Tạo bảng quản lý lịch sử nhắc nhở sinh nhật hàng năm (public.customer_birthday_reminders)
CREATE TABLE IF NOT EXISTS public.customer_birthday_reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.customer_contacts(id) ON DELETE CASCADE,
    reminder_year integer NOT NULL, -- Ví dụ: 2026
    birthday_date_this_year date NOT NULL,
    remind_at date NOT NULL, -- Ngày kích hoạt nhắc nhở (trước 7 ngày)
    status text NOT NULL DEFAULT 'pending', -- 'pending' | 'task_created' | 'cancelled' | 'dismissed'
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Nhân viên được phân bổ làm nhiệm vụ
    created_task_id uuid REFERENCES public.customer_tasks(id) ON DELETE SET NULL,
    zns_delivery_log_id uuid, -- Dành cho các đợt phát ZNS tương lai (nullable)
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Tránh nhắc trùng lặp trong cùng một năm cho cùng một liên hệ
    CONSTRAINT unique_contact_reminder_year UNIQUE (contact_id, reminder_year),
    CONSTRAINT check_reminder_status CHECK (status IN ('pending', 'task_created', 'cancelled', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_birthday_reminders_contact_year ON public.customer_birthday_reminders(contact_id, reminder_year);
CREATE INDEX IF NOT EXISTS idx_birthday_reminders_remind_at ON public.customer_birthday_reminders(remind_at);


-- 4. Cấu hình bảo mật hàng (RLS Policies) riêng biệt theo yêu cầu
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_birthday_reminders ENABLE ROW LEVEL SECURITY;

-- 4.a. Các chính sách cho bảng customer_contacts
DROP POLICY IF EXISTS "Contacts select policy" ON public.customer_contacts;
CREATE POLICY "Contacts select policy" ON public.customer_contacts
    FOR SELECT TO authenticated
    USING (
        public.is_admin_or_sub_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id
            AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Contacts insert policy" ON public.customer_contacts;
CREATE POLICY "Contacts insert policy" ON public.customer_contacts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin_or_sub_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id
            AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Contacts update policy" ON public.customer_contacts;
CREATE POLICY "Contacts update policy" ON public.customer_contacts
    FOR UPDATE TO authenticated
    USING (
        public.is_admin_or_sub_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id
            AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
        )
    )
    WITH CHECK (
        public.is_admin_or_sub_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id
            AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Contacts delete policy" ON public.customer_contacts;
CREATE POLICY "Contacts delete policy" ON public.customer_contacts
    FOR DELETE TO authenticated
    USING (
        public.is_admin_or_sub_admin(auth.uid())
    );

-- 4.b. Các chính sách cho bảng customer_birthday_reminders
DROP POLICY IF EXISTS "Reminders select policy" ON public.customer_birthday_reminders;
CREATE POLICY "Reminders select policy" ON public.customer_birthday_reminders
    FOR SELECT TO authenticated
    USING (
        public.is_admin_or_sub_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_id
            AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Reminders modify policy" ON public.customer_birthday_reminders;
CREATE POLICY "Reminders modify policy" ON public.customer_birthday_reminders
    TO authenticated
    USING (
        public.is_admin_or_sub_admin(auth.uid())
    );


-- 5. Thiết lập tiến trình quét kiểm thử nhắc nhở sinh nhật hàng ngày (RPC generate_birthday_reminders)
CREATE OR REPLACE FUNCTION public.generate_birthday_reminders(
    p_dry_run boolean DEFAULT true,
    p_confirm_phrase text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_worker_enabled boolean;
    v_today date;
    v_count_reminders integer := 0;
    v_count_tasks integer := 0;
    v_log jsonb := '[]'::jsonb;
    r_contact RECORD;
    v_birthday_this_year date;
    v_remind_at date;
    v_reminder_year integer;
    v_assigned_to uuid;
    v_task_id uuid;
    v_is_leap boolean;
BEGIN
    -- Đọc trạng thái Worker Kill Switch
    SELECT COALESCE(birthday_reminder_worker_enabled, false) INTO v_worker_enabled
    FROM public.system_settings
    LIMIT 1;

    -- Nếu worker tắt và không phải dry-run thì không cho ghi DB
    IF NOT v_worker_enabled AND NOT p_dry_run THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Birthday reminder worker is disabled in system_settings.'
        );
    END IF;

    -- Xác minh confirm phrase nếu muốn ghi DB thực sự
    IF NOT p_dry_run AND p_confirm_phrase <> 'PROCESS_BIRTHDAY_REMINDERS' THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Invalid confirmation phrase for actual metadata database writes.'
        );
    END IF;

    -- Thiết lập ngày theo timezone Việt Nam
    v_today := (timezone('Asia/Ho_Chi_Minh', now()))::date;
    v_reminder_year := extract(year from v_today)::integer;
    v_is_leap := (MOD(v_reminder_year, 4) = 0 AND (MOD(v_reminder_year, 100) <> 0 OR MOD(v_reminder_year, 400) = 0));

    FOR r_contact IN 
        SELECT 
            cc.id as contact_id,
            cc.customer_id,
            cc.full_name,
            cc.birthday_day,
            cc.birthday_month,
            c.owner_sale_id,
            c.owner_tele_id
        FROM public.customer_contacts cc
        JOIN public.customers c ON c.id = cc.customer_id
        WHERE cc.birthday_reminder_enabled = true
          AND cc.birthday_month IS NOT NULL
          AND cc.birthday_day IS NOT NULL
    LOOP
        -- Tính toán ngày sinh nhật năm nay
        IF r_contact.birthday_month = 2 AND r_contact.birthday_day = 29 AND NOT v_is_leap THEN
            -- Người sinh 29/02 vào năm không nhuận tính là 28/02
            v_birthday_this_year := to_date(v_reminder_year::text || '-02-28', 'YYYY-MM-DD');
        ELSE
            BEGIN
                v_birthday_this_year := to_date(v_reminder_year::text || '-' || r_contact.birthday_month::text || '-' || r_contact.birthday_day::text, 'YYYY-MM-DD');
            EXCEPTION WHEN OTHERS THEN
                CONTINUE; -- Tránh lỗi định dạng ngày
            END;
        END IF;

        -- remind_at trước 7 ngày
        v_remind_at := v_birthday_this_year - 7;

        IF v_remind_at = v_today THEN
            -- Đảm bảo Idempotency (không nhắc trùng năm nay)
            PERFORM 1 FROM public.customer_birthday_reminders
            WHERE contact_id = r_contact.contact_id
              AND reminder_year = v_reminder_year;
            IF NOT FOUND THEN
                v_count_reminders := v_count_reminders + 1;
                v_assigned_to := COALESCE(r_contact.owner_sale_id, r_contact.owner_tele_id);

                IF p_dry_run THEN
                    v_log := v_log || jsonb_build_object(
                        'contact_name', r_contact.full_name,
                        'customer_id', r_contact.customer_id,
                        'birthday', r_contact.birthday_day::text || '/' || r_contact.birthday_month::text,
                        'remind_at', v_remind_at::text,
                        'assigned_to', v_assigned_to,
                        'action', 'dry_run_skipped'
                    );
                ELSE
                    -- 1. Chèn nhiệm vụ nội bộ
                    INSERT INTO public.customer_tasks (
                        customer_id,
                        assigned_to,
                        task_type,
                        title,
                        note,
                        priority,
                        status,
                        due_at
                    )
                    VALUES (
                        r_contact.customer_id,
                        v_assigned_to,
                        'follow_up',
                        'Chúc mừng sinh nhật: ' || r_contact.full_name,
                        'Nhắc nhở tự động hệ thống: Sinh nhật của liên hệ ' || r_contact.full_name || ' sắp diễn ra vào ngày ' || to_char(v_birthday_this_year, 'dd/MM/yyyy') || '.',
                        'high',
                        'pending',
                        (v_birthday_this_year::text || ' 09:00:00+07')::timestamptz
                    )
                    RETURNING id INTO v_task_id;

                    v_count_tasks := v_count_tasks + 1;

                    -- 2. Lưu log nhắc nhở
                    INSERT INTO public.customer_birthday_reminders (
                        customer_id,
                        contact_id,
                        reminder_year,
                        birthday_date_this_year,
                        remind_at,
                        status,
                        assigned_to,
                        created_task_id
                    )
                    VALUES (
                        r_contact.customer_id,
                        r_contact.contact_id,
                        v_reminder_year,
                        v_birthday_this_year,
                        v_remind_at,
                        'task_created',
                        v_assigned_to,
                        v_task_id
                    );

                    -- 3. Tạo hoạt động khách hàng chăm sóc
                    INSERT INTO public.customer_activities (
                        customer_id,
                        activity_type,
                        title,
                        content
                    )
                    VALUES (
                        r_contact.customer_id,
                        'note',
                        'Hệ thống lên lịch nhắc sinh nhật',
                        'Tự động lập lịch nhắc sinh nhật cho liên hệ: ' || r_contact.full_name || '\nNgày sinh nhật: ' || to_char(v_birthday_this_year, 'dd/MM') || '\nĐã tạo nhiệm vụ nhắc nhở cho Sales.'
                    );

                    v_log := v_log || jsonb_build_object(
                        'contact_name', r_contact.full_name,
                        'task_id', v_task_id,
                        'assigned_to', v_assigned_to,
                        'action', 'task_created_successfully'
                    );
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'dry_run', p_dry_run,
        'processed_reminders_count', v_count_reminders,
        'created_tasks_count', v_count_tasks,
        'log', v_log
    );
END;
$$;

-- Tải lại cấu trúc schema cho PostgREST
NOTIFY pgrst, 'reload schema';
