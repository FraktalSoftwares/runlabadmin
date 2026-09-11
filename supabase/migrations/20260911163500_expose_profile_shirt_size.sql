ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shirt_size text;

CREATE OR REPLACE VIEW public.v_corredores_admin
WITH (security_invoker = on) AS
SELECT
  p.id,
  p.full_name,
  public._user_email(p.id) AS email,
  p.birth_date,
  p.gender,
  p.avatar_url,
  p.preferred_distance,
  p.tipo_user::text AS tipo_user,
  p.updated_at,
  COALESCE(ucb.balance, 0) AS credit_balance,
  p.city,
  p.state,
  COALESCE(p.total_xp, 0) AS total_xp,
  COALESCE(p.is_partner, false) AS is_partner,
  p.phone,
  p.shirt_size
FROM public.profiles p
LEFT JOIN public.user_credit_balances ucb ON ucb.user_id = p.id;

REVOKE ALL ON public.v_corredores_admin FROM anon;
GRANT SELECT ON public.v_corredores_admin TO authenticated, service_role;
