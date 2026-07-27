begin;
select set_config('request.jwt.claim.sub', '0524b864-7edc-4cd6-abab-4f1832caa36a', true);
select jsonb_pretty(
  public.get_academy_lesson_content(
    'course-b-v4',
    'b2222222-2222-4222-b222-222222222222'
  )
) as lesson_content;
rollback;
