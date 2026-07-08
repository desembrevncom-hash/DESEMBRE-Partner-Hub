ALTER TABLE public.student_accounts
ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_review', 'blocked'));
