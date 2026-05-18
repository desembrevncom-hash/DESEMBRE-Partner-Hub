-- Tạo bảng notifications nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    message text,
    type text NOT NULL,
    priority text DEFAULT 'normal',
    entity_type text,
    entity_id uuid,
    action_url text,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Bật RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Bất kỳ user đã đăng nhập nào cũng có thể gửi (insert) thông báo
CREATE POLICY "Cho phép user tạo thông báo" ON public.notifications
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Policy: User chỉ có thể xem/đọc các thông báo được gửi cho chính mình (recipient)
CREATE POLICY "User chỉ thấy thông báo của mình" ON public.notifications
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = recipient_user_id);

-- Policy: User có thể cập nhật thông báo của mình (đánh dấu đã đọc)
CREATE POLICY "User cập nhật thông báo của mình" ON public.notifications
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = recipient_user_id);

-- Policy: User có thể xóa thông báo của mình
CREATE POLICY "User xóa thông báo của mình" ON public.notifications
    FOR DELETE 
    TO authenticated 
    USING (auth.uid() = recipient_user_id);

-- Bật Realtime cho bảng notifications để nhận thông báo tức thì (Toast)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
