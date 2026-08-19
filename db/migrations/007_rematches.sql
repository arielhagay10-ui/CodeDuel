CREATE TABLE match_rematch_requests (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rematch_id UUID REFERENCES matches(id),
  PRIMARY KEY (match_id, requester_id)
);

CREATE UNIQUE INDEX match_rematch_requests_created_match_idx
  ON match_rematch_requests (rematch_id) WHERE rematch_id IS NOT NULL;
