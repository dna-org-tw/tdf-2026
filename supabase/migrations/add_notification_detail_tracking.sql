-- Add per-recipient tracking for batch notifications

-- Add notification_id to email_logs so we can link individual emails back to a batch notification
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES notification_logs(id);
CREATE INDEX IF NOT EXISTS idx_email_logs_notification_id ON email_logs (notification_id);

-- Add success/failure counts to notification_logs
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
