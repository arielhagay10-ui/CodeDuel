CREATE TABLE practice_runs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id),
  source_code TEXT NOT NULL,
  verdict submission_verdict NOT NULL DEFAULT 'queued',
  tests_passed SMALLINT NOT NULL DEFAULT 0,
  tests_total SMALLINT NOT NULL DEFAULT 0,
  judged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE practice_jobs (
  id UUID PRIMARY KEY,
  practice_run_id UUID NOT NULL UNIQUE REFERENCES practice_runs(id) ON DELETE CASCADE,
  status judge_job_status NOT NULL DEFAULT 'queued',
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(120),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX practice_jobs_claim_idx ON practice_jobs (available_at, created_at) WHERE status = 'queued';
