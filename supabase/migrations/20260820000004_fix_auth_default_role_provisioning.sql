-- Migration: Fix Auth Default Role Provisioning

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_count INTEGER;
  v_role_str text;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));

  SELECT COUNT(*) INTO v_user_count FROM public.user_roles;
  IF v_user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    v_role_str := NEW.raw_app_meta_data->>'role';
    IF v_role_str IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role_str::public.app_role);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;