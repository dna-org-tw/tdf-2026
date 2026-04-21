-- The worker writes status='skipped' for events with no TDF ticket
-- (see lumaSyncWorker.ts processEvent → skipped), but the original CHECK
-- constraint only allowed ('pending','running','done','failed'), so those
-- UPDATEs were silently rejected and rows stayed at 'running'.

ALTER TABLE luma_sync_event_results
  DROP CONSTRAINT IF EXISTS luma_sync_event_results_status_check;

ALTER TABLE luma_sync_event_results
  ADD CONSTRAINT luma_sync_event_results_status_check
  CHECK (status IN ('pending','running','done','failed','skipped'));

-- Backfill: rows stuck at 'running' inside a finished job were almost
-- certainly skipped (non-TDF) events that couldn't commit their terminal
-- UPDATE. finished_at IS NULL confirms they never got the success UPDATE.
UPDATE luma_sync_event_results r
SET
  status = 'skipped',
  finished_at = j.finished_at
FROM luma_sync_jobs j
WHERE r.job_id = j.id
  AND r.status = 'running'
  AND r.finished_at IS NULL
  AND j.phase = 'done'
  AND j.status IN ('succeeded','partial');
