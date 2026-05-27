-- Pre-Pilot Stabilization Indexes

-- 1. Index for CRM Ops / Kanban fast loading by stage and assignee
CREATE INDEX IF NOT EXISTS idx_customers_lifecycle_stage ON public.customers USING btree (lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_customers_owner_sale_id ON public.customers USING btree (owner_sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner_tele_id ON public.customers USING btree (owner_tele_id);
CREATE INDEX IF NOT EXISTS idx_customers_ownership_status ON public.customers USING btree (ownership_status);

-- 2. Index for sorting by created_at (Dispatch Queue, etc)
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers USING btree (created_at DESC);

-- 3. Indexes for heavy relational data (Timeline, Tasks)
-- This fixes slow JOINs when calling customers(*, customer_activities, customer_tasks)
CREATE INDEX IF NOT EXISTS idx_customer_activities_customer_id ON public.customer_activities USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_activities_created_at ON public.customer_activities USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_tasks_customer_id ON public.customer_tasks USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_due_at ON public.customer_tasks USING btree (due_at ASC);
CREATE INDEX IF NOT EXISTS idx_customer_tasks_status ON public.customer_tasks USING btree (status);

-- 4. Index for channel metrics querying if any
-- CREATE INDEX IF NOT EXISTS idx_customers_channel_metrics ON public.customers USING gin (channel_summary);
