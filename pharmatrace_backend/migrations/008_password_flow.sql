-- Password flow: emailed reset codes and a record of when a password last changed.
-- password_resets already exists (migration 001); it stores a SHA-256 of the code, never the code itself.
ALTER TABLE password_resets
  ADD COLUMN IF NOT EXISTS attempts   INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id, created_at DESC);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;
