-- Notifications are derived from existing event tables (batch_events, flag_reports, audit_log), so no new
-- table is needed. The only stored state is when each user last opened their notification panel.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at timestamp;
