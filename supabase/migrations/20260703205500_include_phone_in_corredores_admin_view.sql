create or replace view public.v_corredores_admin as
select
  p.id,
  p.full_name,
  _user_email(p.id) as email,
  p.birth_date,
  p.gender,
  p.avatar_url,
  p.preferred_distance,
  p.tipo_user::text as tipo_user,
  p.updated_at,
  coalesce(ucb.balance, 0) as credit_balance,
  p.city,
  p.state,
  coalesce(p.total_xp, 0) as total_xp,
  coalesce(p.is_partner, false) as is_partner,
  p.phone
from public.profiles p
left join public.user_credit_balances ucb on ucb.user_id = p.id;
