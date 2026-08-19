CREATE TABLE rating_events (
  id UUID PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opponent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  difficulty difficulty NOT NULL,
  outcome NUMERIC(2, 1) NOT NULL CHECK (outcome IN (0, 0.5, 1)),
  mmr_before NUMERIC(8, 2) NOT NULL,
  mmr_after NUMERIC(8, 2) NOT NULL,
  deviation_before NUMERIC(8, 2) NOT NULL,
  deviation_after NUMERIC(8, 2) NOT NULL,
  volatility_before NUMERIC(8, 6) NOT NULL,
  volatility_after NUMERIC(8, 6) NOT NULL,
  placement_match_number SMALLINT NOT NULL CHECK (placement_match_number BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id),
  CHECK (user_id <> opponent_id)
);

CREATE INDEX rating_events_user_difficulty_idx ON rating_events (user_id, difficulty, created_at DESC);
