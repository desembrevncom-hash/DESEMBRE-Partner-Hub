-- Migration: Create Product Knowledge Base tables, enable RLS, and seed initial records.

-- 1. Create public.product_knowledge table
CREATE TABLE IF NOT EXISTS public.product_knowledge (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id integer NOT NULL,
    benefits text NOT NULL,
    skin_concerns text[],
    suitable_spa_types text[],
    usage_instructions text NOT NULL,
    sales_pitch text NOT NULL,
    cross_sell_products integer[],
    restock_cycle_days integer DEFAULT 60,
    warnings text,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_pk_product_id_unique UNIQUE (product_id)
);

-- 2. Create public.product_objections table
CREATE TABLE IF NOT EXISTS public.product_objections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id integer NOT NULL,
    objection_type text NOT NULL,
    customer_statement text NOT NULL,
    suggested_response text NOT NULL,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_knowledge_product_id ON public.product_knowledge (product_id);
CREATE INDEX IF NOT EXISTS idx_product_knowledge_is_active ON public.product_knowledge (is_active);
CREATE INDEX IF NOT EXISTS idx_product_objections_product_id ON public.product_objections (product_id);
CREATE INDEX IF NOT EXISTS idx_product_objections_objection_type ON public.product_objections (objection_type);
CREATE INDEX IF NOT EXISTS idx_product_objections_is_active ON public.product_objections (is_active);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.product_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_objections ENABLE ROW LEVEL SECURITY;

-- Helper to check if a user belongs to sales roles (sale, tele_lead, telesale)
CREATE OR REPLACE FUNCTION public.is_sales_member(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = $1
        AND role IN ('sale', 'tele_lead', 'telesale')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Define RLS Policies for product_knowledge
DROP POLICY IF EXISTS "Admin and Sub Admin can manage product knowledge" ON public.product_knowledge;
CREATE POLICY "Admin and Sub Admin can manage product knowledge"
ON public.product_knowledge
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Sales staff can view active product knowledge" ON public.product_knowledge;
CREATE POLICY "Sales staff can view active product knowledge"
ON public.product_knowledge
FOR SELECT
TO authenticated
USING (
    is_active = true 
    AND (
        public.is_sales_member(auth.uid()) 
        OR public.is_admin_or_sub_admin(auth.uid())
    )
);

-- 6. Define RLS Policies for product_objections
DROP POLICY IF EXISTS "Admin and Sub Admin can manage product objections" ON public.product_objections;
CREATE POLICY "Admin and Sub Admin can manage product objections"
ON public.product_objections
FOR ALL
TO authenticated
USING (public.is_admin_or_sub_admin(auth.uid()))
WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));

DROP POLICY IF EXISTS "Sales staff can view active product objections" ON public.product_objections;
CREATE POLICY "Sales staff can view active product objections"
ON public.product_objections
FOR SELECT
TO authenticated
USING (
    is_active = true 
    AND (
        public.is_sales_member(auth.uid()) 
        OR public.is_admin_or_sub_admin(auth.uid())
    )
);

-- 7. Seed sample data for products in static catalog (e.g. product_id = 1 and 2)
INSERT INTO public.product_knowledge (
    product_id,
    benefits,
    skin_concerns,
    suitable_spa_types,
    usage_instructions,
    sales_pitch,
    cross_sell_products,
    restock_cycle_days,
    warnings,
    is_active
) VALUES (
    1,
    'Sữa rửa mặt dạng sữa không tạo bọt, làm sạch dịu nhẹ hòa tan hoàn toàn bụi bẩn và dầu thừa bám sâu trong lỗ chân lông. Giữ ẩm sinh học và bảo vệ màng acid béo tự nhiên của da nhờ chiết xuất lô hội và các thảo mộc quý.',
    ARRAY['Da nhạy cảm', 'Da khô', 'Lão hóa', 'Phục hồi sau xâm lấn'],
    ARRAY['Spa trị liệu', 'Spa thư giãn', 'Clinic'],
    'Lấy khoảng 2-3ml thoa đều lên da mặt khô, massage nhẹ nhàng trong 1-2 phút để sữa rửa mặt hòa tan bụi bẩn. Dùng bông tẩy trang mềm hoặc bọt biển lau sạch nhẹ nhàng, sau đó rửa lại bằng nước ấm.',
    'Đây là dòng sữa rửa mặt không bọt chuyên dụng bán chạy nhất của Desembre cho các Spa/Clinic. Cực kỳ an toàn, phục hồi chuyên sâu và làm dịu tức thì cho cả làn da mỏng yếu nhất sau laser, lăn kim.',
    ARRAY[2, 8],
    90,
    'Tránh chà xát quá mạnh gây tổn thương vật lý lên da yếu. Tránh tiếp xúc trực tiếp vào mắt.',
    true
), (
    2,
    'Nước tẩy trang cấp ẩm và cân bằng pH 2 trong 1. Giúp loại bỏ hoàn toàn bã nhờn, lớp trang điểm và kem chống nắng cơ học một cách an toàn mà không cần rửa lại bằng nước. Chứa trà xanh kháng viêm và làm dịu da mụn.',
    ARRAY['Da mụn', 'Da dầu', 'Nhạy cảm', 'Lỗ chân lông to'],
    ARRAY['Spa trị liệu', 'Home Spa', 'Clinic'],
    'Thấm đẫm bông tẩy trang bằng nước tẩy trang. Lau nhẹ nhàng toàn mặt theo hướng từ trong ra ngoài, từ dưới lên trên. Lặp lại với miếng bông mới nếu cần thiết cho đến khi sạch hoàn toàn.',
    'Giải pháp làm sạch nhanh chuyên sâu cho spa giúp rút ngắn thời gian liệu trình mà vẫn đảm bảo da sạch mịn màng, thông thoáng lỗ chân lông.',
    ARRAY[1, 9],
    60,
    'Ngưng sử dụng nếu xuất hiện cảm giác châm chích kéo dài hoặc mẩn đỏ.',
    true
)
ON CONFLICT (product_id) DO UPDATE SET
    benefits = EXCLUDED.benefits,
    skin_concerns = EXCLUDED.skin_concerns,
    suitable_spa_types = EXCLUDED.suitable_spa_types,
    usage_instructions = EXCLUDED.usage_instructions,
    sales_pitch = EXCLUDED.sales_pitch,
    cross_sell_products = EXCLUDED.cross_sell_products,
    restock_cycle_days = EXCLUDED.restock_cycle_days,
    warnings = EXCLUDED.warnings,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Seed objections for product_id = 1
INSERT INTO public.product_objections (
    product_id,
    objection_type,
    customer_statement,
    suggested_response,
    is_active
) VALUES (
    1,
    'Giá cao',
    'Sữa rửa mặt gì mà tận 650.000đ cho chai bán lẻ 150ml, đắt quá em ơi.',
    'Dạ chị ơi, chai 150ml này là dạng sữa đậm đặc không tạo bọt hao phí, mỗi lần sử dụng chỉ cần 2-3 giọt nhỏ nên dùng được liên tục tới 4-5 tháng ạ. Đặc biệt, đây là dòng làm sạch phục hồi bảo vệ màng sinh học, giúp da khỏe hơn mỗi ngày, tính ra tiết kiệm hơn nhiều so với việc mua sữa rửa mặt xút mạnh rồi phải tốn tiền mua serum phục hồi đó chị.',
    true
), (
    1,
    'Trải nghiệm không bọt',
    'Chị rửa mặt quen loại nhiều bọt rồi, loại không bọt này cảm giác nhớt nhớt không sạch.',
    'Dạ em hiểu cảm giác ban đầu của chị ạ. Tuy nhiên, bọt xút nhiều sẽ làm mất nước của tế bào da và gây khô căng giả tạo sau rửa. Sữa rửa mặt Milk Essential làm sạch bằng cách nhũ hóa tự nhiên, lấy đi bụi bẩn mà giữ lại độ ẩm sinh học lý tưởng. Sau khi rửa xong da chị sẽ cực kỳ mịn màng và sạch sâu, chị dùng thử 3 ngày sẽ thấy da đỡ đổ dầu thừa hẳn đó ạ.',
    true
);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
