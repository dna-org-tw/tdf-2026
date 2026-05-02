-- Per-event declined counter on luma_sync_event_results.
-- luma_sync_jobs.review_declined was added earlier (add_luma_auto_review.sql);
-- the per-event mirror was missing. Needed for the approve-cutoff feature
-- which produces declined:cutoff_* outcomes that the admin sync history UI
-- surfaces alongside the existing approved / waitlisted / skipped counters.

ALTER TABLE luma_sync_event_results
  ADD COLUMN IF NOT EXISTS review_declined INTEGER NOT NULL DEFAULT 0;
