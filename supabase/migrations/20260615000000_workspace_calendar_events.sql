-- Migration: Cập nhật bảng public.calendar_events hỗ trợ Workspace Calendar (Phase 4)

-- 1. Bổ sung các cột mới
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_ids UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'company')),
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT false;

-- Auto-fill owner_user_id bằng created_by hoặc assigned_sale_id cũ để tránh null
UPDATE public.calendar_events
SET owner_user_id = COALESCE(created_by, assigned_sale_id)
WHERE owner_user_id IS NULL;

-- 2. Tái cấu trúc RLS (Row Level Security) cho bảng calendar_events
-- RLS đã bật từ trước, ta chỉ cần REPLACE các policy cũ

-- 2.1 Quyền SELECT
DROP POLICY IF EXISTS "Users view allowed calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events select access" ON public.calendar_events;
CREATE POLICY "Calendar events select access"
ON public.calendar_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  owner_user_id = auth.uid() OR
  auth.uid() = ANY(assigned_user_ids) OR
  visibility = 'company' OR
  assigned_sale_id = auth.uid() OR
  created_by = auth.uid()
);

-- 2.2 Quyền INSERT
DROP POLICY IF EXISTS "Users insert calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events insert access" ON public.calendar_events;
CREATE POLICY "Calendar events insert access"
ON public.calendar_events FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  (
    created_by = auth.uid() AND
    owner_user_id = auth.uid() AND
    visibility = 'private'
  )
);

-- 2.3 Quyền UPDATE
DROP POLICY IF EXISTS "Users update allowed calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events update access" ON public.calendar_events;
CREATE POLICY "Calendar events update access"
ON public.calendar_events FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  owner_user_id = auth.uid() OR
  created_by = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  owner_user_id = auth.uid() OR
  created_by = auth.uid()
);

-- 2.4 Quyền DELETE
DROP POLICY IF EXISTS "Admins delete calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events delete access" ON public.calendar_events;
CREATE POLICY "Calendar events delete access"
ON public.calendar_events FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  owner_user_id = auth.uid() OR
  created_by = auth.uid()
);

-- Nạp lại schema cache
NOTIFY pgrst, 'reload schema';
