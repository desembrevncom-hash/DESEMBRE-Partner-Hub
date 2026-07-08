-- Add unique constraint to prevent one CRM customer from being linked to multiple student accounts.
ALTER TABLE public.student_accounts
ADD CONSTRAINT student_accounts_customer_id_key UNIQUE (customer_id);
