ALTER TABLE public.partnership_requests
  DROP CONSTRAINT IF EXISTS partnership_requests_status_check;

ALTER TABLE public.partnership_requests
  ADD CONSTRAINT partnership_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'inactive', 'expired'));

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
    RAISE EXCEPTION 'Perfil do parceiro não encontrado';
  END IF;

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

COMMENT ON FUNCTION public.set_partner_active(uuid, boolean) IS
  'Atualiza o perfil e a solicitação mais recente do parceiro atomicamente; permitido apenas para administradores.';

-- Corrige inativações parciais feitas pelo painel antigo: o perfil já bloqueava
-- o código de indicação, mas a solicitação ainda aparecia como aprovada na lista.
WITH latest_request AS (
  SELECT DISTINCT ON (pr.user_id) pr.id, pr.user_id
  FROM public.partnership_requests pr
  ORDER BY pr.user_id, pr.created_at DESC
)
UPDATE public.partnership_requests pr
SET status = 'inactive',
    valid_until = COALESCE(pr.valid_until, now()),
    updated_at = now()
FROM latest_request latest
JOIN public.profiles p ON p.id = latest.user_id
WHERE pr.id = latest.id
  AND pr.status = 'approved'
  AND p.is_partner IS DISTINCT FROM true;