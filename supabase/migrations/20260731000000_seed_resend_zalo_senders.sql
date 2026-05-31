-- Seed Resend Email Sender
INSERT INTO public.sender_accounts (
    id,
    name,
    sender_email,
    sender_name,
    provider,
    channel,
    auth_type,
    secret_prefix,
    is_default,
    is_active,
    status,
    health_status
) VALUES (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'Resend Email Sender',
    'hello@example.com', -- placeholder
    'Resend Platform',
    'resend',
    'email',
    'platform_secret',
    'RESEND',
    false,
    true,
    'active',
    'unknown'
) ON CONFLICT DO NOTHING;

-- Seed Zalo OA Sender
INSERT INTO public.sender_accounts (
    id,
    name,
    sender_email,
    sender_name,
    provider,
    channel,
    auth_type,
    secret_prefix,
    is_default,
    is_active,
    status,
    health_status
) VALUES (
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c22',
    'Business Zalo OA Sender',
    'zalo_oa', -- placeholder
    'Zalo OA Platform',
    'zalo_oa',
    'zalo',
    'platform_secret',
    'ZALO',
    false,
    true,
    'active',
    'unknown'
) ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
