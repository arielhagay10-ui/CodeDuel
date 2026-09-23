BEGIN;
CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id),
  timed BOOLEAN NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS practice_sessions_owner_problem_idx ON practice_sessions(user_id,problem_id,started_at DESC);
ALTER TABLE practice_runs ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES practice_sessions(id);
CREATE INDEX IF NOT EXISTS practice_runs_session_idx ON practice_runs(session_id);
-- Stop at submission time, excluding judge queue/runtime latency. A failed run
-- does not finish an attempt. The existing judge's verdict updates this view.
CREATE OR REPLACE VIEW practice_session_progress AS
SELECT s.*, accepted.completed_at,
  floor(extract(epoch FROM (COALESCE(accepted.completed_at,clock_timestamp())-s.started_at)))::bigint AS elapsed_seconds
FROM practice_sessions s LEFT JOIN LATERAL (
  SELECT min(r.created_at) AS completed_at FROM practice_runs r
  WHERE r.session_id=s.id AND r.verdict='accepted'
) accepted ON true;
COMMIT;
