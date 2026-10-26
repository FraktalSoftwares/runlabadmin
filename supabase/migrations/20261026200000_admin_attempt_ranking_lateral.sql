-- "Auditoria de tentativas" (Gestão de competições → Ranking) estourando
-- statement_timeout (57014).
--
-- O CTE latest_metric fazia DISTINCT ON (run_id) sobre TODOS os eventos
-- 'metric' de user_run_events — de todas as corridas, de todas as
-- competições — a cada abertura da auditoria. Mesmo problema que
-- v_competition_leaderboard teve e que 20261006120000 (runlab) corrigiu.
--
-- Aqui latest_metric vira LATERAL por corrida, usando o índice parcial
-- idx_user_run_events_metric_run_happened (run_id, happened_at DESC)
-- WHERE type = 'metric', que já existe em produção. Colunas, nomes, tipos,
-- ordem e regras ficam IDÊNTICOS à definição em produção (conferida com
-- pg_get_viewdef em 26/10/2026, igual a 20260701160000).

CREATE OR REPLACE VIEW public.v_admin_competition_attempt_ranking AS
WITH registered_runs AS (
  SELECT ur.id AS run_id,
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
    c.ends_at AS competition_ends_at,
    cd.meters AS registered_distance_meters
  FROM user_runs ur
    JOIN competitions c ON c.id = ur.competition_id
    JOIN v_admin_competition_registered_users aru
      ON aru.competition_id = ur.competition_id AND aru.user_id = ur.user_id
    LEFT JOIN competition_distances cd ON cd.id = COALESCE(aru.distance_id, (
      SELECT cr.distance_id
      FROM competition_registrations cr
      WHERE cr.id = ur.registration_id
      LIMIT 1))
  WHERE ur.started_at IS NOT NULL
), run_scores AS (
  SELECT rr.run_id,
    rr.competition_id,
    rr.user_id,
    rr.registration_id,
    rr.state,
    rr.started_at,
    rr.finished_at,
    rr.total_time_seconds,
    rr.distance_meters,
    rr.avg_pace_seconds_per_km,
    rr.updated_at,
    rr.competition_ends_at,
    rr.registered_distance_meters,
    COALESCE(rr.registered_distance_meters, rr.distance_meters, lm.distance_meters, 0) AS ranking_distance_meters,
    CASE
      WHEN rr.state = 'finished'::text THEN COALESCE(rr.distance_meters, 0)
      WHEN lm.distance_meters IS NOT NULL AND (rr.updated_at IS NULL OR lm.happened_at >= rr.updated_at) THEN lm.distance_meters
      ELSE COALESCE(rr.distance_meters, 0)
    END AS current_distance_meters,
    CASE
      WHEN rr.state = 'finished'::text THEN rr.avg_pace_seconds_per_km
      WHEN lm.pace_seconds_per_km IS NOT NULL AND (rr.updated_at IS NULL OR lm.happened_at >= rr.updated_at) THEN lm.pace_seconds_per_km
      ELSE rr.avg_pace_seconds_per_km
    END AS effective_pace_seconds_per_km,
    CASE
      WHEN rr.state = 'finished'::text AND rr.avg_pace_seconds_per_km IS NOT NULL AND rr.registered_distance_meters IS NOT NULL AND rr.distance_meters > rr.registered_distance_meters
        THEN round(rr.registered_distance_meters::numeric * rr.avg_pace_seconds_per_km::numeric / 1000.0)::integer
      WHEN rr.state = 'finished'::text THEN COALESCE(rr.total_time_seconds, 0)
      WHEN lm.elapsed_seconds IS NOT NULL AND (rr.updated_at IS NULL OR lm.happened_at >= rr.updated_at) THEN lm.elapsed_seconds
      ELSE COALESCE(rr.total_time_seconds, 0)
    END AS effective_total_time_seconds
  FROM registered_runs rr
    -- Última métrica da corrida (antes: CTE latest_metric sobre a tabela toda).
    LEFT JOIN LATERAL (
      SELECT NULLIF(ure.payload ->> 'distance_meters'::text, ''::text)::integer AS distance_meters,
        NULLIF(ure.payload ->> 'elapsed_seconds'::text, ''::text)::integer AS elapsed_seconds,
        NULLIF(ure.payload ->> 'pace_seconds_per_km'::text, ''::text)::integer AS pace_seconds_per_km,
        ure.happened_at
      FROM user_run_events ure
      WHERE ure.run_id = rr.run_id
        AND ure.type = 'metric'::text
      ORDER BY ure.happened_at DESC
      LIMIT 1
    ) lm ON true
), classified AS (
  SELECT rs.run_id,
    rs.competition_id,
    rs.user_id,
    rs.registration_id,
    rs.state,
    rs.started_at,
    rs.finished_at,
    rs.total_time_seconds,
    rs.distance_meters,
    rs.avg_pace_seconds_per_km,
    rs.updated_at,
    rs.competition_ends_at,
    rs.registered_distance_meters,
    rs.ranking_distance_meters,
    rs.current_distance_meters,
    rs.effective_pace_seconds_per_km,
    rs.effective_total_time_seconds,
    CASE
      WHEN rs.state = 'aborted'::text THEN 'aborted'::text
      WHEN rs.effective_pace_seconds_per_km IS NULL THEN 'missing_pace'::text
      WHEN rs.effective_pace_seconds_per_km < 180 THEN 'pace_too_fast'::text
      WHEN rs.effective_pace_seconds_per_km > 1800 THEN 'pace_too_slow'::text
      WHEN rs.state = 'finished'::text AND rs.current_distance_meters::numeric < (rs.ranking_distance_meters::numeric * 0.99) THEN 'below_99pct_distance'::text
      WHEN (rs.state = ANY (ARRAY['running'::text, 'paused'::text])) AND rs.competition_ends_at IS NOT NULL AND rs.competition_ends_at <= now() THEN 'paused_after_competition_end'::text
      WHEN rs.state <> ALL (ARRAY['running'::text, 'paused'::text, 'finished'::text]) THEN 'not_finished'::text
      ELSE NULL::text
    END AS hidden_reason
  FROM run_scores rs
), best_run AS (
  SELECT DISTINCT ON (c.competition_id, c.user_id) c.run_id,
    c.competition_id,
    c.user_id,
    c.registration_id,
    c.state,
    c.started_at,
    c.finished_at,
    c.total_time_seconds,
    c.distance_meters,
    c.avg_pace_seconds_per_km,
    c.updated_at,
    c.competition_ends_at,
    c.registered_distance_meters,
    c.ranking_distance_meters,
    c.current_distance_meters,
    c.effective_pace_seconds_per_km,
    c.effective_total_time_seconds,
    c.hidden_reason
  FROM classified c
  ORDER BY c.competition_id, c.user_id,
    (CASE WHEN c.hidden_reason IS NULL THEN 0 ELSE 1 END),
    (CASE WHEN c.state = 'finished'::text THEN 0 ELSE 1 END),
    c.effective_pace_seconds_per_km, c.effective_total_time_seconds,
    c.current_distance_meters DESC, c.started_at DESC
)
SELECT br.competition_id,
  br.run_id,
  br.user_id,
  br.ranking_distance_meters AS distance_meters,
  br.effective_total_time_seconds AS total_time_seconds,
  br.effective_pace_seconds_per_km AS avg_pace_seconds_per_km,
  br.finished_at,
  row_number() OVER (PARTITION BY br.competition_id ORDER BY
    (CASE WHEN br.hidden_reason IS NULL THEN 0 ELSE 1 END),
    (CASE WHEN br.state = 'finished'::text THEN 0 ELSE 1 END),
    br.effective_pace_seconds_per_km, br.effective_total_time_seconds,
    br.current_distance_meters DESC, br.started_at DESC)::integer AS rank,
  p.full_name AS user_name,
  p.avatar_url AS user_avatar_url,
  br.state,
  br.current_distance_meters,
  COALESCE(p.total_xp, 0) AS total_xp,
  p.birth_date AS user_birth_date,
  CASE WHEN br.hidden_reason IS NULL THEN 'visible'::text ELSE 'hidden'::text END AS public_visibility,
  br.hidden_reason,
  br.ranking_distance_meters AS target_distance_meters,
  br.total_time_seconds AS raw_total_time_seconds
FROM best_run br
  LEFT JOIN profiles p ON p.id = br.user_id;

GRANT SELECT ON public.v_admin_competition_attempt_ranking TO authenticated;
