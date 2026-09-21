-- Admin can request cancellation of an in-flight Luma sync. The worker polls
-- cancel_requested_at at each event-loop iteration and bails out cleanly,
-- finalizing the job with status='cancelled'.

ALTER TABLE luma_sync_jobs
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;

ALTER TABLE luma_sync_jobs
  DROP CONSTRAINT IF EXISTS luma_sync_jobs_status_check;

ALTER TABLE luma_sync_jobs
  ADD CONSTRAINT luma_sync_jobs_status_check
  CHECK (status IN ('queued','running','succeeded','partial','failed','cancelled'));
