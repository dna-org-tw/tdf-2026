-- Adds category to notification_logs so history/audit can distinguish
-- broadcast categories (newsletter/events/award) from 履約必要通知 (critical).
-- The app already accepts a `category` field on POST /api/admin/send but did
-- not persist it. This migration closes that gap and adds the 'critical' value.
ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_logs_category
  ON notification_logs (category);

COMMENT ON COLUMN notification_logs.category IS
  'One of: newsletter, events, award, critical. NULL for rows created before category tracking.';
