-- Per-event auto-review counters on luma_sync_event_results.
-- Previously only the job-level aggregate was stored; operators need to see
-- which event produced how many approvals/waitlists when auditing a sync run.

ALTER TABLE luma_sync_event_results
  ADD COLUMN IF NOT EXISTS review_approved INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_waitlisted INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_skipped INTEGER NOT NULL DEFAULT 0;
