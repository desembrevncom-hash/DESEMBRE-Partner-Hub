-- 1. Create Sales Report Exports Table
CREATE TABLE IF NOT EXISTS public.sales_report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_user_id uuid REFERENCES auth.users(id) NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('weekly', 'monthly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  google_sheet_id text,
  google_sheet_url text,
  export_status text NOT NULL DEFAULT 'pending' CHECK (export_status IN ('pending', 'success', 'error')),
  exported_by uuid REFERENCES auth.users(id),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Add Updated_At Trigger
DROP TRIGGER IF EXISTS update_sales_report_exports_updated_at ON public.sales_report_exports;
CREATE TRIGGER update_sales_report_exports_updated_at
  BEFORE UPDATE ON public.sales_report_exports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Useful Indexes
CREATE INDEX IF NOT EXISTS idx_sales_report_exports_search 
  ON public.sales_report_exports(sale_user_id, report_type, period_start, period_end);

-- 4. Row Level Security
ALTER TABLE public.sales_report_exports ENABLE ROW LEVEL SECURITY;

-- Admins/Sub-admins can view all exports
DROP POLICY IF EXISTS "Admins view all report exports" ON public.sales_report_exports;
CREATE POLICY "Admins view all report exports" ON public.sales_report_exports 
FOR SELECT TO authenticated USING (
  public.is_admin_or_sub_admin(auth.uid())
);

-- Sales view own exports
DROP POLICY IF EXISTS "Sales view own report exports" ON public.sales_report_exports;
CREATE POLICY "Sales view own report exports" ON public.sales_report_exports 
FOR SELECT TO authenticated USING (
  sale_user_id = auth.uid()
);

-- NO INSERT/UPDATE for authenticated users via API.
-- Edge Functions use Service Role to bypass RLS and perform INSERT/UPDATE.

-- Ensure Schema Cache is updated
NOTIFY pgrst, 'reload schema';
