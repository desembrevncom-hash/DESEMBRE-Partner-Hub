-- 1. Ensure updated_at helper exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Add Opportunity Fields to Customers Table
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS opportunity_expected_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opportunity_expected_close_date date,
  ADD COLUMN IF NOT EXISTS opportunity_potential_score smallint;

-- Add constraint safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customers_opportunity_score_check'
    ) THEN
        ALTER TABLE public.customers
            ADD CONSTRAINT customers_opportunity_score_check 
            CHECK (opportunity_potential_score IS NULL OR (opportunity_potential_score >= 1 AND opportunity_potential_score <= 10));
    END IF;
END $$;

-- 3. Create Sales Report Inputs Table
CREATE TABLE IF NOT EXISTS public.sales_report_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_user_id uuid REFERENCES auth.users(id) NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('weekly', 'monthly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  variable_cost numeric DEFAULT 0,
  expected_orders_next_period integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT sales_report_inputs_unique_period UNIQUE(sale_user_id, report_type, period_start, period_end)
);

-- 4. Add Updated_At Trigger
DROP TRIGGER IF EXISTS update_sales_report_inputs_updated_at ON public.sales_report_inputs;
CREATE TRIGGER update_sales_report_inputs_updated_at
  BEFORE UPDATE ON public.sales_report_inputs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Useful Indexes
CREATE INDEX IF NOT EXISTS idx_sales_report_inputs_search 
  ON public.sales_report_inputs(sale_user_id, report_type, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_customers_owner_sale_id 
  ON public.customers(owner_sale_id);

CREATE INDEX IF NOT EXISTS idx_customers_opportunity_close_date 
  ON public.customers(opportunity_expected_close_date);

CREATE INDEX IF NOT EXISTS idx_customers_opportunity_score 
  ON public.customers(opportunity_potential_score);

-- 6. Row Level Security for Sales Report Inputs
ALTER TABLE public.sales_report_inputs ENABLE ROW LEVEL SECURITY;

-- Admins/Sub-admins can view all reports
DROP POLICY IF EXISTS "Admins view all report inputs" ON public.sales_report_inputs;
CREATE POLICY "Admins view all report inputs" ON public.sales_report_inputs 
FOR SELECT TO authenticated USING (
  public.is_admin_or_sub_admin(auth.uid())
);

-- Admins/Sub-admins can insert/update all with check
DROP POLICY IF EXISTS "Admins insert report inputs" ON public.sales_report_inputs;
CREATE POLICY "Admins insert report inputs" ON public.sales_report_inputs 
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin_or_sub_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins update report inputs" ON public.sales_report_inputs;
CREATE POLICY "Admins update report inputs" ON public.sales_report_inputs 
FOR UPDATE TO authenticated USING (
  public.is_admin_or_sub_admin(auth.uid())
) WITH CHECK (
  public.is_admin_or_sub_admin(auth.uid())
);

-- Sales view own rows
DROP POLICY IF EXISTS "Sales view own report inputs" ON public.sales_report_inputs;
CREATE POLICY "Sales view own report inputs" ON public.sales_report_inputs 
FOR SELECT TO authenticated USING (
  sale_user_id = auth.uid()
);

-- Sales insert own rows
DROP POLICY IF EXISTS "Sales insert own report inputs" ON public.sales_report_inputs;
CREATE POLICY "Sales insert own report inputs" ON public.sales_report_inputs 
FOR INSERT TO authenticated WITH CHECK (
  sale_user_id = auth.uid()
);

-- Sales update own rows
DROP POLICY IF EXISTS "Sales update own report inputs" ON public.sales_report_inputs;
CREATE POLICY "Sales update own report inputs" ON public.sales_report_inputs 
FOR UPDATE TO authenticated USING (
  sale_user_id = auth.uid()
) WITH CHECK (
  sale_user_id = auth.uid()
);

-- 7. RPC get_sales_performance_report
CREATE OR REPLACE FUNCTION public.get_sales_performance_report(
  p_sale_user_id uuid,
  p_report_type text,
  p_period_start date,
  p_period_end date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_admin boolean;
  v_target_sale_id uuid;
  v_result json;
BEGIN
  -- 1. Check if caller is admin using normalized helper
  v_is_admin := public.is_admin_or_sub_admin(v_caller_id);

  -- 2. Determine target sale ID and enforce security
  IF v_is_admin THEN
    IF p_sale_user_id IS NULL THEN
      RAISE EXCEPTION 'Admin must specify a p_sale_user_id for this report.' USING ERRCODE = '42501';
    ELSE
      v_target_sale_id := p_sale_user_id;
    END IF;
  ELSE
    -- If v_caller_id is NULL (unauthenticated), p_sale_user_id != v_caller_id is evaluated as NULL (falsy) 
    -- in Postgres. We must use IS DISTINCT FROM to ensure it evaluates to TRUE.
    IF p_sale_user_id IS NULL THEN
      v_target_sale_id := v_caller_id;
    ELSIF p_sale_user_id IS DISTINCT FROM v_caller_id THEN
      RAISE EXCEPTION 'Permission denied. Sales can only view their own reports.' USING ERRCODE = '42501';
    ELSE
      v_target_sale_id := v_caller_id;
    END IF;
  END IF;

  -- 3. Perform Aggregations using v_target_sale_id
  SELECT json_build_object(
    'total_revenue', COALESCE((
      SELECT sum(o.total) FROM orders o 
      JOIN customers c ON o.customer_id = c.id
      WHERE c.owner_sale_id = v_target_sale_id 
      AND o.status IN ('completed', 'shipped')
      AND o.created_at >= p_period_start::timestamp 
      AND o.created_at <= (p_period_end::timestamp + interval '1 day' - interval '1 microsecond')
    ), 0),
    'order_count', (
      SELECT count(*) FROM orders o 
      JOIN customers c ON o.customer_id = c.id
      WHERE c.owner_sale_id = v_target_sale_id 
      AND o.status IN ('completed', 'shipped')
      AND o.created_at >= p_period_start::timestamp 
      AND o.created_at <= (p_period_end::timestamp + interval '1 day' - interval '1 microsecond')
    ),
    'customers_who_ordered', (
      SELECT count(DISTINCT o.customer_id) FROM orders o 
      JOIN customers c ON o.customer_id = c.id
      WHERE c.owner_sale_id = v_target_sale_id 
      AND o.status IN ('completed', 'shipped')
      AND o.created_at >= p_period_start::timestamp 
      AND o.created_at <= (p_period_end::timestamp + interval '1 day' - interval '1 microsecond')
    ),
    'new_customers', (
      SELECT count(*) FROM customers 
      WHERE owner_sale_id = v_target_sale_id
      AND created_at >= p_period_start::timestamp 
      AND created_at <= (p_period_end::timestamp + interval '1 day' - interval '1 microsecond')
    ),
    'direct_visits', (
      SELECT count(*) FROM customer_visit_checkins cv
      JOIN customers c ON cv.customer_id = c.id
      WHERE c.owner_sale_id = v_target_sale_id
      AND cv.created_at >= p_period_start::timestamp 
      AND cv.created_at <= (p_period_end::timestamp + interval '1 day' - interval '1 microsecond')
    ),
    'customers_followed', (
      SELECT count(*) FROM customers 
      WHERE owner_sale_id = v_target_sale_id
      AND lifecycle_stage IN ('contacting', 'consulting')
    ),
    'active_90_day_customers', (
      SELECT count(DISTINCT o.customer_id) FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE c.owner_sale_id = v_target_sale_id 
      AND o.status IN ('completed', 'shipped')
      AND o.created_at >= (now() - interval '90 days')
    ),
    'live_zoom_sessions', (
      SELECT count(*) FROM customer_tasks t
      JOIN customers c ON t.customer_id = c.id
      WHERE c.owner_sale_id = v_target_sale_id
      AND t.task_type IN ('call', 'zoom')
      AND t.status = 'completed'
      AND t.completed_at >= p_period_start::timestamp 
      AND t.completed_at <= (p_period_end::timestamp + interval '1 day' - interval '1 microsecond')
    ),
    'opportunities_expected_revenue', COALESCE((
      SELECT sum(opportunity_expected_revenue) FROM customers 
      WHERE owner_sale_id = v_target_sale_id 
      AND lifecycle_stage NOT IN ('won', 'lost', 'deleted')
    ), 0),
    'manual_inputs', (
      SELECT row_to_json(ri) FROM sales_report_inputs ri
      WHERE ri.sale_user_id = v_target_sale_id
      AND ri.report_type = p_report_type
      AND ri.period_start = p_period_start
      AND ri.period_end = p_period_end
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Security Grants
REVOKE ALL ON FUNCTION public.get_sales_performance_report(uuid, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_performance_report(uuid, text, date, date) TO authenticated;
