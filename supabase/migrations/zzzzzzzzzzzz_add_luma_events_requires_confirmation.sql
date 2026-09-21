-- Per-event opt-in flag for the confirmation + credit-card guarantee
-- mechanism. Default false (off) so admins explicitly choose which events
-- apply the rule, avoiding surprise demotions on events that were never
-- meant to require pre-attendance confirmation (e.g. drop-in workshops,
-- free community meetups, partner events).
--
-- Partial index on the `true` set keeps the lookup cheap regardless of how
-- the festival's overall event mix evolves.
ALTER TABLE luma_events
  ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_luma_events_requires_confirmation
  ON luma_events (requires_confirmation) WHERE requires_confirmation = true;
