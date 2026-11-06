-- Pack-level anchoring: the Merkle root of a batch's serial numbers is stored on-chain when the batch is submitted.
-- These columns keep the same root and count in the database so the server can build proofs and compare.
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS serial_root  varchar(66),
  ADD COLUMN IF NOT EXISTS serial_count integer;
