create or replace view public.v_admin_competition_registered_users as
with attempts as (
  select competition_id, user_id, count(*)::integer as attempts
  from public.user_runs
  where started_at is not null
  group by competition_id, user_id
), ranked_registrations as (
  select
    cr.*,
    row_number() over (
      partition by cr.competition_id, cr.user_id
      order by
        case cr.status when 'confirmed' then 0 when 'pending' then 1 else 2 end,
        cr.created_at desc,
        cr.id desc
    ) as rn
  from public.competition_registrations cr
  where cr.status <> 'cancelled'
)
select
  rr.id,
  rr.competition_id,
  rr.user_id,
  rr.distance_id,
  rr.lot_id,
  rr.status,
  rr.created_at,
  rr.shirt_size,
  coalesce(a.attempts, 0) as attempts
from ranked_registrations rr
left join attempts a
  on a.competition_id = rr.competition_id
 and a.user_id = rr.user_id
where rr.rn = 1;

grant select on public.v_admin_competition_registered_users to authenticated;
