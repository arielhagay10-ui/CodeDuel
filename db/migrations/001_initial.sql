-- CodeDuel MVP: PostgreSQL schema. Apply through a migration tool in deployment.

CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'advanced');
CREATE TYPE problem_format AS ENUM ('function', 'standard_input_output');
CREATE TYPE match_status AS ENUM ('waiting', 'active', 'between_rounds', 'completed', 'cancelled');
CREATE TYPE round_status AS ENUM ('pending', 'active', 'completed', 'draw');
CREATE TYPE submission_verdict AS ENUM ('queued', 'running', 'accepted', 'wrong_answer', 'time_limit_exceeded', 'runtime_error', 'internal_error');

CREATE TABLE users (
  id UUID PRIMARY KEY,
  handle VARCHAR(24) NOT NULL UNIQUE,
  ranked_access_granted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  banned_at TIMESTAMPTZ
);

CREATE TABLE auth_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL CHECK (provider IN ('google', 'github')),
  provider_account_id VARCHAR(255) NOT NULL,
  email VARCHAR(320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE user_difficulty_ratings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty difficulty NOT NULL,
  mmr NUMERIC(8, 2) NOT NULL DEFAULT 1500,
  rating_deviation NUMERIC(8, 2) NOT NULL DEFAULT 350,
  volatility NUMERIC(8, 6) NOT NULL DEFAULT 0.06,
  placement_matches_completed SMALLINT NOT NULL DEFAULT 0 CHECK (placement_matches_completed BETWEEN 0 AND 5),
  visible_tier VARCHAR(24),
  visible_division VARCHAR(3),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, difficulty),
  CHECK ((visible_tier IS NULL AND visible_division IS NULL) OR placement_matches_completed = 5)
);

CREATE TABLE problems (
  id UUID PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  difficulty difficulty NOT NULL,
  format problem_format NOT NULL,
  statement_markdown TEXT NOT NULL,
  starter_code TEXT NOT NULL,
  reference_solution TEXT NOT NULL,
  time_limit_ms INTEGER NOT NULL CHECK (time_limit_ms > 0),
  memory_limit_mb INTEGER NOT NULL CHECK (memory_limit_mb > 0),
  author_name VARCHAR(160) NOT NULL,
  content_license VARCHAR(160) NOT NULL,
  published_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ
);

CREATE TABLE problem_tests (
  id UUID PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  input_data TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  weight SMALLINT NOT NULL DEFAULT 1 CHECK (weight > 0),
  ordinal SMALLINT NOT NULL,
  UNIQUE (problem_id, ordinal)
);

CREATE TABLE matches (
  id UUID PRIMARY KEY,
  difficulty difficulty NOT NULL,
  status match_status NOT NULL DEFAULT 'waiting',
  player_one_id UUID NOT NULL REFERENCES users(id),
  player_two_id UUID NOT NULL REFERENCES users(id),
  player_one_mmr_before NUMERIC(8, 2) NOT NULL,
  player_two_mmr_before NUMERIC(8, 2) NOT NULL,
  winner_id UUID REFERENCES users(id),
  player_one_disconnected_at TIMESTAMPTZ,
  player_two_disconnected_at TIMESTAMPTZ,
  forfeited_at TIMESTAMPTZ,
  forfeit_reason VARCHAR(32),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (player_one_id <> player_two_id),
  CHECK (winner_id IS NULL OR winner_id = player_one_id OR winner_id = player_two_id),
  CHECK (forfeit_reason IS NULL OR forfeit_reason IN ('disconnect', 'surrender', 'abandonment', 'moderation'))
);

CREATE TABLE match_rounds (
  id UUID PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id),
  round_number SMALLINT NOT NULL CHECK (round_number BETWEEN 1 AND 3),
  status round_status NOT NULL DEFAULT 'pending',
  winner_id UUID REFERENCES users(id),
  player_one_tests_passed SMALLINT NOT NULL DEFAULT 0,
  player_two_tests_passed SMALLINT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (match_id, round_number)
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  problem_id UUID NOT NULL REFERENCES problems(id),
  match_round_id UUID REFERENCES match_rounds(id) ON DELETE SET NULL,
  language VARCHAR(32) NOT NULL DEFAULT 'python',
  source_code TEXT NOT NULL,
  verdict submission_verdict NOT NULL DEFAULT 'queued',
  tests_passed SMALLINT NOT NULL DEFAULT 0,
  tests_total SMALLINT NOT NULL DEFAULT 0,
  runtime_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  judged_at TIMESTAMPTZ
);

CREATE TABLE player_reports (
  id UUID PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id),
  reported_user_id UUID NOT NULL REFERENCES users(id),
  category VARCHAR(32) NOT NULL CHECK (category IN ('suspected_cheating', 'inappropriate_handle', 'abusive_behavior', 'other')),
  details TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  CHECK (reporter_id <> reported_user_id),
  UNIQUE (match_id, reporter_id, reported_user_id)
);

CREATE TABLE match_messages (
  id UUID PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body VARCHAR(300) NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_reason VARCHAR(32)
);

CREATE INDEX matches_active_queue_idx ON matches (difficulty, status, created_at) WHERE status IN ('waiting', 'active');
CREATE INDEX submissions_round_idx ON submissions (match_round_id, created_at DESC);
CREATE INDEX problems_available_idx ON problems (difficulty, published_at) WHERE published_at IS NOT NULL AND retired_at IS NULL;
CREATE INDEX auth_accounts_user_idx ON auth_accounts (user_id);
CREATE INDEX player_reports_review_idx ON player_reports (status, created_at) WHERE status = 'pending';
CREATE INDEX match_messages_match_idx ON match_messages (match_id, created_at);
