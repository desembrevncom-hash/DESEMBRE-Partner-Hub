SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%segment%';
