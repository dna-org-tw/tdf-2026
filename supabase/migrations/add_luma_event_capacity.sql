-- Track Luma event capacity (max guests) so the auto-review can stop
-- approving once the event is full. NULL = unlimited (no capacity set on Luma).
-- last_capacity_synced_at lets the worker detect stale rows during partial syncs.

ALTER TABLE luma_events
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS last_capacity_synced_at TIMESTAMPTZ;
