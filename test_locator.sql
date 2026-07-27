begin;
select jsonb_pretty(
  public.get_academy_lesson_media_locator('b5555555-5555-4555-b555-555555555555')
);
rollback;
