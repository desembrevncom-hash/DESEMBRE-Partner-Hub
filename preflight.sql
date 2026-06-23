SELECT 
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='marketing_send_batches') as has_batches_table,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='marketing_send_dispatches') as has_dispatches_table,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='marketing_send_dispatch_attempts') as has_attempts_table,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles') as has_roles_table,
  (SELECT count(*) FROM public.user_roles WHERE role IN ('admin', 'sub_admin')) as admin_count,
  (SELECT count(*) FROM public.marketing_send_batches) as batches_count,
  (SELECT count(*) FROM public.marketing_send_dispatches) as dispatches_count,
  (SELECT count(*) FROM public.marketing_send_dispatch_attempts) as attempts_count;
