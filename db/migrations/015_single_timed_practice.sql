BEGIN;
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ;
-- Preserve history, retaining only the newest unfinished timed attempt per player.
WITH duplicates AS (
  SELECT s.id,row_number() OVER(PARTITION BY s.user_id ORDER BY s.started_at DESC,s.id DESC) AS position
  FROM practice_sessions s WHERE s.timed AND s.abandoned_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM practice_runs r WHERE r.session_id=s.id AND r.verdict='accepted')
)
UPDATE practice_sessions s SET abandoned_at=clock_timestamp()
FROM duplicates d WHERE s.id=d.id AND d.position>1;
CREATE OR REPLACE VIEW practice_session_progress AS
SELECT s.id,s.user_id,s.problem_id,s.timed,s.started_at,
  CASE WHEN s.abandoned_at IS NULL THEN accepted.completed_at ELSE NULL END AS completed_at,
  floor(extract(epoch FROM (COALESCE(s.abandoned_at,accepted.completed_at,clock_timestamp())-s.started_at)))::bigint AS elapsed_seconds,
  s.abandoned_at
FROM practice_sessions s LEFT JOIN LATERAL (
  SELECT min(r.created_at) AS completed_at FROM practice_runs r
  WHERE r.session_id=s.id AND r.verdict='accepted'
) accepted ON true;
COMMIT;
