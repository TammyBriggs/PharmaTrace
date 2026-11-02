-- Regulator review of pharmacist flag reports. The columns already exist in the live schema
-- (status, reviewed_by, reviewed_at, review_note); this only adds a guard and an index.
-- NOT VALID: the rule applies to new/changed rows and does not fail on any old row.
ALTER TABLE flag_reports DROP CONSTRAINT IF EXISTS flag_reports_status_chk;
ALTER TABLE flag_reports ADD CONSTRAINT flag_reports_status_chk
  CHECK (status IN ('open','under_review','closed')) NOT VALID;
CREATE INDEX IF NOT EXISTS flag_reports_status_idx ON flag_reports (status, reported_at DESC);
