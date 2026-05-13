-- Kích hoạt Row-Level Security (RLS) cho các bảng Sự kiện doanh nghiệp
ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- 1. Gỡ bỏ các chính sách cũ trên bảng company_events có thể gây rào cản
DROP POLICY IF EXISTS "Admins manage company events" ON public.company_events;
DROP POLICY IF EXISTS "Admins manage all company events" ON public.company_events;
DROP POLICY IF EXISTS "Sales view active company events" ON public.company_events;

-- Tạo chính sách mới: Cấp toàn quyền (Đọc, Thêm, Sửa, Xóa) cho Admin và Phó Admin
CREATE POLICY "Admins manage company events" ON public.company_events
FOR ALL TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Cho phép nhân viên Sale xem các sự kiện đang hoạt động
CREATE POLICY "Sales view active company events" ON public.company_events
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'sale')
  AND status IN ('published', 'closed', 'completed')
);


-- 2. Gỡ bỏ các chính sách cũ trên bảng event_registrations
DROP POLICY IF EXISTS "Admins manage all event registrations" ON public.event_registrations;

-- Tạo chính sách mới: Cấp toàn quyền quản lý danh sách đăng ký cho Admin và Phó Admin
CREATE POLICY "Admins manage all event registrations" ON public.event_registrations
FOR ALL TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

-- Thông báo làm mới bộ đệm cấu trúc lược đồ cho PostgREST API
NOTIFY pgrst, 'reload schema';
