-- Align public app leaderboard with reviewed visibility rules and expose
-- administrative diagnostics explaining why attempts are hidden publicly.

create or replace view public.v_competition_leaderboard as
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
), scored_runs as (
  select
    ur.id as run_id,
    ur.competition_id,
    c.mode as competition_mode,
    c.ends_at as competition_ends_at,
    ur.user_id,
    coalesce(cd.meters, ur.distance_meters, lm.distance_meters, 0) as target_distance_meters,
    ur.state,
    ur.started_at,
    ur.finished_at,
    case
      when ur.state = 'finished' then coalesce(ur.distance_meters, 0)
      when lm.distance_meters is not null and (ur.updated_at is null or lm.happened_at >= ur.updated_at) then lm.distance_meters
      else coalesce(ur.distance_meters, 0)
    end as current_distance_meters,
    case
      when ur.state = 'finished' then ur.avg_pace_seconds_per_km
      when lm.pace_seconds_per_km is not null and (ur.updated_at is null or lm.happened_at >= ur.updated_at) then lm.pace_seconds_per_km
      else ur.avg_pace_seconds_per_km
    end as effective_pace_seconds_per_km,
    case
      when ur.state = 'finished'
        and ur.avg_pace_seconds_per_km is not null
        and cd.meters is not null
        and ur.distance_meters > cd.meters
        then round(cd.meters::numeric * ur.avg_pace_seconds_per_km::numeric / 1000.0)::integer
      when ur.state = 'finished' then coalesce(ur.total_time_seconds, 0)
      when lm.elapsed_seconds is not null and (ur.updated_at is null or lm.happened_at >= ur.updated_at) then lm.elapsed_seconds
      else coalesce(ur.total_time_seconds, 0)
    end as effective_total_time_seconds
  from public.user_runs ur
  join public.competitions c on c.id = ur.competition_id
  left join public.competition_registrations cr on cr.id = ur.registration_id
  left join public.competition_distances cd on cd.id = cr.distance_id
  left join latest_metric lm on lm.run_id = ur.id
  where ur.started_at is not null
    and ur.state in ('running', 'paused', 'finished')
), public_candidates as (
  select *
  from scored_runs sr
  where sr.effective_pace_seconds_per_km between 180 and 1800
    and (
      (
        sr.state = 'finished'
        and sr.current_distance_meters::numeric >= sr.target_distance_meters::numeric * 0.99
      )
      or (
        sr.state in ('running', 'paused')
        and (sr.competition_ends_at is null or sr.competition_ends_at > now())
      )
    )
), best_run as (
  select distinct on (pc.competition_id, pc.user_id, pc.target_distance_meters)
    pc.*
  from public_candidates pc
  order by
    pc.competition_id,
    pc.user_id,
    pc.target_distance_meters,
    case when pc.state = 'finished' then 0 else 1 end,
    pc.effective_pace_seconds_per_km nulls last,
    pc.effective_total_time_seconds nulls last,
    pc.current_distance_meters desc,
    pc.started_at desc
)
select
  br.competition_id,
  br.competition_mode,
  br.run_id,
  br.user_id,
  br.target_distance_meters as distance_meters,
  br.effective_total_time_seconds as total_time_seconds,
  br.effective_pace_seconds_per_km as avg_pace_seconds_per_km,
  br.finished_at,
  row_number() over (
    partition by br.competition_id, br.target_distance_meters
    order by
      case when br.state = 'finished' then 0 else 1 end,
      br.effective_pace_seconds_per_km nulls last,
      br.effective_total_time_seconds nulls last,
      br.current_distance_meters desc,
      br.started_at desc
  ) as rank,
  p.full_name as user_name,
  p.avatar_url as user_avatar_url,
  br.state,
  br.current_distance_meters,
  coalesce(p.total_xp, 0) as total_xp,
  p.birth_date as user_birth_date
from best_run br
left join public.profiles p on p.id = br.user_id;

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
    c.ends_at as competition_ends_at,
    cd.meters as registered_distance_meters
  from public.user_runs ur
  join public.competitions c on c.id = ur.competition_id
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
), classified as (
  select
    rs.*,
    case
      when rs.state = 'aborted' then 'aborted'
      when rs.effective_pace_seconds_per_km is null then 'missing_pace'
      when rs.effective_pace_seconds_per_km < 180 then 'pace_too_fast'
      when rs.effective_pace_seconds_per_km > 1800 then 'pace_too_slow'
      when rs.state = 'finished' and rs.current_distance_meters::numeric < rs.ranking_distance_meters::numeric * 0.99 then 'below_99pct_distance'
      when rs.state in ('running', 'paused') and rs.competition_ends_at is not null and rs.competition_ends_at <= now() then 'paused_after_competition_end'
      when rs.state not in ('running', 'paused', 'finished') then 'not_finished'
      else null
    end as hidden_reason
  from run_scores rs
), best_run as (
  select distinct on (c.competition_id, c.user_id)
    c.*
  from classified c
  order by
    c.competition_id,
    c.user_id,
    case when c.hidden_reason is null then 0 else 1 end,
    case when c.state = 'finished' then 0 else 1 end,
    c.effective_pace_seconds_per_km nulls last,
    c.effective_total_time_seconds nulls last,
    c.current_distance_meters desc,
    c.started_at desc
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
      case when br.hidden_reason is null then 0 else 1 end,
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
  p.birth_date as user_birth_date,
  case when br.hidden_reason is null then 'visible' else 'hidden' end as public_visibility,
  br.hidden_reason,
  br.ranking_distance_meters as target_distance_meters,
  br.total_time_seconds as raw_total_time_seconds
from best_run br
left join public.profiles p on p.id = br.user_id;

grant select on public.v_competition_leaderboard to authenticated;
grant select on public.v_admin_competition_attempt_ranking to authenticated;
