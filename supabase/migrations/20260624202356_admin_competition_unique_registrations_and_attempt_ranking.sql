create or replace view public.v_admin_competition_registered_users as
with attempts as (
  select competition_id, user_id, count(*)::integer as attempts
  from public.user_runs
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

create or replace view public.v_admin_competition_attempt_ranking as
with latest_metric as (
  select distinct on (ure.run_id)
    ure.run_id,
    nullif(ure.payload ->> 'distance_meters', '')::integer as distance_meters,
    nullif(ure.payload ->> 'elapsed_seconds', '')::integer as elapsed_seconds,
    nullif(ure.payload ->> 'pace_seconds_per_km', '')::integer as pace_seconds_per_km,
    ure.happened_at
  from public.user_run_events ure
  where ure.type = 'metric'
  order by ure.run_id, ure.happened_at desc
), registered_runs as (
  select
    ur.id as run_id,
    ur.competition_id,
    ur.user_id,
    ur.registration_id,
    ur.state,
    ur.started_at,
    ur.finished_at,
    ur.total_time_seconds,
    ur.distance_meters,
    ur.avg_pace_seconds_per_km,
    ur.updated_at,
    cd.meters as registered_distance_meters
  from public.user_runs ur
  join public.v_admin_competition_registered_users aru
    on aru.competition_id = ur.competition_id
   and aru.user_id = ur.user_id
  left join public.competition_distances cd
    on cd.id = coalesce(aru.distance_id, (
      select cr.distance_id
      from public.competition_registrations cr
      where cr.id = ur.registration_id
      limit 1
    ))
  where ur.started_at is not null
), run_scores as (
  select
    rr.*,
    coalesce(rr.registered_distance_meters, rr.distance_meters, lm.distance_meters, 0) as ranking_distance_meters,
    case
      when rr.state = 'finished' then coalesce(rr.distance_meters, 0)
      when lm.distance_meters is not null and (rr.updated_at is null or lm.happened_at >= rr.updated_at) then lm.distance_meters
      else coalesce(rr.distance_meters, 0)
    end as current_distance_meters,
    case
      when rr.state = 'finished' then rr.avg_pace_seconds_per_km
      when lm.pace_seconds_per_km is not null and (rr.updated_at is null or lm.happened_at >= rr.updated_at) then lm.pace_seconds_per_km
      else rr.avg_pace_seconds_per_km
    end as effective_pace_seconds_per_km,
    case
      when rr.state = 'finished' and rr.avg_pace_seconds_per_km is not null and rr.registered_distance_meters is not null and rr.distance_meters > rr.registered_distance_meters
        then round(rr.registered_distance_meters::numeric * rr.avg_pace_seconds_per_km::numeric / 1000.0)::integer
      when rr.state = 'finished' then coalesce(rr.total_time_seconds, 0)
      when lm.elapsed_seconds is not null and (rr.updated_at is null or lm.happened_at >= rr.updated_at) then lm.elapsed_seconds
      else coalesce(rr.total_time_seconds, 0)
    end as effective_total_time_seconds
  from registered_runs rr
  left join latest_metric lm on lm.run_id = rr.run_id
), best_run as (
  select distinct on (rs.competition_id, rs.user_id)
    rs.*
  from run_scores rs
  order by
    rs.competition_id,
    rs.user_id,
    case when rs.state = 'finished' then 0 else 1 end,
    case when rs.effective_pace_seconds_per_km between 1 and 2147483647 then 0 else 1 end,
    rs.effective_pace_seconds_per_km nulls last,
    rs.effective_total_time_seconds nulls last,
    rs.current_distance_meters desc,
    rs.started_at desc
)
select
  br.competition_id,
  br.run_id,
  br.user_id,
  br.ranking_distance_meters as distance_meters,
  br.effective_total_time_seconds as total_time_seconds,
  br.effective_pace_seconds_per_km as avg_pace_seconds_per_km,
  br.finished_at,
  row_number() over (
    partition by br.competition_id
    order by
      case when br.state = 'finished' then 0 else 1 end,
      br.effective_pace_seconds_per_km nulls last,
      br.effective_total_time_seconds nulls last,
      br.current_distance_meters desc,
      br.started_at desc
  )::integer as rank,
  p.full_name as user_name,
  p.avatar_url as user_avatar_url,
  br.state,
  br.current_distance_meters,
  coalesce(p.total_xp, 0) as total_xp,
  p.birth_date as user_birth_date
from best_run br
left join public.profiles p on p.id = br.user_id;

grant select on public.v_admin_competition_registered_users to authenticated;
grant select on public.v_admin_competition_attempt_ranking to authenticated;
