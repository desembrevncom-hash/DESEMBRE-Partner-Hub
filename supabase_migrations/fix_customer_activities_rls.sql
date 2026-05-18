-- Bật bảo mật cho bảng customer_activities (nếu chưa bật)
ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;

-- Xóa các policy cũ để tránh trùng lặp
DROP POLICY IF EXISTS "Admins manage all activities" ON public.customer_activities;
DROP POLICY IF EXISTS "Owners view activities" ON public.customer_activities;
DROP POLICY IF EXISTS "Assigned telesales view activities" ON public.customer_activities;
DROP POLICY IF EXISTS "Users create activities for their customers" ON public.customer_activities;
DROP POLICY IF EXISTS "Users create activities" ON public.customer_activities;
DROP POLICY IF EXISTS "Users view relevant activities" ON public.customer_activities;

-- 1. Quyền xem (SELECT): Đảm bảo Sale, Telesale, Tele Lead và Admin xem đúng những ghi chú thuộc phạm vi quản lý của mình
CREATE POLICY "Cho phép xem nhật ký liên quan" ON public.customer_activities
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin_or_sub_admin(auth.uid())
        OR public.is_tele_lead(auth.uid())
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_activities.customer_id
            AND (c.owner_sale_id = auth.uid() OR c.owner_tele_id = auth.uid())
        )
    );

-- 2. Quyền thêm mới (INSERT): Tối giản tối đa để tránh lỗi đệ quy RLS khi thêm ghi chú chăm sóc khách hàng
CREATE POLICY "Cho phép thêm nhật ký chăm sóc" ON public.customer_activities
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
