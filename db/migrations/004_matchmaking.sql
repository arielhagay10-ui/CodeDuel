CREATE TABLE match_queue_entries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty difficulty NOT NULL,
  queued_mmr NUMERIC(8, 2) NOT NULL,
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  matched_at TIMESTAMPTZ,
  match_id UUID REFERENCES matches(id)
);

CREATE UNIQUE INDEX match_queue_one_active_entry_per_user
  ON match_queue_entries (user_id) WHERE cancelled_at IS NULL AND matched_at IS NULL;
CREATE INDEX match_queue_match_idx ON match_queue_entries (difficulty, enqueued_at)
  WHERE cancelled_at IS NULL AND matched_at IS NULL;

ALTER TABLE matches ADD COLUMN lobby_ends_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN ready_window_ends_at TIMESTAMPTZ;

CREATE TABLE match_ready_ups (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round_number SMALLINT NOT NULL CHECK (round_number BETWEEN 0 AND 3),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ready_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, round_number, user_id)
);

CREATE INDEX match_ready_ups_match_idx ON match_ready_ups (match_id, round_number);
