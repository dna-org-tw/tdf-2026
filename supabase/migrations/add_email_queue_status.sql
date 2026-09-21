-- Allow pending/processing status in email_logs for queue mechanism
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed'));

-- Index for efficient queue polling
CREATE INDEX IF NOT EXISTS idx_email_logs_queue
  ON email_logs (notification_id, status)
  WHERE status IN ('pending', 'processing');
