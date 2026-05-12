-- Seed primary Admin account: desembrevn@gmail.com / 12345678

DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'desembrevn@gmail.com';

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
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      target_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'desembrevn@gmail.com',
      crypt('12345678', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"Admin Desembre"}',
      now(),
      now()
    );
  END IF;

  -- Ensure the user role is strictly set to 'admin'
  UPDATE public.user_roles
  SET role = 'admin'
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin');
  END IF;

  -- Set profile attributes
  UPDATE public.profiles
  SET display_name = 'Admin Desembre',
      must_change_password = false
  WHERE id = target_user_id;
END $$;
