-- ============================================================================
-- MIGRATION: Cấp quyền cho Sales tự tạo Template, Chiến dịch và Snapshot gửi
-- ============================================================================

-- 1. CẬP NHẬT CHÍNH SÁCH RLS CHO BẢNG MESSAGE_TEMPLATES
DROP POLICY IF EXISTS "Anyone view active message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can view templates" ON public.message_templates;

-- Cho phép SELECT đối với templates active, dùng chung, hoặc do chính mình tạo
CREATE POLICY "Users can view templates" 
ON public.message_templates FOR SELECT 
TO authenticated 
USING (
    public.is_admin_or_sub_admin(auth.uid()) 
    OR is_active = true
    OR is_shared = true 
    OR created_by = auth.uid()
);

-- 2. CẬP NHẬT CHÍNH SÁCH RLS CHO BẢNG MARKETING_CAMPAIGNS
DROP POLICY IF EXISTS "Admins manage marketing campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Sales view marketing campaigns" ON public.marketing_campaigns;

-- Cho phép xem tất cả chiến dịch
CREATE POLICY "Anyone view marketing campaigns" 
ON public.marketing_campaigns FOR SELECT 
TO authenticated 
USING (true);

-- Cho phép Admin hoặc chính người tạo quản lý chiến dịch
CREATE POLICY "Users manage marketing campaigns" 
ON public.marketing_campaigns FOR ALL 
TO authenticated 
USING (
    public.is_admin_or_sub_admin(auth.uid()) 
    OR created_by = auth.uid()
)
WITH CHECK (
    public.is_admin_or_sub_admin(auth.uid()) 
    OR created_by = auth.uid()
);

-- 3. CẬP NHẬT CHÍNH SÁCH RLS CHO BẢNG CAMPAIGN_RECIPIENT_SNAPSHOTS
DROP POLICY IF EXISTS "Admin/SubAdmin can manage snapshots" ON public.campaign_recipient_snapshots;
DROP POLICY IF EXISTS "Sales can read snapshots" ON public.campaign_recipient_snapshots;

-- Cho phép xem tất cả snapshots
CREATE POLICY "Anyone view snapshots" 
ON public.campaign_recipient_snapshots FOR SELECT 
TO authenticated 
USING (true);

-- Cho phép Admin hoặc chính người tạo chiến dịch quản lý snapshots
CREATE POLICY "Users manage snapshots of their own campaigns" 
ON public.campaign_recipient_snapshots FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.marketing_campaigns mc
        WHERE mc.id = campaign_recipient_snapshots.campaign_id
        AND (mc.created_by = auth.uid() OR public.is_admin_or_sub_admin(auth.uid()))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.marketing_campaigns mc
        WHERE mc.id = campaign_id
        AND (mc.created_by = auth.uid() OR public.is_admin_or_sub_admin(auth.uid()))
    )
);

-- Làm mới bộ nhớ đệm PostgREST
NOTIFY pgrst, 'reload schema';
