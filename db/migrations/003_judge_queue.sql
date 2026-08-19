CREATE TYPE judge_job_status AS ENUM ('queued', 'running', 'completed', 'failed');

ALTER TABLE problems ADD COLUMN entrypoint VARCHAR(120);
ALTER TABLE problems ADD CONSTRAINT problems_function_entrypoint_check
  CHECK ((format = 'function' AND entrypoint IS NOT NULL) OR format = 'standard_input_output');

ALTER TABLE submissions ADD COLUMN is_auto_submission BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE submissions ADD COLUMN hidden_result JSONB;

CREATE TABLE judge_jobs (
  id UUID PRIMARY KEY,
  submission_id UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  status judge_job_status NOT NULL DEFAULT 'queued',
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(120),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE round_drafts (
  match_round_id UUID NOT NULL REFERENCES match_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_code TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_round_id, user_id)
);

CREATE INDEX judge_jobs_claim_idx ON judge_jobs (available_at, created_at) WHERE status = 'queued';
CREATE INDEX submissions_player_round_idx ON submissions (match_round_id, user_id, created_at DESC);
