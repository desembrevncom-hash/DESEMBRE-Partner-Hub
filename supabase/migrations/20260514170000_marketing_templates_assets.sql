-- ============================================================================
-- MIGRATION: Nâng cấp Marketing Templates Hỗ trợ Banner, CTA & Tài liệu Đính kèm
-- ============================================================================

-- 1. CẬP NHẬT BẢNG MESSAGE_TEMPLATES
ALTER TABLE public.message_templates
    ADD COLUMN IF NOT EXISTS banner_image_url text,
    ADD COLUMN IF NOT EXISTS cta_label text,
    ADD COLUMN IF NOT EXISTS cta_url text,
    ADD COLUMN IF NOT EXISTS footer_template text,
    ADD COLUMN IF NOT EXISTS attachment_urls jsonb DEFAULT '[]'::jsonb;

-- Đảm bảo các cột tuân thủ tiếp thị cơ bản tồn tại để tránh lỗi thiếu trường
ALTER TABLE public.message_templates
    ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'transactional',
    ADD COLUMN IF NOT EXISTS requires_opt_in boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS include_unsubscribe boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS max_send_frequency_days integer;

-- 2. TẠO BẢNG TEMPLATE_ASSETS
CREATE TABLE IF NOT EXISTS public.template_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES public.message_templates(id) ON DELETE CASCADE,
    asset_type text NOT NULL DEFAULT 'attachment',
    file_name text NOT NULL,
    file_url text NOT NULL,
    mime_type text,
    file_size integer,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT check_template_assets_type CHECK (
        asset_type IN ('banner', 'attachment', 'inline_image')
    )
);

-- Bật tính năng Hàng rào bảo mật (Row Level Security) cho template_assets
ALTER TABLE public.template_assets ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách cho Admin / Sub-Admin quản lý toàn quyền
CREATE POLICY "Admins manage template assets" ON public.template_assets
    FOR ALL TO authenticated
    USING (public.is_admin_or_sub_admin(auth.uid()))
    WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Tạo chính sách cho Sales / Người dùng nội bộ được phép đọc
CREATE POLICY "Authenticated users view template assets" ON public.template_assets
    FOR SELECT TO authenticated
    USING (true);

-- 3. KHỞI TẠO BUCKET LƯU TRỮ (STORAGE BUCKET) NẾU CHƯA CÓ
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Thiết lập RLS cho bucket marketing-assets
CREATE POLICY "Public Access to marketing-assets" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'marketing-assets');

CREATE POLICY "Admin upload to marketing-assets" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'marketing-assets' AND 
        public.is_admin_or_sub_admin(auth.uid())
    );

CREATE POLICY "Admin update/delete in marketing-assets" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'marketing-assets' AND 
        public.is_admin_or_sub_admin(auth.uid())
    );

CREATE POLICY "Admin delete in marketing-assets" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'marketing-assets' AND 
        public.is_admin_or_sub_admin(auth.uid())
    );

-- Làm mới bộ nhớ đệm PostgREST
NOTIFY pgrst, 'reload schema';
