-- TẠO SẴN OVERRIDE DENY CHO HỌC VIÊN
DO $$
DECLARE
  v_student_id uuid := 'cabfcb42-0fae-4c1d-b812-8ec81231a66d';
  v_course_id uuid := 'b0000000-0000-4000-b000-000000000000';
  v_lesson_id uuid;
  v_course_slug text;
BEGIN
  -- Lấy thông tin bài học và slug khóa học để test hàm content
  SELECT id INTO v_lesson_id FROM public.lessons WHERE title = 'Lesson 1' LIMIT 1;
  SELECT slug INTO v_course_slug FROM public.courses WHERE id = v_course_id;

  -- Xóa các override cũ nếu cần
  -- DELETE FROM public.course_access_overrides WHERE student_id = v_student_id AND course_id = v_course_id;

  -- 1. Xác nhận / Tạo active deny override (Block Access)
  IF NOT EXISTS (
    SELECT 1 FROM public.course_access_overrides 
    WHERE student_id = v_student_id 
      AND course_id = v_course_id 
      AND decision = 'deny' 
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    INSERT INTO public.course_access_overrides (course_id, student_id, access_scope, decision, reason, starts_at, created_by)
    VALUES (v_course_id, v_student_id, 'full', 'deny', 'ACCESS_BLOCKED_BY_ADMIN', now(), auth.uid());
  END IF;
END;
$$;

-- 2. Simulate Student JWT (Sử dụng JWT claim sub của user tương ứng với student_id)
BEGIN;
  -- Thay '0524b864...' bằng user_id chuẩn nếu cần, theo screenshot của bạn là '0524b864-7edc-4cd6-abab-4f1832caa36a'
  SELECT set_config('request.jwt.claim.sub', '0524b864-7edc-4cd6-abab-4f1832caa36a', true);
  
  -- 3. Kiểm tra private.get_course_access_decision (Phải trả về ACCESS_BLOCKED và can_view = false)
  SELECT private.get_course_access_decision('b0000000-0000-4000-b000-000000000000') AS access_decision;

  -- 4. Kiểm tra public.get_academy_lesson_content (Phải trả về state = ACCESS_DENIED)
  -- Bạn hãy thay giá trị lesson_id bằng ID chính xác của 'Lesson 1' Course B
  -- SELECT public.get_academy_lesson_content('course-b-slug', 'YOUR-LESSON-ID-HERE') AS lesson_content;
ROLLBACK;
