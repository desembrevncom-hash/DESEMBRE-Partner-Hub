-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT DEFAULT 'DESEMBRE VIETNAM',
    address TEXT DEFAULT 'Tầng 5, Tòa nhà Luxury, 123 Kim Mã, Ba Đình, Hà Nội',
    support_email TEXT DEFAULT 'support@desembre.vn',
    support_phone TEXT DEFAULT '1900 6868',
    vat_rate NUMERIC DEFAULT 10,
    default_discount NUMERIC DEFAULT 35,
    enable_notifications BOOLEAN DEFAULT true,
    dark_mode BOOLEAN DEFAULT false,
    system_language TEXT DEFAULT 'vi',
    primary_color TEXT DEFAULT '#6366f1',
    accent_color TEXT DEFAULT '#ec4899',
    logo_light_url TEXT,
    logo_dark_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users"
    ON public.system_settings FOR SELECT
    USING (true);

CREATE POLICY "Enable update for admins and sub_admins"
    ON public.system_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'sub_admin')
        )
    );

CREATE POLICY "Enable insert for admins and sub_admins"
    ON public.system_settings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'sub_admin')
        )
    );

-- Insert default row if not exists
INSERT INTO public.system_settings (
    company_name, address, support_email, support_phone, vat_rate, default_discount, enable_notifications, dark_mode, system_language, primary_color, accent_color
)
SELECT 'DESEMBRE VIETNAM', 'Tầng 5, Tòa nhà Luxury, 123 Kim Mã, Ba Đình, Hà Nội', 'support@desembre.vn', '1900 6868', 10, 35, true, false, 'vi', '#6366f1', '#ec4899'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_settings_timestamp
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

-- Add system_settings to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
