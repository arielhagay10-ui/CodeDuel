CREATE TABLE message_reports (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES match_messages(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL CHECK (category IN ('abusive_behavior', 'suspected_cheating', 'other')),
  details TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);

CREATE INDEX message_reports_review_idx ON message_reports (status, created_at) WHERE status = 'pending';
