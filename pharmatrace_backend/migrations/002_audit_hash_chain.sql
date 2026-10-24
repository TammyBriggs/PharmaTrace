-- Tamper-evident audit log: each row stores the hash of the previous row, so editing,
-- deleting or reordering any row breaks every hash after it.
-- Assumes audit_log is empty (nothing has written to it yet).
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS seq BIGSERIAL,
  ADD COLUMN IF NOT EXISTS ts_ms BIGINT NOT NULL,
  ADD COLUMN IF NOT EXISTS prev_hash CHAR(64) NOT NULL,
  ADD COLUMN IF NOT EXISTS row_hash CHAR(64) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS audit_log_seq_key ON audit_log (seq);

-- Second layer: the database itself refuses UPDATE and DELETE on audit rows.
CREATE OR REPLACE FUNCTION audit_log_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log;
CREATE TRIGGER audit_log_no_change
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_changes();
