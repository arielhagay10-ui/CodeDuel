CREATE TYPE placement_status AS ENUM ('active', 'completed', 'expired');

CREATE TABLE placement_attempts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty difficulty NOT NULL,
  placement_number SMALLINT NOT NULL CHECK (placement_number BETWEEN 1 AND 5),
  problem_id UUID NOT NULL REFERENCES problems(id),
  status placement_status NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  tests_passed SMALLINT,
  tests_total SMALLINT,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, difficulty, placement_number)
);

ALTER TABLE submissions ADD COLUMN placement_attempt_id UUID REFERENCES placement_attempts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX submissions_one_per_placement_attempt ON submissions (placement_attempt_id) WHERE placement_attempt_id IS NOT NULL;
CREATE INDEX placement_attempts_active_idx ON placement_attempts (status, ends_at) WHERE status = 'active';
