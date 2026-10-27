-- Manufacturers get a real workflow: pending (saved, not yet on-chain) -> active (registered on-chain) -> revoked.
ALTER TABLE manufacturers DROP CONSTRAINT IF EXISTS manufacturers_status_check;
ALTER TABLE manufacturers ADD CONSTRAINT manufacturers_status_check
  CHECK (status IN ('pending','active','revoked'));
ALTER TABLE manufacturers ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE manufacturers
  ADD COLUMN IF NOT EXISTS country VARCHAR(60) NOT NULL DEFAULT 'Rwanda',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,        -- block time of the registering tx (UTC)
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS revoke_tx_hash VARCHAR(66);
