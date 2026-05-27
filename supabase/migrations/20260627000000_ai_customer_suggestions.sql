-- Migration: AI Customer Suggestions MVP
-- Description: Bảng lưu trữ lịch sử gợi ý của AI dành cho sale

-- 1. Create table ai_customer_suggestions
CREATE TABLE IF NOT EXISTS public.ai_customer_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    generated_for uuid NOT NULL REFERENCES auth.users(id),
    
    suggestion_type text NOT NULL,
    suggestion_json jsonb NOT NULL,
    confidence numeric DEFAULT 0,
    status text DEFAULT 'active',
    
    source_snapshot jsonb DEFAULT '{}'::jsonb,
    model text,
    provider text,
    token_usage jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz DEFAULT now(),
    dismissed_at timestamptz,
    accepted_at timestamptz
);

-- 2. Check constraints
ALTER TABLE public.ai_customer_suggestions DROP CONSTRAINT IF EXISTS check_suggestion_type;
ALTER TABLE public.ai_customer_suggestions ADD CONSTRAINT check_suggestion_type 
    CHECK (suggestion_type IN ('next_best_action','recommended_channel','message_suggestion','risk_flags','summary', 'full'));

ALTER TABLE public.ai_customer_suggestions DROP CONSTRAINT IF EXISTS check_suggestion_status;
ALTER TABLE public.ai_customer_suggestions ADD CONSTRAINT check_suggestion_status 
    CHECK (status IN ('active','accepted','dismissed','expired'));

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_customer_id ON public.ai_customer_suggestions(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_generated_for ON public.ai_customer_suggestions(generated_for);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON public.ai_customer_suggestions(status);

-- 4. RLS Policies
ALTER TABLE public.ai_customer_suggestions ENABLE ROW LEVEL SECURITY;

-- Admin/SubAdmin có thể xem tất cả
DROP POLICY IF EXISTS "Admins view all ai_suggestions" ON public.ai_customer_suggestions;
CREATE POLICY "Admins view all ai_suggestions" 
    ON public.ai_customer_suggestions FOR SELECT 
    TO authenticated 
    USING (public.is_admin_or_sub_admin(auth.uid()));

-- Sale xem các gợi ý do hệ thống generate cho chính mình, HOẶC xem các khách hàng mà sale quản lý (pool)
DROP POLICY IF EXISTS "Sales view relevant ai_suggestions" ON public.ai_customer_suggestions;
CREATE POLICY "Sales view relevant ai_suggestions" 
    ON public.ai_customer_suggestions FOR SELECT 
    TO authenticated 
    USING (
        generated_for = auth.uid() 
        OR public.can_view_customer(customer_id, auth.uid())
    );

-- Insert/Delete chỉ từ service_role (Edge function) => frontend sẽ gọi Edge Function để sinh, DB chặn Insert từ user.
-- Update (chuyển status thành accepted/dismissed) thì Sale chỉ có thể cập nhật cho các record generate cho chính mình
DROP POLICY IF EXISTS "Users update own ai_suggestions status" ON public.ai_customer_suggestions;
CREATE POLICY "Users update own ai_suggestions status" 
    ON public.ai_customer_suggestions FOR UPDATE 
    TO authenticated 
    USING (generated_for = auth.uid())
    WITH CHECK (generated_for = auth.uid());

-- Tải lại cache quyền
NOTIFY pgrst, 'reload schema';
