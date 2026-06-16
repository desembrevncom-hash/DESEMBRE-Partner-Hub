-- ============================================================================
-- M6: Provider Readiness Layer v1.3
-- ============================================================================

-- ============================================================================
-- 1. Pre-checks (M2 Dependency & M6 Partial-Install Check)
-- ============================================================================
DO $$ 
DECLARE 
  v_count int;
BEGIN 
  -- 1a. M2 Dependency Check
  SELECT count(*) INTO v_count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_templates';
  IF v_count = 0 THEN RAISE EXCEPTION 'M2 Dependency missing: public.marketing_templates table does not exist.'; END IF;
  
  SELECT count(*) INTO v_count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'marketing_templates' AND column_name IN ('id', 'name', 'channel', 'body', 'variables_json');
  IF v_count < 5 THEN RAISE EXCEPTION 'M2 Dependency missing: required columns in marketing_templates do not exist.'; END IF;

  -- 1b. M6 Partial-Install Check
  SELECT count(*) INTO v_count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('marketing_provider_accounts', 'marketing_provider_template_mappings', 'marketing_provider_readiness_logs');
  IF v_count > 0 THEN RAISE EXCEPTION 'M6 Partial Install detected: M6 tables already exist.'; END IF;

  SELECT count(*) INTO v_count FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'public' AND proname IN ('m6_create_provider_account', 'm6_update_provider_external_config_status', 'm6_upsert_template_mapping', 'm6_toggle_provider_readiness');
  IF v_count > 0 THEN RAISE EXCEPTION 'M6 Partial Install detected: M6 RPCs already exist.'; END IF;
END $$;

-- ============================================================================
-- 2. Schema Creation & Strict Constraints
-- ============================================================================

CREATE TABLE public.marketing_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type text NOT NULL,
  account_name text NOT NULL,
  external_provider_id text,
  readiness_status text NOT NULL DEFAULT 'not_configured',
  secret_status text NOT NULL DEFAULT 'not_required_yet',
  secret_reference text,
  configured_externally boolean NOT NULL DEFAULT false,
  manual_verification_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE public.marketing_provider_accounts ADD CONSTRAINT check_m6_mpa_provider_type CHECK (provider_type IN ('zalo_zns', 'sendgrid', 'sms', 'smtp', 'other'));
ALTER TABLE public.marketing_provider_accounts ADD CONSTRAINT check_m6_mpa_readiness_status CHECK (readiness_status IN ('not_configured', 'pending_manual_verification', 'ready', 'disabled'));
ALTER TABLE public.marketing_provider_accounts ADD CONSTRAINT check_m6_mpa_secret_status CHECK (secret_status IN ('not_required_yet', 'missing', 'configured_externally', 'invalid_reference'));

CREATE TABLE public.marketing_provider_template_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_template_id uuid NOT NULL REFERENCES public.marketing_templates(id),
  provider_account_id uuid NOT NULL REFERENCES public.marketing_provider_accounts(id),
  provider_template_id text NOT NULL,
  param_mapping_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping_status text NOT NULL DEFAULT 'draft',
  readiness_status text NOT NULL DEFAULT 'not_configured',
  last_verified_at timestamptz,
  verification_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  CONSTRAINT unique_m6_mptm UNIQUE(provider_account_id, marketing_template_id, provider_template_id)
);

ALTER TABLE public.marketing_provider_template_mappings ADD CONSTRAINT check_m6_mptm_mapping_status CHECK (mapping_status IN ('draft', 'active', 'archived'));
ALTER TABLE public.marketing_provider_template_mappings ADD CONSTRAINT check_m6_mptm_readiness_status CHECK (readiness_status IN ('not_configured', 'pending_manual_verification', 'ready', 'disabled'));
ALTER TABLE public.marketing_provider_template_mappings ADD CONSTRAINT check_m6_mptm_json CHECK (jsonb_typeof(param_mapping_json) = 'object');

CREATE TABLE public.marketing_provider_readiness_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  changes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_provider_readiness_logs ADD CONSTRAINT check_m6_mprl_entity_type CHECK (entity_type IN ('provider_account', 'template_mapping'));
ALTER TABLE public.marketing_provider_readiness_logs ADD CONSTRAINT check_m6_mprl_action CHECK (action IN ('created', 'updated', 'archived', 'readiness_changed', 'mapping_upserted'));
ALTER TABLE public.marketing_provider_readiness_logs ADD CONSTRAINT check_m6_mprl_json CHECK (jsonb_typeof(changes_json) = 'object');

-- ============================================================================
-- 3. Indexes
-- ============================================================================
CREATE INDEX idx_m6_mpa_provider_type ON public.marketing_provider_accounts(provider_type);
CREATE INDEX idx_m6_mpa_readiness_status ON public.marketing_provider_accounts(readiness_status);
CREATE INDEX idx_m6_mptm_provider_account_id ON public.marketing_provider_template_mappings(provider_account_id);
CREATE INDEX idx_m6_mptm_marketing_template_id ON public.marketing_provider_template_mappings(marketing_template_id);
CREATE INDEX idx_m6_mptm_readiness_status ON public.marketing_provider_template_mappings(readiness_status);
CREATE INDEX idx_m6_mprl_entity ON public.marketing_provider_readiness_logs(entity_type, entity_id);
CREATE INDEX idx_m6_mprl_created_at ON public.marketing_provider_readiness_logs(created_at);

-- ============================================================================
-- 4. RLS and Grants
-- ============================================================================

ALTER TABLE public.marketing_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_provider_template_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_provider_readiness_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketing_provider_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.marketing_provider_template_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.marketing_provider_readiness_logs FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.marketing_provider_accounts TO authenticated;
GRANT SELECT ON public.marketing_provider_template_mappings TO authenticated;
GRANT SELECT ON public.marketing_provider_readiness_logs TO authenticated;

CREATE POLICY "m6_admin_select_accounts" ON public.marketing_provider_accounts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'sub_admin')));
CREATE POLICY "m6_admin_select_mappings" ON public.marketing_provider_template_mappings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'sub_admin')));
CREATE POLICY "m6_admin_select_logs" ON public.marketing_provider_readiness_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'sub_admin')));

-- ============================================================================
-- 5. RPCs
-- ============================================================================

-- RPC 1: m6_create_provider_account
CREATE OR REPLACE FUNCTION public.m6_create_provider_account(
  p_provider_type text,
  p_account_name text,
  p_external_provider_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')) THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_provider_type NOT IN ('zalo_zns', 'sendgrid', 'sms', 'smtp', 'other') THEN RAISE EXCEPTION 'Invalid provider type'; END IF;

  INSERT INTO public.marketing_provider_accounts (
    provider_type, account_name, external_provider_id, created_by, updated_by
  ) VALUES (
    p_provider_type, p_account_name, p_external_provider_id, auth.uid(), auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.marketing_provider_readiness_logs (
    entity_type, entity_id, action, actor_id, changes_json
  ) VALUES (
    'provider_account', v_id, 'created', auth.uid(),
    jsonb_build_object('provider_type', p_provider_type, 'account_name', p_account_name)
  );
  RETURN v_id;
END;
$$;

-- RPC 2: m6_update_provider_external_config_status
CREATE OR REPLACE FUNCTION public.m6_update_provider_external_config_status(
  p_provider_id uuid,
  p_readiness_status text,
  p_secret_status text,
  p_secret_reference text,
  p_configured_externally boolean,
  p_manual_verification_notes text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')) THEN RAISE EXCEPTION 'Access denied'; END IF;

  IF p_readiness_status = 'ready' THEN
    IF NOT p_configured_externally OR p_secret_status IN ('missing', 'invalid_reference') THEN
      RAISE EXCEPTION 'Cannot mark provider as ready unless configured_externally is true and secret_status is valid.';
    END IF;
  END IF;

  UPDATE public.marketing_provider_accounts
  SET readiness_status = p_readiness_status,
      secret_status = p_secret_status,
      secret_reference = p_secret_reference,
      configured_externally = p_configured_externally,
      manual_verification_notes = COALESCE(p_manual_verification_notes, manual_verification_notes),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_provider_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Provider account not found or no rows updated'; END IF;

  INSERT INTO public.marketing_provider_readiness_logs (
    entity_type, entity_id, action, actor_id, changes_json
  ) VALUES (
    'provider_account', p_provider_id, 'updated', auth.uid(),
    jsonb_build_object('readiness_status', p_readiness_status, 'secret_status', p_secret_status, 'configured_externally', p_configured_externally)
  );
END;
$$;

-- RPC 3: m6_upsert_template_mapping
CREATE OR REPLACE FUNCTION public.m6_upsert_template_mapping(
  p_marketing_template_id uuid,
  p_provider_account_id uuid,
  p_provider_template_id text,
  p_param_mapping_json jsonb,
  p_mapping_status text,
  p_readiness_status text,
  p_verification_notes text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_provider_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')) THEN RAISE EXCEPTION 'Access denied'; END IF;

  IF char_length(trim(p_provider_template_id)) = 0 THEN RAISE EXCEPTION 'provider_template_id cannot be blank'; END IF;
  IF jsonb_typeof(p_param_mapping_json) != 'object' THEN RAISE EXCEPTION 'param_mapping_json must be an object'; END IF;
  IF p_mapping_status NOT IN ('draft', 'active', 'archived') THEN RAISE EXCEPTION 'Invalid mapping_status'; END IF;
  IF p_readiness_status NOT IN ('not_configured', 'pending_manual_verification', 'ready', 'disabled') THEN RAISE EXCEPTION 'Invalid readiness_status'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.marketing_templates WHERE id = p_marketing_template_id) THEN RAISE EXCEPTION 'marketing_template_id does not exist'; END IF;

  SELECT readiness_status INTO v_provider_status FROM public.marketing_provider_accounts WHERE id = p_provider_account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'provider_account_id does not exist'; END IF;

  IF p_readiness_status = 'ready' AND v_provider_status = 'disabled' THEN
    RAISE EXCEPTION 'Cannot set mapping readiness to ready if provider account is disabled';
  END IF;

  INSERT INTO public.marketing_provider_template_mappings (
    marketing_template_id, provider_account_id, provider_template_id, 
    param_mapping_json, mapping_status, readiness_status, verification_notes, 
    last_verified_at, created_by, updated_by
  ) VALUES (
    p_marketing_template_id, p_provider_account_id, p_provider_template_id,
    p_param_mapping_json, p_mapping_status, p_readiness_status, p_verification_notes,
    now(), auth.uid(), auth.uid()
  )
  ON CONFLICT (provider_account_id, marketing_template_id, provider_template_id)
  DO UPDATE SET
    param_mapping_json = EXCLUDED.param_mapping_json,
    mapping_status = EXCLUDED.mapping_status,
    readiness_status = EXCLUDED.readiness_status,
    verification_notes = EXCLUDED.verification_notes,
    last_verified_at = now(),
    updated_at = now(),
    updated_by = auth.uid()
  RETURNING id INTO v_id;

  INSERT INTO public.marketing_provider_readiness_logs (
    entity_type, entity_id, action, actor_id, changes_json
  ) VALUES (
    'template_mapping', v_id, 'mapping_upserted', auth.uid(),
    jsonb_build_object('marketing_template_id', p_marketing_template_id, 'provider_template_id', p_provider_template_id, 'readiness_status', p_readiness_status)
  );
  RETURN v_id;
END;
$$;

-- RPC 4: m6_toggle_provider_readiness
CREATE OR REPLACE FUNCTION public.m6_toggle_provider_readiness(
  p_provider_id uuid,
  p_readiness_status text,
  p_notes text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_configured boolean;
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')) THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT configured_externally, secret_status INTO v_configured, v_secret FROM public.marketing_provider_accounts WHERE id = p_provider_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider account not found'; END IF;

  IF p_readiness_status = 'ready' THEN
    IF NOT v_configured OR v_secret IN ('missing', 'invalid_reference') THEN
      RAISE EXCEPTION 'Cannot mark provider as ready unless configured_externally is true and secret_status is valid.';
    END IF;
  END IF;

  UPDATE public.marketing_provider_accounts
  SET readiness_status = p_readiness_status,
      manual_verification_notes = COALESCE(p_notes, manual_verification_notes),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_provider_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Provider account not found or no rows updated'; END IF;

  INSERT INTO public.marketing_provider_readiness_logs (
    entity_type, entity_id, action, actor_id, changes_json
  ) VALUES (
    'provider_account', p_provider_id, 'readiness_changed', auth.uid(),
    jsonb_build_object('readiness_status', p_readiness_status, 'notes', p_notes)
  );
END;
$$;

-- Exact Signature Revokes and Grants
REVOKE EXECUTE ON FUNCTION public.m6_create_provider_account(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.m6_update_provider_external_config_status(uuid, text, text, text, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.m6_upsert_template_mapping(uuid, uuid, text, jsonb, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.m6_toggle_provider_readiness(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.m6_create_provider_account(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.m6_update_provider_external_config_status(uuid, text, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.m6_upsert_template_mapping(uuid, uuid, text, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.m6_toggle_provider_readiness(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
