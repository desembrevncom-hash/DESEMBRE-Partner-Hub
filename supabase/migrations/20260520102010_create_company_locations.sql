-- Migration: Create company_locations table

CREATE TABLE IF NOT EXISTS public.company_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text NOT NULL UNIQUE,
    address text,
    city text,
    district text,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    location_type text NOT NULL DEFAULT 'office',
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed a default record
INSERT INTO public.company_locations (name, code, address, city, latitude, longitude, location_type, is_default, is_active)
VALUES (
    'Văn phòng Hà Nội',
    'hanoi_office',
    'Chưa cập nhật, Hà Nội',
    'Hà Nội',
    21.028511,  -- Placeholder for Hanoi
    105.804817, -- Placeholder for Hanoi
    'office',
    true,
    true
)
ON CONFLICT (code) DO NOTHING;
