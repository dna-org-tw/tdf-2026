-- Track Luma → DB ghost guest removals (Luma is source of truth).
-- A ghost is a local luma_guests row whose email no longer appears in the
-- freshly-fetched Luma roster for that event (cancelled / refunded / deleted).

ALTER TABLE luma_sync_event_results
  ADD COLUMN IF NOT EXISTS guests_removed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE luma_sync_jobs
  ADD COLUMN IF NOT EXISTS total_guests_removed INTEGER NOT NULL DEFAULT 0;
