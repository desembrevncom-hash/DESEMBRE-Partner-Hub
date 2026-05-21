-- ===== ROLES =====
CREATE TYPE public.app_role AS ENUM ('admin', 'sale');

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'profiles' AND n.nspname = 'public' AND c.relrowsecurity
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'user_roles' AND n.nspname = 'public' AND c.relrowsecurity
  ) THEN
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role::text
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS SETOF public.app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role::public.app_role FROM public.user_roles WHERE user_id = auth.uid()
$$;

-- profiles policies
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles policies
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  -- default role: sale
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'sale');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== PRODUCT OVERRIDES: admin write =====
DROP POLICY IF EXISTS "Admins insert overrides" ON public.product_overrides;
DROP POLICY IF EXISTS "Admins update overrides" ON public.product_overrides;
DROP POLICY IF EXISTS "Admins delete overrides" ON public.product_overrides;
CREATE POLICY "Admins insert overrides" ON public.product_overrides
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update overrides" ON public.product_overrides
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete overrides" ON public.product_overrides
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== ORDERS =====
CREATE SEQUENCE IF NOT EXISTS public.order_no_seq START 1000;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no INTEGER NOT NULL DEFAULT nextval('public.order_no_seq') UNIQUE,
  sale_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  note TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_rate NUMERIC NOT NULL DEFAULT 0.4,
  vat_rate NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_no INTEGER,
  product_name TEXT NOT NULL,
  size TEXT,
  size_type TEXT CHECK (size_type IN ('retail', 'salon')),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_sale ON public.orders(sale_user_id);

-- orders policies
DROP POLICY IF EXISTS "Sale view own orders" ON public.orders;
CREATE POLICY "Sale view own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = sale_user_id);

DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;
CREATE POLICY "Admins view all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Sale create orders" ON public.orders;
CREATE POLICY "Sale create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sale_user_id AND (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Sale update own orders" ON public.orders;
CREATE POLICY "Sale update own orders" ON public.orders
  FOR UPDATE TO authenticated USING (auth.uid() = sale_user_id);

DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Admins update orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Sale delete own draft orders" ON public.orders;
CREATE POLICY "Sale delete own draft orders" ON public.orders
  FOR DELETE TO authenticated USING (auth.uid() = sale_user_id AND status = 'draft');

DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders" ON public.orders
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- order_items policies
DROP POLICY IF EXISTS "View items of accessible orders" ON public.order_items;
CREATE POLICY "View items of accessible orders" ON public.order_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.sale_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

DROP POLICY IF EXISTS "Insert items of own orders" ON public.order_items;
CREATE POLICY "Insert items of own orders" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.sale_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

DROP POLICY IF EXISTS "Update items of own orders" ON public.order_items;
CREATE POLICY "Update items of own orders" ON public.order_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.sale_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

DROP POLICY IF EXISTS "Delete items of own orders" ON public.order_items;
CREATE POLICY "Delete items of own orders" ON public.order_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (o.sale_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

-- timestamp trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS orders_touch ON public.orders;
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
