-- Corrige aprovação/ativação de parceiros bloqueada pelo guard de tipo_user.
--
-- enforce_profile_tipo_user_write (criado direto no banco) recusa qualquer
-- mudança de tipo_user quando auth.role() = 'authenticated'. Dentro de uma
-- função SECURITY DEFINER chamada pelo painel, auth.role() continua
-- 'authenticated', então:
--   - "Aceitar parceiro" aprovava a solicitação, mas o UPDATE do perfil
--     falhava: parceria approved com is_partner = false e o código de
--     indicação recusado no checkout como inválido;
--   - set_partner_active (inativar/reativar/cadastrar) falhava inteiro.
--
-- Mudanças:
--   1. O guard aceita a escrita quando vem de função administrativa que
--      sinaliza app.trusted_partner_write = 'on' (GUC local à transação,
--      mesmo padrão de app.run_metric_correction). Passa a proteger também
--      is_partner, que antes podia ser alterado pelo próprio usuário.
--   2. set_partner_active sinaliza a escrita confiável.
--   3. admin_approve_partnership aprova perfil + solicitação atomicamente,
--      respeitando as datas de vigência escolhidas no painel.
--   4. Repara perfis com solicitação aprovada e vigente sem is_partner.

-- ── 1. Guard de tipo_user / is_partner ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_profile_tipo_user_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF COALESCE(current_setting('app.trusted_partner_write', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF current_user = 'authenticated' OR auth.role() = 'authenticated' THEN
    IF TG_OP = 'INSERT'
       AND (NEW.tipo_user IS DISTINCT FROM 'Corredor'::public.tipo_user
            OR NEW.is_partner IS TRUE) THEN
      RAISE EXCEPTION 'authenticated users may only create Corredor profiles'
        USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'UPDATE'
       AND (NEW.tipo_user IS DISTINCT FROM OLD.tipo_user
            OR NEW.is_partner IS DISTINCT FROM OLD.is_partner) THEN
      RAISE EXCEPTION 'authenticated users cannot change tipo_user or is_partner'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_profile_tipo_user_write ON public.profiles;
CREATE TRIGGER trg_enforce_profile_tipo_user_write
  BEFORE INSERT OR UPDATE OF tipo_user, is_partner ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_tipo_user_write();

-- ── 2. set_partner_active com escrita confiável ────────────────────────────
CREATE OR REPLACE FUNCTION public.set_partner_active(
  p_user_id uuid,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request_id uuid;
  v_caller_type text;
BEGIN
  SELECT p.tipo_user::text
  INTO v_caller_type
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());

  IF v_caller_type IS DISTINCT FROM 'Administrador' THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o status de parceiros'
      USING ERRCODE = '42501';
  END IF;

  SELECT pr.id
  INTO v_request_id
  FROM public.partnership_requests pr
  WHERE pr.user_id = p_user_id
  ORDER BY pr.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação de parceria não encontrada';
  END IF;

  PERFORM pg_catalog.set_config('app.trusted_partner_write', 'on', true);

  UPDATE public.profiles
  SET is_partner = p_active,
      tipo_user = CASE
        WHEN tipo_user::text = 'Administrador' THEN tipo_user
        WHEN p_active THEN 'Parceiro'::public.tipo_user
        ELSE 'Corredor'::public.tipo_user
      END,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    PERFORM pg_catalog.set_config('app.trusted_partner_write', 'off', true);
    RAISE EXCEPTION 'Perfil do parceiro não encontrado';
  END IF;

  PERFORM pg_catalog.set_config('app.trusted_partner_write', 'off', true);

  UPDATE public.partnership_requests
  SET status = CASE WHEN p_active THEN 'approved' ELSE 'inactive' END,
      valid_from = CASE WHEN p_active THEN now() ELSE valid_from END,
      valid_until = CASE WHEN p_active THEN NULL ELSE now() END,
      updated_at = now()
  WHERE id = v_request_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_partner_active(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_partner_active(uuid, boolean) TO authenticated;

-- ── 3. Aprovação atômica de solicitação de parceria ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_approve_partnership(
  p_request_id uuid,
  p_valid_from timestamptz DEFAULT NULL,
  p_valid_until timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_user_id uuid;
  v_status text;
  v_from timestamptz := COALESCE(p_valid_from, now());
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_actor AND p.tipo_user::text = 'Administrador'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.admin_permissions ap
    WHERE ap.user_id = v_actor AND ap.permission_key = 'usuarios.approve_partners'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar parceiros'
      USING ERRCODE = '42501';
  END IF;

  IF p_valid_until IS NOT NULL AND p_valid_until <= v_from THEN
    RAISE EXCEPTION 'A data final da parceria deve ser depois da data inicial'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT pr.user_id, pr.status
  INTO v_user_id, v_status
  FROM public.partnership_requests pr
  WHERE pr.id = p_request_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação de parceria não encontrada';
  END IF;

  IF v_status = 'approved' THEN
    RAISE EXCEPTION 'Esta solicitação já foi aprovada';
  END IF;

  PERFORM pg_catalog.set_config('app.trusted_partner_write', 'on', true);

  UPDATE public.profiles
  SET is_partner = true,
      tipo_user = CASE
        WHEN tipo_user::text = 'Administrador' THEN tipo_user
        ELSE 'Parceiro'::public.tipo_user
      END,
      updated_at = now()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    PERFORM pg_catalog.set_config('app.trusted_partner_write', 'off', true);
    RAISE EXCEPTION 'Perfil do parceiro não encontrado';
  END IF;

  PERFORM pg_catalog.set_config('app.trusted_partner_write', 'off', true);

  UPDATE public.partnership_requests
  SET status = 'approved',
      valid_from = v_from,
      valid_until = p_valid_until,
      updated_at = now()
  WHERE id = p_request_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_approve_partnership(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_partnership(uuid, timestamptz, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.admin_approve_partnership(uuid, timestamptz, timestamptz) IS
  'Aprova a solicitação de parceria e marca o perfil como parceiro na mesma transação. Exige usuarios.approve_partners.';

-- ── 4. Reparo de aprovações parciais ───────────────────────────────────────
-- Roda como postgres (sem JWT), então o guard não interfere.
WITH latest_request AS (
  SELECT DISTINCT ON (pr.user_id) pr.user_id, pr.status, pr.valid_until
  FROM public.partnership_requests pr
  ORDER BY pr.user_id, pr.created_at DESC
)
UPDATE public.profiles p
SET is_partner = true,
    tipo_user = 'Parceiro'::public.tipo_user,
    updated_at = now()
FROM latest_request lr
WHERE lr.user_id = p.id
  AND lr.status = 'approved'
  AND (lr.valid_until IS NULL OR lr.valid_until > now())
  AND p.is_partner IS NOT TRUE
  AND p.tipo_user::text <> 'Administrador';
