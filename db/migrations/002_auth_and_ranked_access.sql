-- OAuth identities are created before a player chooses their public handle.
ALTER TABLE users ALTER COLUMN handle DROP NOT NULL;
ALTER TABLE users ADD COLUMN fair_play_accepted_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT users_handle_key;
CREATE UNIQUE INDEX users_handle_case_insensitive_unique
  ON users (lower(handle))
  WHERE handle IS NOT NULL;
