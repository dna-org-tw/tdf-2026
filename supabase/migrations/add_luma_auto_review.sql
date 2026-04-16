-- Luma auto-review log and sync job review stats.

CREATE TABLE IF NOT EXISTS luma_review_log (
  id                  BIGSERIAL PRIMARY KEY,
  job_id              BIGINT REFERENCES luma_sync_jobs(id) ON DELETE CASCADE,
  event_api_id        TEXT NOT NULL,
  email               TEXT NOT NULL,
  member_id           BIGINT REFERENCES members(id) ON DELETE SET NULL,
  luma_guest_api_id   TEXT,
  previous_status     TEXT NOT NULL,
  new_status          TEXT NOT NULL,
  reason              TEXT NOT NULL,
  consumed_no_show_event_api_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_luma_review_log_job ON luma_review_log (job_id);
CREATE INDEX IF NOT EXISTS idx_luma_review_log_email ON luma_review_log (email);
CREATE INDEX IF NOT EXISTS idx_luma_review_log_email_reason ON luma_review_log (email, reason);

ALTER TABLE luma_review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma_review_log FORCE ROW LEVEL SECURITY;

-- Review statistics on sync jobs
ALTER TABLE luma_sync_jobs ADD COLUMN IF NOT EXISTS review_approved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE luma_sync_jobs ADD COLUMN IF NOT EXISTS review_declined INTEGER NOT NULL DEFAULT 0;
ALTER TABLE luma_sync_jobs ADD COLUMN IF NOT EXISTS review_waitlisted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE luma_sync_jobs ADD COLUMN IF NOT EXISTS review_skipped INTEGER NOT NULL DEFAULT 0;
