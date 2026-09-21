-- Heartbeat column for batch notification sends. The reconciler uses
-- updated_at to decide whether the sender process is still alive: any
-- notification in status='sending' whose updated_at hasn't moved for >60s
-- is considered abandoned (SIGTERM on redeploy, OOM, crash) and gets its
-- drainer re-kicked. processQueueBatch bumps notification_logs every batch
-- (~every 5s during active send), so fresh sends stay above the threshold.

ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS set_notification_logs_updated_at ON notification_logs;
CREATE TRIGGER set_notification_logs_updated_at
  BEFORE UPDATE ON notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
