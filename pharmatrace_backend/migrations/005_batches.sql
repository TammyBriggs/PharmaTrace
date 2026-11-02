-- Batch lifecycle columns, a per-batch event timeline, and a 'draft' state.
-- 'draft' = the manufacturer saved the details but has not yet signed submitBatch in MetaMask.
-- Drafts are never shown in lists, scans or counts; they become 'pending' once the receipt is verified.
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS approved_at      timestamp,
  ADD COLUMN IF NOT EXISTS approve_tx_hash  varchar(66),
  ADD COLUMN IF NOT EXISTS flag_reason      varchar(60),
  ADD COLUMN IF NOT EXISTS flag_notes       text,
  ADD COLUMN IF NOT EXISTS flag_tx_hash     varchar(66),
  ADD COLUMN IF NOT EXISTS flagged_at       timestamp,
  ADD COLUMN IF NOT EXISTS revoke_reason    varchar(60),
  ADD COLUMN IF NOT EXISTS revoke_notes     text,
  ADD COLUMN IF NOT EXISTS revoke_tx_hash   varchar(66),
  ADD COLUMN IF NOT EXISTS revoked_at       timestamp;

ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_chk;
ALTER TABLE batches ADD CONSTRAINT batches_status_chk
  CHECK (status IN ('draft','pending','approved','flagged','revoked'));

CREATE TABLE IF NOT EXISTS batch_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_uuid   uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  event        varchar(20) NOT NULL
               CHECK (event IN ('submitted','approved','flagged','flag_resolved','revoked','reinstated')),
  actor_id     uuid REFERENCES users(id),
  actor_wallet varchar(42),
  tx_hash      varchar(66) NOT NULL,
  reason       varchar(60),
  notes        text,
  block_time   timestamp NOT NULL,
  created_at   timestamp NOT NULL DEFAULT now()
);
-- One row per (transaction, event): replaying a confirm call can never double-record.
CREATE UNIQUE INDEX IF NOT EXISTS batch_events_tx_event_key ON batch_events (tx_hash, event);
CREATE INDEX IF NOT EXISTS batch_events_batch_idx ON batch_events (batch_uuid, block_time);
CREATE INDEX IF NOT EXISTS batches_status_idx ON batches (status, created_at DESC);
