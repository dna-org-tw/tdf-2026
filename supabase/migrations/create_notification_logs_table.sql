-- Create notification_logs table for tracking batch email sends
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_groups JSONB NOT NULL,
  recipient_tiers JSONB,
  recipient_count INTEGER NOT NULL,
  sent_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_created_at ON notification_logs (created_at DESC);
CREATE INDEX idx_notification_logs_sent_by ON notification_logs (sent_by);

-- Enable RLS (service role bypasses it, consistent with other tables)
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs FORCE ROW LEVEL SECURITY;
