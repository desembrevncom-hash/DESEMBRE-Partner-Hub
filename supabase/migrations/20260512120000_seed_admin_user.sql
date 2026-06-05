-- Seed primary Admin account: desembrevn.com@gmail.com / 12345678
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'desembrevn.com@gmail.com';

  IF target_user_id IS NULL THEN
    target_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      target_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'desembrevn.com@gmail.com',
      extensions.crypt('12345678', extensions.gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"Admin Desembre"}',
      now(),
      now()
    );
  END IF;

  -- Ensure the user role is strictly set to 'admin' and remove any accidental 'sale' assignment
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = 'sale';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Set profile attributes
  UPDATE public.profiles
  SET display_name = 'Admin Desembre',
      must_change_password = false
  WHERE id = target_user_id;

  -- Backfill empty strings for mandatory GoTrue token columns on manually seeded records
  -- to prevent Go struct unmarshaling panics ("Database error querying schema") during login.
  UPDATE auth.users
  SET confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, '')
  WHERE confirmation_token IS NULL 
     OR recovery_token IS NULL 
     OR email_change_token_new IS NULL 
     OR email_change IS NULL
     OR phone_change IS NULL
     OR phone_change_token IS NULL
     OR reauthentication_token IS NULL;
END $$;

-- Enhance has_role helper function to natively recognize the primary admin account
-- as a direct, unblockable override for all database-level Row Level Security (RLS) policies.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    (_role::text = 'admin' AND EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = _user_id AND email = 'desembrevn.com@gmail.com'
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id AND role::text = _role::text
    )
$$;
